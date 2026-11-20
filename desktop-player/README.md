# 🎬 WordTap Desktop Video Player

A dedicated standalone offline video player for Windows (built with Electron) featuring **interactive subtitle words**, instant Arabic translation, TTS audio pronunciation, and seamless cloud synchronization with your **WordTap** account.

---

## ✨ Features

- **🎬 Offline Video Playback:** Play any local video file (`.mp4`, `.mkv`, `.webm`, `.avi`, `.mov`) with full hardware acceleration.
- **✨ Interactive Subtitle Chips:** Subtitles (`.srt`, `.vtt`) render as individual, clickable word chips. Hover over any word to highlight with WordTap gold (`#FACC3B`).
- **⏸️ Smart Auto-Pause:** Clicking any word instantly auto-pauses playback so you never lose your place.
- **📖 Instant Arabic Translation & Definitions:** Translates the clicked word into Arabic, shows parts of speech (noun, verb, etc.), and displays sentence context.
- **🔊 Native Audio Pronunciation:** High-quality text-to-speech audio for every clicked word.
- **⭐ Cloud Sync to WordTap:** Save words directly to your WordTap flashcards deck via Supabase with one click.
- **↺ Replay Line (`S`):** Instantly jump back to the start of the current subtitle line to re-listen to the sentence.
- **⏱️ Subtitle Sync Adjuster (`[` / `]`):** Fine-tune subtitle delay by `±100ms` on the fly.
- **⚡ Native Windows Launcher:** Launch directly via `run_player.bat` or `Start WordTap Player.bat`.

---

## 🚀 How to Run

Simply double-click:
```bash
Start WordTap Player.bat
```
*(or run `desktop-player\run_player.bat`)*

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause (or close word card and resume) |
| `S` | ↺ Replay current subtitle line |
| `Left Arrow` | Rewind 5 seconds |
| `Right Arrow` | Forward 5 seconds |
| `[` | Subtitle sync delay -100ms |
| `]` | Subtitle sync delay +100ms |
| `C` | Toggle subtitles on/off |
| `M` | Mute / Unmute audio |
| `Up / Down` | Volume up / down (5%) |
| `F` | Toggle fullscreen |
| `Esc` | Close word card or dialog |
