# 🎬 WordTap VLC Subtitle Companion

The **WordTap VLC Companion** brings the exact same magical subtitle-tapping experience from YouTube and Netflix to your **offline movies and TV shows playing in VLC Media Player** on Windows.

---

## ⚡ Quick Start (1-Click)

1. Double-click **`run_wordtap_vlc.bat`** in this folder (`vlc-companion/run_wordtap_vlc.bat`).
2. VLC will launch with the WordTap Subtitle API enabled, alongside the transparent floating overlay.
3. Open any video file in VLC (e.g. an episode of a series or movie).
4. If your subtitle file (`.srt` or `.vtt`) is in the same folder as your video with the same name, it is **auto-detected and synced automatically**!
   *(Or click **📂 Open .SRT** on the floating bar to select any subtitle file).*

---

## 🌟 How It Works

* **Clickable Word Chips:** Every word in the subtitle appears as an individual interactive chip with WordTap's signature gold hover glow.
* **Auto-Pause on Click:** Clicking any word **instantly pauses VLC** so the scene doesn't run ahead while you study.
* **Translation Card:**
  * Word + part of speech.
  * Instant Arabic translation.
  * 🔊 **Listen button:** Native text-to-speech audio pronunciation.
  * Sentence context quote.
  * ⭐ **Save to WordTap (+):** Saves the word, definition, context sentence, and movie title directly to your WordTap vocabulary and `wordtap_vlc_saved_words.json`.
* **Seamless Resuming:** Press **Space** or click anywhere outside the card to instantly resume VLC playback!

---

## ⌨️ Hotkeys & Shortcuts

| Key | Action |
| :--- | :--- |
| **Space** | Play / Pause VLC |
| **`[` / `]`** | Shift subtitle sync by **-0.5s / +0.5s** (for out-of-sync subtitles) |
| **`R`** | Replay the current subtitle line from the beginning |
| **`Esc`** | Close translation card and resume video |

---

## ⚙️ Permanent VLC Setup (Optional)

If you prefer to open VLC from your start menu or desktop shortcut instead of `run_wordtap_vlc.bat`:

1. Open **VLC Media Player**.
2. Go to **Tools** → **Preferences** (or press `Ctrl+P`).
3. At the bottom left under *Show settings*, select **All**.
4. In the left sidebar, click **Interface** → **Main interfaces**.
5. Check the box for **Web** (or **HTTP remote control interface**).
6. In the left sidebar, expand **Main interfaces** → click **Lua**.
7. Under *Lua HTTP*, set **Password** to: `wordtap`.
8. Click **Save** and restart VLC.

Now, whenever you run `python wordtap_vlc.py`, it will automatically connect to your regular VLC sessions!

---

## 📦 Native VLC Lua Extension

If you prefer a built-in dockable side panel inside VLC rather than a floating overlay:
1. Double-click **`install_vlc_extension.bat`**.
2. Open VLC → Menu **View** → **WordTap Subtitle Assistant**.
