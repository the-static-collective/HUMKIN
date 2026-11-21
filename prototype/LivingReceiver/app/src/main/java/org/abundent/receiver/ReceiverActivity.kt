package org.abundent.receiver

import android.content.ComponentName
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val recordId = "mutant-pop-04"
private const val recordUrl = "https://humkin.abundent.org/audio/04_Golden_Yellow_Blue.mp3"
private const val recordHash = "f887d7cff16dde882c34ffd19af6b88e2b69e8b661cebab26f3390e5de3258b8"

private fun fetch(url: String, maxBytes: Int): ByteArray {
    val connection = URI(url).toURL().openConnection() as HttpURLConnection
    connection.instanceFollowRedirects = false
    connection.connectTimeout = 8_000
    connection.readTimeout = 8_000
    try {
        check(connection.responseCode == 200)
        return connection.inputStream.use { stream ->
            val output = java.io.ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            while (true) {
                val count = stream.read(buffer)
                if (count < 0) break
                check(output.size() + count <= maxBytes)
                output.write(buffer, 0, count)
            }
            output.toByteArray()
        }
    } finally {
        connection.disconnect()
    }
}

private fun digest(bytes: ByteArray) =
    MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

private fun allowedArtwork(url: String): Boolean = runCatching {
    val parsed = URI(url)
    parsed.scheme == "https" && parsed.host in setOf(
        "humkin.abundent.org", "media.abundent.org", "humkin-long-wave.joyvolcanomusic.workers.dev"
    )
}.getOrDefault(false)

/** UI is a MediaController client; leaving this Activity never stops the radio. */
class ReceiverActivity : ComponentActivity() {
    private var controller by mutableStateOf<MediaController?>(null)
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var connectionError by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { MaterialTheme { Receiver() } }
        val token = SessionToken(this, ComponentName(this, ReceiverPlaybackService::class.java))
        val future = MediaController.Builder(this, token).buildAsync()
        controllerFuture = future
        future.addListener({
            if (isFinishing || isDestroyed) return@addListener
            runCatching { future.get() }
                .onSuccess { controller = it }
                .onFailure { connectionError = "Could not connect to the radio service." }
        }, ContextCompat.getMainExecutor(this))
    }

    override fun onDestroy() {
        controller = null
        controllerFuture?.let { MediaController.releaseFuture(it) }
        controllerFuture = null
        super.onDestroy()
    }

    private fun tune(station: BroadcastStation) {
        val active = controller ?: return
        val item = MediaItem.Builder()
            .setMediaId(station.mediaId)
            .setUri(station.hlsUrl)
            .setMimeType(MimeTypes.APPLICATION_M3U8)
            .setMediaMetadata(MediaMetadata.Builder().setTitle(station.title).setArtist("HUMKIN LIVE").build())
            .build()
        active.repeatMode = Player.REPEAT_MODE_OFF
        active.setMediaItem(item)
        active.prepare()
        active.play()
    }

    private fun playRecord(file: File, repeat: Boolean) {
        val active = controller ?: return
        val item = MediaItem.Builder()
            .setMediaId("offline:$recordId")
            .setUri(Uri.fromFile(file))
            .setMediaMetadata(MediaMetadata.Builder().setTitle("Golden Yellow Blue").setArtist("MUTANT POP").build())
            .build()
        active.repeatMode = if (repeat) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
        active.setMediaItem(item)
        active.prepare()
        active.play()
    }

    @Composable
    private fun Receiver() {
        val prefs = remember { getSharedPreferences("receiver", MODE_PRIVATE) }
        val file = remember { File(filesDir, "$recordId.mp3") }
        val snapshot by ReceiverEngineState.snapshot.collectAsState()
        val active = controller
        val station = BroadcastStation.fromMediaId(snapshot.station)
        val earned = snapshot.earned || prefs.getBoolean("earned", false)
        var found by remember { mutableStateOf(prefs.getBoolean("discovered", false)) }
        var restored by remember { mutableStateOf(prefs.getBoolean("restored", false)) }
        var verified by remember { mutableStateOf(false) }
        var saving by remember { mutableStateOf(false) }
        val scope = rememberCoroutineScope()

        LaunchedEffect(Unit) {
            verified = withContext(Dispatchers.IO) {
                runCatching { file.length() in 1..10_000_000 && digest(file.readBytes()) == recordHash }
                    .getOrDefault(false)
            }
        }

        val cue = snapshot.cue
        val art = cue?.art
        val cover by produceState<android.graphics.Bitmap?>(null, art) {
            value = null
            if (art != null && allowedArtwork(art)) {
                value = withContext(Dispatchers.IO) {
                    runCatching {
                        val bytes = fetch(art, 3_000_000)
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size,
                            BitmapFactory.Options().apply { inSampleSize = 2 })
                    }.getOrNull()
                }
            }
        }

        Column(Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState())
            .padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("HUMKIN", style = MaterialTheme.typography.displaySmall)
            Text("Living Receiver · engineering preview", style = MaterialTheme.typography.titleLarge)
            Text("Service-backed live radio; HUM and Orchard are local demonstration state.",
                style = MaterialTheme.typography.bodySmall)
            BroadcastStation.entries.forEach { entry ->
                OutlinedButton(enabled = active != null, onClick = { tune(entry) }) {
                    Text("Tune to ${entry.title}")
                }
            }
            Text(connectionError ?: if (active == null) "Connecting to radio service…" else snapshot.status)
            if (active != null && active.currentMediaItem != null) {
                OutlinedButton(onClick = { if (snapshot.isPlaying) active.pause() else active.play() }) {
                    Text(if (snapshot.isPlaying) "Pause" else "Resume")
                }
            }
            cover?.let { Image(it.asImageBitmap(), "Now-playing cover artwork", Modifier.size(164.dp)) }
            cue?.let { Text(it.title + " · " + it.artist) }
            station?.scheduleUrl?.let { url ->
                TextButton(onClick = {
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                        .onFailure {
                            android.widget.Toast.makeText(this@ReceiverActivity,
                                "Could not open the cloud schedule.", android.widget.Toast.LENGTH_LONG).show()
                        }
                }) { Text("View published cloud schedule") }
            }
            if (!found && station?.earnsDemoHum == true && snapshot.isPlaying && cue?.id == recordId) {
                Button(onClick = {
                    found = prefs.edit().putBoolean("discovered", true)
                        .putString("discovery_receipt", "${snapshot.station}|$recordId|${cue.atMs}").commit()
                }) { Text("Discover Golden Yellow Blue") }
            }
            HorizontalDivider()
            Text(if (earned) "1 local demo HUM earned" else if (!found)
                "Discover the record to start earning demo HUM"
            else "Earn 1 local demo HUM by continuous live listening · ${snapshot.qualifiedMs / 1000}/30 s")
            Text("Offline record collection", style = MaterialTheme.typography.titleLarge)
            Text(if (found) "Golden Yellow Blue · MUTANT POP" else
                "Discover Golden Yellow Blue on the live dial.")
            if (found && earned && !verified) {
                Button(enabled = !saving, onClick = {
                    saving = true
                    scope.launch {
                        verified = withContext(Dispatchers.IO) {
                            runCatching {
                                val bytes = fetch(recordUrl, 10_000_000)
                                check(digest(bytes) == recordHash)
                                val pending = File(filesDir, "$recordId.part")
                                pending.writeBytes(bytes)
                                java.nio.file.Files.move(pending.toPath(), file.toPath(),
                                    java.nio.file.StandardCopyOption.REPLACE_EXISTING,
                                    java.nio.file.StandardCopyOption.ATOMIC_MOVE)
                                true
                            }.getOrDefault(false)
                        }
                        saving = false
                        if (!verified) android.widget.Toast.makeText(this@ReceiverActivity,
                            "Could not verify the clean download.", android.widget.Toast.LENGTH_LONG).show()
                    }
                }) { Text(if (saving) "Verifying download…" else "Save clean MP3") }
            }
            if (verified) {
                OutlinedButton(enabled = active != null, onClick = { playRecord(file, false) }) {
                    Text("Play clean offline")
                }
            }
            HorizontalDivider()
            Text("Orchard · local preview", style = MaterialTheme.typography.titleLarge)
            Text(if (restored) "Listening room restored locally" else "Listening room closed")
            if (!restored && Orchard.canRestore(earned, if (found) setOf(recordId) else emptySet(),
                    if (verified) setOf(recordId) else emptySet(), recordId)) {
                Button(onClick = {
                    restored = prefs.edit().putBoolean("restored", true)
                        .putString("orchard_receipt", "$recordId|$recordHash|local-preview").commit()
                }) { Text("Restore the listening room") }
            }
            if (restored && verified) {
                Button(enabled = active != null, onClick = { playRecord(file, true) }) {
                    Text("Enter the Orchard rotation")
                }
            }
        }
    }
}
