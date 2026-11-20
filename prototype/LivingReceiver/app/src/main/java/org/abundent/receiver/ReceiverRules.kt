package org.abundent.receiver

// Pure, monotonic playback accounting. A qualified session is one uninterrupted
// station's advancing audible playback; it is never banked across interruptions.
data class BroadcastSample(val station: String, val wallMs: Long, val audioMs: Long)

data class Listening(val qualifiedMs: Long = 0, val previous: BroadcastSample? = null) {
    fun observe(sample: BroadcastSample?): Listening {
        val before = previous
        if (sample == null) return Listening()
        if (before == null || sample.station != before.station) return Listening(previous = sample)
        val elapsed = sample.wallMs - before.wallMs
        val advanced = sample.audioMs - before.audioMs
        // Missing heartbeat, stalled playback, backward movement and seeks
        // all break the uninterrupted listening period.
        val valid = elapsed in 1..2_000 && advanced in 1..(elapsed + 250)
        return if (valid) Listening((qualifiedMs + minOf(elapsed, advanced)).coerceAtMost(30_000), sample)
        else Listening(previous = sample)
    }

    val earned: Boolean get() = qualifiedMs >= 30_000
}

data class Cue(val atMs: Long, val id: String, val title: String, val artist: String, val art: String)
data class CueWindow(val startMs: Long, val endMs: Long, val cues: List<Cue>) {
    fun at(playhead: Long): Cue? =
        if (playhead in startMs until endMs) cues.filter { it.atMs <= playhead }.maxByOrNull { it.atMs }
        else null
}

// HLS permits order-independent attributes and other attributes on a DATERANGE.
object CueAttributes {
    private val quoted = Regex("([A-Z0-9-]+)=\"([^\"]*)\"")
    fun fromTag(tag: String): Map<String, String>? {
        if (!tag.startsWith("#EXT-X-DATERANGE:")) return null
        return quoted.findAll(tag.substringAfter(':')).associate { it.groupValues[1] to it.groupValues[2] }
            .takeIf { it["CLASS"] == "org.abundent.humkin.track" && it.containsKey("START-DATE") && it.containsKey("X-HUMKIN") }
    }
}

object Orchard {
    fun canRestore(earned: Boolean, discovered: Set<String>, verified: Set<String>, id: String) =
        earned && id in discovered && id in verified
}
