#!/usr/bin/env python3
"""
WordTap VLC Companion Overlay
-----------------------------
Interactive clickable subtitle overlay for VLC Media Player on Windows.
Allows language learners to click any subtitle word while watching offline
movies and TV series in VLC, get instant Arabic translations, hear native audio,
and save vocabulary directly to their WordTap decks.
"""

import os
import sys
import re
import json
import time
import base64
import bisect
import urllib.request
import urllib.parse
import threading
import subprocess
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import ctypes
from ctypes import wintypes

# ---------------------------------------------------------------------------
# Configuration & Constants
# ---------------------------------------------------------------------------
VLC_HTTP_HOST = "127.0.0.1"
VLC_HTTP_PORT = 8080
VLC_HTTP_PASSWORD = "wordtap"

SUPABASE_URL = "https://vjjilwbhvoxfigrokqch.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_YzMg6sNWjpwwfP2T-apa-Q_c3EHVBNa"
SAVED_WORDS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wordtap_vlc_saved_words.json")
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wordtap_vlc_config.json")

VLC_COMMON_PATHS = [
    r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
    r"C:\Program Files\VideoLAN\VLC\vlc.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\VLC\vlc.exe"),
]

COLOR_KEY = "#000001"       # Windows transparent color key
BG_PILL = "#0B0E17"         # Apple dark mode capsule background
TEXT_MAIN = "#F8FAFC"       # Clean off-white
TEXT_MUTED = "#94A3B8"      # Slate muted
ACCENT_YELLOW = "#FACC3B"   # WordTap signature subtitle yellow
BORDER_COLOR = "#2A334D"    # Subtle pill border
OK_GREEN = "#22C55E"        # Success green

# ---------------------------------------------------------------------------
# VLC HTTP API Client
# ---------------------------------------------------------------------------
class VLCClient:
    def __init__(self, host=VLC_HTTP_HOST, port=VLC_HTTP_PORT, password=VLC_HTTP_PASSWORD):
        self.base_url = f"http://{host}:{port}/requests/status.json"
        auth_bytes = f":{password}".encode("utf-8")
        self.auth_header = f"Basic {base64.b64encode(auth_bytes).decode('ascii')}"

    def get_status(self):
        try:
            req = urllib.request.Request(self.base_url)
            req.add_header("Authorization", self.auth_header)
            with urllib.request.urlopen(req, timeout=1.2) as resp:
                if resp.status == 200:
                    data = resp.read().decode("utf-8", errors="replace")
                    return json.loads(data)
        except Exception:
            return None
        return None

    def send_command(self, cmd_params):
        try:
            url = f"{self.base_url}?{cmd_params}"
            req = urllib.request.Request(url)
            req.add_header("Authorization", self.auth_header)
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                return resp.status == 200
        except Exception:
            return False

    def pause(self):
        return self.send_command("command=pl_pause")

    def play(self):
        return self.send_command("command=pl_play")

    def toggle_play_pause(self):
        return self.send_command("command=pl_pause")

    def seek(self, target_sec):
        return self.send_command(f"command=seek&val={int(target_sec)}")

    def seek_relative(self, delta_sec):
        # VLC seek parameter with + or - seeks relatively
        sign = "+" if delta_sec > 0 else ""
        return self.send_command(f"command=seek&val={sign}{int(delta_sec)}S")

    @staticmethod
    def launch_vlc(video_file=None):
        vlc_exe = None
        for p in VLC_COMMON_PATHS:
            if os.path.isfile(p):
                vlc_exe = p
                break
        if not vlc_exe:
            return False, "Could not find vlc.exe in standard Program Files locations."

        args = [
            vlc_exe,
            "--extraintf", "http",
            "--http-password", VLC_HTTP_PASSWORD,
            "--http-port", str(VLC_HTTP_PORT),
        ]
        if video_file and os.path.isfile(video_file):
            args.append(video_file)

        try:
            subprocess.Popen(args)
            return True, "VLC started with WordTap HTTP API enabled."
        except Exception as e:
            return False, str(e)


# ---------------------------------------------------------------------------
# Subtitle Parsing & Sync Engine
# ---------------------------------------------------------------------------
class SubtitleCue:
    def __init__(self, start_sec, end_sec, text):
        self.start_sec = start_sec
        self.end_sec = end_sec
        self.text = text

    def __lt__(self, other):
        return self.start_sec < (other.start_sec if isinstance(other, SubtitleCue) else other)

class SubtitleManager:
    def __init__(self):
        self.cues = []
        self.cue_starts = []
        self.current_file = None
        self.offset_sec = 0.0

    def parse_time(self, t_str):
        t_str = t_str.strip().replace(",", ".")
        parts = t_str.split(":")
        if len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        return 0.0

    def load_file(self, filepath):
        if not os.path.isfile(filepath):
            return False
        try:
            with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
                content = f.read()
        except Exception:
            return False

        cues = []
        # Support both SRT and VTT
        blocks = re.split(r"\n\s*\n", content.strip())
        for b in blocks:
            lines = [l.strip() for l in b.split("\n") if l.strip()]
            time_idx = -1
            for idx, l in enumerate(lines):
                if "-->" in l:
                    time_idx = idx
                    break
            if time_idx >= 0:
                parts = lines[time_idx].split("-->")
                start_sec = self.parse_time(parts[0].split()[0])
                end_sec = self.parse_time(parts[1].split()[0])
                text_lines = lines[time_idx + 1:]
                clean_text = " ".join(text_lines)
                clean_text = re.sub(r"<[^>]+>", "", clean_text) # strip HTML tags
                clean_text = re.sub(r"\{[^\}]+\}", "", clean_text) # strip ASS tags
                clean_text = clean_text.replace("\r", " ").strip()
                if clean_text:
                    cues.append(SubtitleCue(start_sec, end_sec, clean_text))

        cues.sort(key=lambda c: c.start_sec)
        self.cues = cues
        self.cue_starts = [c.start_sec for c in cues]
        self.current_file = filepath
        return len(cues) > 0

    def find_cue(self, current_sec):
        if not self.cues:
            return None
        effective_sec = current_sec + self.offset_sec

        # Binary search
        idx = bisect.bisect_right(self.cue_starts, effective_sec) - 1
        if 0 <= idx < len(self.cues):
            cue = self.cues[idx]
            if cue.start_sec <= effective_sec <= cue.end_sec:
                return cue
        # Also check nearby cue if slight overlap
        if idx + 1 < len(self.cues):
            next_cue = self.cues[idx + 1]
            if next_cue.start_sec <= effective_sec <= next_cue.end_sec:
                return next_cue
        return None

    def auto_detect_subtitle(self, video_path):
        if not video_path:
            return False
        base, _ = os.path.splitext(video_path)
        candidates = [
            base + ".srt",
            base + ".en.srt",
            base + ".vtt",
            base + ".en.vtt",
        ]
        # Also check folder for any .srt file if single subtitle exists
        dir_name = os.path.dirname(video_path)
        if os.path.isdir(dir_name):
            try:
                for f in os.listdir(dir_name):
                    if f.lower().endswith((".srt", ".vtt")):
                        candidates.append(os.path.join(dir_name, f))
            except Exception:
                pass

        for c in candidates:
            if os.path.isfile(c):
                if self.load_file(c):
                    return True
        return False


# ---------------------------------------------------------------------------
# Translation & TTS Helper
# ---------------------------------------------------------------------------
class Translator:
    @staticmethod
    def clean_word(token):
        return re.sub(r"^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$", "", token).strip()

    @staticmethod
    def translate(word, target_lang="ar"):
        clean = Translator.clean_word(word)
        if not clean:
            return "", ""

        # Query Google Translate API
        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl={target_lang}&dt=t&dt=bd&dt=rm&q={urllib.parse.quote(clean)}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                trans = data[0][0][0]
                pos = ""
                if len(data) > 1 and data[1] and len(data[1]) > 0:
                    pos = data[1][0][0] # e.g. "noun", "verb"
                return trans, pos
        except Exception:
            return "مترجم (Offline)", ""

    @staticmethod
    def speak(word):
        # Native Windows Speech synthesis (fast, zero external deps)
        clean = Translator.clean_word(word)
        if not clean:
            return
        ps_cmd = (
            f"Add-Type -AssemblyName System.Speech; "
            f"$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            f"$s.Rate = 0; "
            f"$s.Speak('{clean}')"
        )
        try:
            subprocess.Popen(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# WordTap Account & Vocabulary Storage
# ---------------------------------------------------------------------------
class WordTapStorage:
    @staticmethod
    def save_word(word, translation, sentence="", source_title="VLC Player"):
        entry = {
            "text": word,
            "translation": translation,
            "sentence": sentence,
            "source_title": source_title,
            "saved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "box": 0,
            "src_lang": "en",
            "target_lang": "ar"
        }

        # 1. Save to local JSON file
        words = []
        if os.path.isfile(SAVED_WORDS_FILE):
            try:
                with open(SAVED_WORDS_FILE, "r", encoding="utf-8") as f:
                    words = json.load(f)
            except Exception:
                words = []

        # Deduplicate
        existing_idx = next((i for i, w in enumerate(words) if w.get("text", "").lower() == word.lower()), None)
        if existing_idx is not None:
            words[existing_idx] = entry
        else:
            words.insert(0, entry)

        try:
            with open(SAVED_WORDS_FILE, "w", encoding="utf-8") as f:
                json.dump(words, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

        # 2. Sync to Supabase if token configured
        config = WordTapStorage.load_config()
        token = config.get("supabase_token")
        if token:
            def sync_worker():
                try:
                    payload = json.dumps({
                        "p_text": word,
                        "p_translation": translation,
                        "p_sentence": sentence,
                        "p_source_title": source_title,
                        "p_src_lang": "en",
                        "p_target_lang": "ar",
                        "p_times": 1
                    }).encode("utf-8")
                    req = urllib.request.Request(
                        f"{SUPABASE_URL}/rest/v1/rpc/save_word",
                        data=payload,
                        headers={
                            "apikey": SUPABASE_ANON_KEY,
                            "Authorization": f"Bearer {token}",
                            "Content-Type": "application/json"
                        }
                    )
                    urllib.request.urlopen(req, timeout=5)
                except Exception:
                    pass
            threading.Thread(target=sync_worker, daemon=True).start()

        return True

    @staticmethod
    def load_config():
        if os.path.isfile(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    @staticmethod
    def save_config(cfg):
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Windows Window Tracker
# ---------------------------------------------------------------------------
class RECT(ctypes.Structure):
    _fields_ = [
        ("left", wintypes.LONG),
        ("top", wintypes.LONG),
        ("right", wintypes.LONG),
        ("bottom", wintypes.LONG),
    ]

def find_vlc_window():
    user32 = ctypes.windll.user32
    found_hwnd = None

    def enum_cb(hwnd, _):
        nonlocal found_hwnd
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buf, length + 1)
                title = buf.value
                if "VLC media player" in title or title.endswith("- VLC"):
                    found_hwnd = hwnd
                    return False
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
    return found_hwnd

def get_window_bounds(hwnd):
    if not hwnd:
        return None
    user32 = ctypes.windll.user32
    rect = RECT()
    if user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        w = rect.right - rect.left
        h = rect.bottom - rect.top
        return rect.left, rect.top, w, h
    return None


# ---------------------------------------------------------------------------
# Main Interactive Floating Overlay UI
# ---------------------------------------------------------------------------
class WordTapOverlayApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("WordTap VLC Subtitles")
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)

        # Transparency setup on Windows
        try:
            self.root.attributes("-transparentcolor", COLOR_KEY)
        except Exception:
            pass
        self.root.config(bg=COLOR_KEY)

        self.vlc = VLCClient()
        self.sub_mgr = SubtitleManager()
        self.current_cue = None
        self.last_media_filename = None
        self.card_window = None

        self.setup_ui()
        self.running = True

        # Polling thread
        self.poll_thread = threading.Thread(target=self.vlc_polling_loop, daemon=True)
        self.poll_thread.start()

        # Keyboard shortcuts
        self.root.bind("<space>", lambda e: self.vlc.toggle_play_pause())
        self.root.bind("<bracketleft>", lambda e: self.adjust_offset(-0.5))
        self.root.bind("<bracketright>", lambda e: self.adjust_offset(+0.5))
        self.root.bind("<r>", lambda e: self.replay_current_cue())

    def setup_ui(self):
        self.main_container = tk.Frame(self.root, bg=COLOR_KEY)
        self.main_container.pack(fill="both", expand=True)

        # Control / Status Top Pill
        self.top_bar = tk.Frame(self.main_container, bg=BG_PILL, padx=10, pady=4)
        self.top_bar.pack(side="top", pady=(0, 4))

        self.logo_label = tk.Label(
            self.top_bar,
            text="WordTap VLC",
            font=("Segoe UI", 9, "bold"),
            fg=ACCENT_YELLOW,
            bg=BG_PILL,
        )
        self.logo_label.pack(side="left", padx=(0, 8))

        self.status_label = tk.Label(
            self.top_bar,
            text="Waiting for VLC...",
            font=("Segoe UI", 8),
            fg=TEXT_MUTED,
            bg=BG_PILL,
        )
        self.status_label.pack(side="left", padx=4)

        self.open_sub_btn = tk.Button(
            self.top_bar,
            text="📂 Open .SRT",
            font=("Segoe UI", 8, "bold"),
            fg=TEXT_MAIN,
            bg="#1E2638",
            activebackground=ACCENT_YELLOW,
            activeforeground="#000000",
            relief="flat",
            padx=6,
            pady=1,
            cursor="hand2",
            command=self.manual_open_subtitles,
        )
        self.open_sub_btn.pack(side="left", padx=4)

        self.offset_label = tk.Label(
            self.top_bar,
            text="Sync: 0.0s",
            font=("Segoe UI", 8),
            fg=TEXT_MUTED,
            bg=BG_PILL,
        )
        self.offset_label.pack(side="left", padx=4)

        self.launch_vlc_btn = tk.Button(
            self.top_bar,
            text="▶ Launch VLC",
            font=("Segoe UI", 8, "bold"),
            fg="#000000",
            bg=ACCENT_YELLOW,
            activebackground="#E5B82E",
            relief="flat",
            padx=8,
            pady=1,
            cursor="hand2",
            command=self.launch_vlc_action,
        )
        self.launch_vlc_btn.pack(side="left", padx=4)

        self.close_btn = tk.Button(
            self.top_bar,
            text="✕",
            font=("Segoe UI", 8, "bold"),
            fg=TEXT_MUTED,
            bg=BG_PILL,
            activeforeground="#FF5555",
            relief="flat",
            cursor="hand2",
            command=self.root.quit,
        )
        self.close_btn.pack(side="right", padx=(8, 0))

        # Interactive Subtitle Pill Container
        self.sub_pill_frame = tk.Frame(
            self.main_container,
            bg=BG_PILL,
            padx=18,
            pady=8,
            highlightthickness=1,
            highlightbackground=BORDER_COLOR,
        )
        self.sub_pill_frame.pack(side="bottom", fill="x")

        self.words_frame = tk.Frame(self.sub_pill_frame, bg=BG_PILL)
        self.words_frame.pack(anchor="center")

        # Initial instruction
        self.welcome_label = tk.Label(
            self.words_frame,
            text="Open any movie in VLC to tap subtitle words",
            font=("Segoe UI", 12, "bold"),
            fg=TEXT_MUTED,
            bg=BG_PILL,
        )
        self.welcome_label.pack(side="left")

    def adjust_offset(self, delta):
        self.sub_mgr.offset_sec += delta
        self.offset_label.config(text=f"Sync: {self.sub_mgr.offset_sec:+.1f}s")

    def replay_current_cue(self):
        if self.current_cue:
            self.vlc.seek(max(0, self.current_cue.start_sec - 0.2))

    def launch_vlc_action(self):
        ok, msg = VLCClient.launch_vlc()
        if not ok:
            messagebox.showwarning("VLC Setup", msg)
        else:
            self.status_label.config(text="VLC launched. Play a video!")

    def manual_open_subtitles(self):
        file_path = filedialog.askopenfilename(
            title="Select Subtitle File (.srt, .vtt)",
            filetypes=[("Subtitle Files", "*.srt;*.vtt"), ("All Files", "*.*")],
        )
        if file_path:
            if self.sub_mgr.load_file(file_path):
                filename = os.path.basename(file_path)
                self.status_label.config(text=f"Loaded: {filename}")
            else:
                messagebox.showerror("Error", "Could not parse selected subtitle file.")

    def render_subtitle(self, cue):
        if self.current_cue == cue:
            return
        self.current_cue = cue

        # Clear existing words
        for w in self.words_frame.winfo_children():
            w.destroy()

        if not cue or not cue.text:
            return

        tokens = cue.text.split()
        for token in tokens:
            clean = Translator.clean_word(token)
            if not clean:
                lbl = tk.Label(self.words_frame, text=token, font=("Segoe UI", 15), fg=TEXT_MAIN, bg=BG_PILL)
                lbl.pack(side="left", padx=1)
                continue

            # Clickable word chip
            btn = tk.Label(
                self.words_frame,
                text=token,
                font=("Segoe UI", 15, "bold"),
                fg=TEXT_MAIN,
                bg=BG_PILL,
                cursor="hand2",
                padx=3,
                pady=1,
            )
            btn.pack(side="left", padx=1)

            # Hover effects
            btn.bind("<Enter>", lambda e, b=btn: b.config(fg=ACCENT_YELLOW))
            btn.bind("<Leave>", lambda e, b=btn: b.config(fg=TEXT_MAIN))
            btn.bind("<Button-1>", lambda e, w=clean, full=cue.text, source=btn: self.on_word_click(w, full, source))

    def on_word_click(self, word, full_sentence, source_widget):
        # 1. Immediately pause VLC so user can study the word
        self.vlc.pause()

        # 2. Pronounce word via native audio
        Translator.speak(word)

        # 3. Position and show WordTap Translation Popover Card
        self.show_word_card(word, full_sentence, source_widget)

    def show_word_card(self, word, full_sentence, source_widget):
        if self.card_window and tk.Toplevel.winfo_exists(self.card_window):
            self.card_window.destroy()

        card = tk.Toplevel(self.root)
        self.card_window = card
        card.overrideredirect(True)
        card.attributes("-topmost", True)
        card.config(bg="#13192B", highlightthickness=2, highlightbackground=ACCENT_YELLOW)

        # Card content
        inner = tk.Frame(card, bg="#13192B", padx=14, pady=12)
        inner.pack(fill="both", expand=True)

        header_row = tk.Frame(inner, bg="#13192B")
        header_row.pack(fill="x", pady=(0, 4))

        word_lbl = tk.Label(header_row, text=word, font=("Segoe UI", 14, "bold"), fg=TEXT_MAIN, bg="#13192B")
        word_lbl.pack(side="left")

        audio_btn = tk.Button(
            header_row,
            text="🔊 Listen",
            font=("Segoe UI", 8, "bold"),
            fg=ACCENT_YELLOW,
            bg="#1E2638",
            activebackground=ACCENT_YELLOW,
            activeforeground="#000000",
            relief="flat",
            padx=6,
            pady=1,
            cursor="hand2",
            command=lambda: Translator.speak(word),
        )
        audio_btn.pack(side="left", padx=8)

        close_btn = tk.Button(
            header_row,
            text="✕",
            font=("Segoe UI", 9, "bold"),
            fg=TEXT_MUTED,
            bg="#13192B",
            activeforeground="#FF5555",
            relief="flat",
            cursor="hand2",
            command=lambda: self.close_card_and_resume(card),
        )
        close_btn.pack(side="right")

        # Translation
        trans_lbl = tk.Label(inner, text="Translating…", font=("Segoe UI", 13, "bold"), fg=ACCENT_YELLOW, bg="#13192B")
        trans_lbl.pack(anchor="w", pady=(2, 4))

        # Sentence context
        sent_frame = tk.Frame(inner, bg="#0B0E17", padx=8, pady=6)
        sent_frame.pack(fill="x", pady=4)
        sent_lbl = tk.Label(
            sent_frame,
            text=f"“{full_sentence}”",
            font=("Segoe UI", 9, "italic"),
            fg=TEXT_MUTED,
            bg="#0B0E17",
            wraplength=280,
            justify="left",
        )
        sent_lbl.pack(anchor="w")

        # Save Button
        save_btn = tk.Button(
            inner,
            text="⭐ Save to WordTap (+)",
            font=("Segoe UI", 9, "bold"),
            fg="#000000",
            bg=ACCENT_YELLOW,
            activebackground="#E5B82E",
            relief="flat",
            padx=10,
            pady=5,
            cursor="hand2",
            command=lambda: self.save_word_action(word, trans_lbl.cget("text"), full_sentence, save_btn),
        )
        save_btn.pack(fill="x", pady=(6, 2))

        resume_lbl = tk.Label(
            inner,
            text="Press Space or Close to resume video",
            font=("Segoe UI", 7),
            fg=TEXT_MUTED,
            bg="#13192B",
        )
        resume_lbl.pack(pady=(4, 0))

        # Position card directly above clicked word
        self.root.update_idletasks()
        card.update_idletasks()
        rx = source_widget.winfo_rootx()
        ry = source_widget.winfo_rooty() - card.winfo_reqheight() - 8
        card.geometry(f"+{max(10, rx - 40)}+{max(10, ry)}")

        # Fetch translation asynchronously
        def fetch_trans():
            tr, pos = Translator.translate(word)
            display_text = f"{tr} ({pos})" if pos else tr
            if card.winfo_exists():
                trans_lbl.config(text=display_text or "No translation found")

        threading.Thread(target=fetch_trans, daemon=True).start()

        # Keyboard shortcuts inside card
        card.bind("<space>", lambda e: self.close_card_and_resume(card))
        card.bind("<Escape>", lambda e: self.close_card_and_resume(card))

    def save_word_action(self, word, translation, sentence, btn):
        title = self.last_media_filename or "VLC Movie"
        WordTapStorage.save_word(word, translation, sentence, title)
        btn.config(text="✓ Saved to Decks!", bg=OK_GREEN, fg="#FFFFFF")

    def close_card_and_resume(self, card):
        if card and card.winfo_exists():
            card.destroy()
        self.card_window = None
        self.vlc.play()

    def vlc_polling_loop(self):
        while self.running:
            status = self.vlc.get_status()
            if status:
                current_time = status.get("time", 0)
                state = status.get("state", "stopped")

                # Detect media file change
                info = status.get("information", {}).get("category", {}).get("meta", {})
                filename = info.get("filename") or info.get("title")

                if filename and filename != self.last_media_filename:
                    self.last_media_filename = filename
                    # Try auto-detecting subtitles in the same directory
                    filepath = info.get("filepath")
                    if filepath and self.sub_mgr.auto_detect_subtitle(filepath):
                        self.root.after(0, lambda fn=filename: self.status_label.config(text=f"Sync: {fn[:30]}…"))
                    else:
                        self.root.after(0, lambda fn=filename: self.status_label.config(text=f"Playing: {fn[:25]}… (Load .SRT)"))

                # Update subtitles if playing
                if state in ("playing", "paused") and self.sub_mgr.cues:
                    cue = self.sub_mgr.find_cue(current_time)
                    self.root.after(0, lambda c=cue: self.render_subtitle(c))
                elif state == "stopped":
                    self.root.after(0, lambda: self.render_subtitle(None))

            # Auto-align overlay with VLC Window
            self.root.after(0, self.sync_window_position)
            time.sleep(0.12)

    def sync_window_position(self):
        hwnd = find_vlc_window()
        if hwnd:
            bounds = get_window_bounds(hwnd)
            if bounds:
                vx, vy, vw, vh = bounds
                if vw > 300 and vh > 200:
                    overlay_w = min(max(int(vw * 0.88), 450), 960)
                    overlay_h = 105
                    overlay_x = vx + (vw - overlay_w) // 2
                    overlay_y = vy + vh - overlay_h - 25
                    self.root.geometry(f"{overlay_w}x{overlay_h}+{overlay_x}+{overlay_y}")
                    self.root.deiconify()
                    return
        # If VLC not found, place centered at bottom of primary display
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        w = 640
        h = 100
        x = (sw - w) // 2
        y = sh - h - 50
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def run(self):
        self.root.mainloop()
        self.running = False


if __name__ == "__main__":
    app = WordTapOverlayApp()
    app.run()
