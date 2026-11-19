# HUMKIN Tower on the Acer

Tower is the local broadcast console for HUMKIN. It opens in a browser on the Acer and runs alongside the station's HLS encoder. One media crate serves all frequencies on that computer. Each has its own queue, rotation settings and broadcast.

## Open the Tower

Use the complete updated HUMKIN checkout. If the earlier Station One version is running, stop it with its existing `STOP-HUMKIN-LIVE.cmd` and wait for it to exit. Run `tools\radio-broadcast\windows\START-HUMKIN-LIVE.cmd` from the new checkout. The existing Windows R2 vault is reused. Open `OPEN-HUMKIN-TOWER.cmd` from the same folder once the publisher starts.

- **Upload & queue** accepts multiple audio files and places them in the selected frequency's queue. The crate keeps the original files, deduplicates identical audio by hash, and reads existing title, artist, album and embedded cover tags.
- **Coming up** shows the manually queued tracks first, then the active show or automatic rotation. Drag tracks or use the arrow buttons within each lane. **Queue this show for editing** lets you run a reordered copy of its upcoming sequence.
- **Play next**, **Skip now**, **Hold**, **Disable**, and rotation weight controls operate while the encoder runs. Use **Add to rotation** to bring an uploaded track into that frequency's recurring mix.
- **Send to frequency** queues the same crate item on another running frequency. Its current track and queue are independent.

## Start another frequency

Run these PowerShell commands from the checkout. Replace `talk` with the frequency's lowercase name. Each active frequency runs its own encoder and publisher on the Acer.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\radio-broadcast\windows\station-one.ps1 -Action StartR2 -Frequency talk
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\radio-broadcast\windows\station-one.ps1 -Action LiveStatus -Frequency talk
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\radio-broadcast\windows\station-one.ps1 -Action StopR2 -Frequency talk
```

Deploy the updated [HLS Worker](R2-LIVE-HLS.md) before using secondary public frequencies or serving embedded covers from uploaded files. A frequency named `talk` is available at `https://humkin.abundent.org/fm/?frequency=talk` after the website update. Station One keeps its existing URLs. Both frequencies keep the normal listener fallback chain.

## Verify live metadata

The Acer marks transitions by the count of PCM samples sent to the encoder. At a crossfade, the title changes at the midpoint. The R2 publisher adds those cues to the manifest alongside completed audio segments. The website uses each listener's playback position, so two listeners buffered differently can see different titles at the same moment. A missing cover uses the station image.

Tune in from a second device and watch a track transition with distinct covers. Move an upcoming track and repeat. The R2 Worker also exposes the latest completed cue at `/hls/now-playing` and `/hls/<frequency>/now-playing` for other clients. That endpoint follows the edge of the published audio, and the browser times its display with the listener's own playhead.

