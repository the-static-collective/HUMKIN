package org.abundent.receiver

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.content.Context
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.Timeline
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsManifest
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONObject
import java.time.OffsetDateTime
import java.util.Base64

/** Informational UI data; the MediaSession/ExoPlayer remains the authority for audio. */
data class ReceiverSnapshot(
    val station: String = "",
    val cue: Cue? = null,
    val isPlaying: Boolean = false,
    val live: Boolean = false,
    val qualifiedMs: Long = 0,
    val earned: Boolean = false,
    val status: String = "Choose a frequency."
)

object ReceiverEngineState {
    val snapshot = MutableStateFlow(ReceiverSnapshot())
}

private fun decodeCue(tag: String): Cue? {
    val attrs = CueAttributes.fromTag(tag) ?: return null
    return runCatching {
        val encoded = requireNotNull(attrs["X-HUMKIN"])
        require(encoded.length in 1..5000)
        val json = JSONObject(String(Base64.getUrlDecoder().decode(encoded), Charsets.UTF_8))
        Cue(OffsetDateTime.parse(requireNotNull(attrs["START-DATE"])).toInstant().toEpochMilli(),
            json.getString("id"), json.getString("title"), json.optString("artist"), json.optString("artwork"))
    }.getOrNull()
}

/** Actual foreground-capable session survives Activity stop, screen lock and UI recreation. */
@UnstableApi
class ReceiverPlaybackService : MediaSessionService() {
    private var session: MediaSession? = null
    private var player: ExoPlayer? = null
    private val handler = Handler(Looper.getMainLooper())
    private var listening = Listening()
    private var lastManifest: HlsManifest? = null
    private var cachedCues: List<Cue> = emptyList()
    private val pulse = object : Runnable {
        override fun run() {
            updateSnapshot()
            handler.postDelayed(this, 350)
        }
    }

    override fun onCreate() {
        super.onCreate()
        val exo = ExoPlayer.Builder(this).build()
        exo.setAudioAttributes(AudioAttributes.DEFAULT, true)
        exo.setHandleAudioBecomingNoisy(true)
        exo.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (!isPlaying) listening = Listening()
            }
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                listening = Listening()
                lastManifest = null
                cachedCues = emptyList()
            }
            override fun onPositionDiscontinuity(
                oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int
            ) {
                if (reason == Player.DISCONTINUITY_REASON_SEEK) listening = Listening()
            }
        })
        player = exo
        session = MediaSession.Builder(this, exo).build()
        handler.post(pulse)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    override fun onDestroy() {
        handler.removeCallbacks(pulse)
        session?.release()
        session = null
        player?.release()
        player = null
        listening = Listening()
        ReceiverEngineState.snapshot.value = ReceiverSnapshot()
        super.onDestroy()
    }

    private fun updateSnapshot() {
        val exo = player ?: return
        val mediaId = exo.currentMediaItem?.mediaId.orEmpty()
        val station = BroadcastStation.fromMediaId(mediaId)
        val playing = exo.isPlaying
        val prefs = getSharedPreferences("receiver", Context.MODE_PRIVATE)
        val earned = prefs.getBoolean("earned", false)
        val (cue, live, sample) = if (station != null) {
            val current = exo.currentManifest as? HlsManifest
            if (current !== lastManifest) {
                lastManifest = current
                cachedCues = current?.mediaPlaylist?.tags.orEmpty().mapNotNull(::decodeCue)
            }
            val timeline = exo.currentTimeline
            val window = if (timeline.isEmpty) null else
                timeline.getWindow(exo.currentMediaItemIndex, Timeline.Window())
            val start = window?.windowStartTimeMs ?: C.TIME_UNSET
            val length = window?.durationMs ?: C.TIME_UNSET
            val liveWindow = current != null && exo.isCurrentMediaItemLive &&
                start != C.TIME_UNSET && length > 0 &&
                System.currentTimeMillis() - (start + length) in -30_000..90_000
            val time = if (start != C.TIME_UNSET) start + exo.currentPosition else C.TIME_UNSET
            val cue = if (liveWindow) CueWindow(start, start + length, cachedCues).at(time) else null
            val sample = if (station.earnsDemoHum && liveWindow && playing && exo.volume > 0f)
                BroadcastSample(station.mediaId, SystemClock.elapsedRealtime(), time) else null
            Triple(cue, liveWindow, sample)
        } else {
            lastManifest = null
            cachedCues = emptyList()
            Triple(null, false, null)
        }

        // All accounting happens in the Service, not in Activity composition.
        listening = if (prefs.getBoolean("discovered", false) && !earned)
            listening.observe(sample) else Listening()
        if (listening.earned && !earned) {
            prefs.edit().putBoolean("earned", true)
                .putString("hum_receipt", "${station?.mediaId}|${System.currentTimeMillis()}|30000|local-demo")
                .apply()
        }
        val nowEarned = earned || listening.earned
        val status = when {
            station == null && mediaId.startsWith("offline:") && playing -> "Playing clean offline record"
            station == null && mediaId.startsWith("offline:") -> "Offline record paused"
            station == null -> "Choose a frequency."
            exo.playerError != null -> "Signal unavailable. Tune again to retry."
            live && playing -> "Live · ${station.title}"
            !playing -> "Paused or buffering"
            else -> "Waiting for a fresh broadcast signal"
        }
        ReceiverEngineState.snapshot.value = ReceiverSnapshot(station?.mediaId.orEmpty(), cue, playing, live,
            listening.qualifiedMs, nowEarned, status)
    }
}
