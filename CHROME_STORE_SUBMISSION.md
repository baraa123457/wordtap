# WordTap Chrome Web Store Submission Guide

## 1. Extension Name & Store Metadata
- **Name:** WordTap: Subtitle Vocabulary Builder
- **Short Name:** WordTap
- **Category:** Education / Productivity
- **Primary Language:** English
- **Website URL:** https://wordtap.vercel.app

---

## 2. Manifest Permissions & Justifications (Reduced to Minimum)

| Permission | Why it is strictly required |
| :--- | :--- |
| `storage` | Stores user's preferred target language (e.g. Arabic), selection trigger mode, and queued offline vocabulary for syncing. |
| `activeTab` | Allows WordTap to inspect subtitles and take screen OCR captures on the currently active streaming tab when the user clicks or presses Alt+S. |
| `scripting` | Injects subtitle listener and floating translation cards into active video player frames. |
| `contextMenus` | Adds the optional right-click "Translate with WordTap" context menu item. |

### Host Permissions Justification:
- `https://translate.googleapis.com/*`: Fetches direct translation results and parts of speech without intermediate proxies.
- `https://*.supabase.co/*`: Syncs saved vocabulary words, Leitner spaced repetition boxes, and user streaks to the learner's secure WordTap cloud account.
- `https://api.ocr.space/*`: Fallback OCR engine when extracting text from hardcoded video subtitles via Alt+S screen capture.

---

## 3. Chrome Web Store Description Draft

**Summary (up to 132 characters):**
Turn words from YouTube & Netflix subtitles into English vocabulary that actually sticks, with instant Arabic translations and smart practice.

**Detailed Description:**
Ever watched an episode of your favorite show, heard a great phrase or word, and forgotten it ten minutes later? 

WordTap bridges the gap between passive entertainment and active language acquisition. Designed specifically for Arabic speakers learning English through streaming video, WordTap turns every subtitle into a clickable learning opportunity.

🌟 KEY FEATURES:
• **One-Click Subtitle Translation:** Click any unfamiliar word in YouTube or Netflix subtitles to get an instant, accurate translation in Arabic without pausing or losing your place.
• **Full Sentence Context:** WordTap captures not just the isolated word, but the exact subtitle sentence where you found it, so you learn real colloquial usage.
• **Seamless Cloud Sync:** Every word you save syncs immediately to your WordTap dashboard at https://wordtap.vercel.app.
• **SRS Practice Sessions:** Review your saved words in quick 5-10 question practice rounds (multiple choice, typing, matching, and listening). Words you struggle with return sooner until you achieve true mastery.
• **Screen OCR (Alt+S):** For videos with hard-coded or non-selectable captions, use Alt+S to snap any area on screen for immediate text recognition and translation.
• **100% Privacy-Respecting:** We only read subtitles when you click a word. We never track your browsing history, searches, or passwords. Your saved words stay yours and can be exported as CSV anytime.

HOW TO USE:
1. Install WordTap and click the puzzle icon in your browser toolbar to log in.
2. Open YouTube or Netflix, play any video, and enable subtitles.
3. Click any English word in the captions to view its Arabic meaning and save it to your library!

---

## 4. Screenshots You Need to Capture (Assets Checklist)
Chrome Web Store requires 1280x800px or 640x400px images (PNG or JPEG):

1. **Screenshot 1 — In-Video Subtitle Click (YouTube/Netflix):**
   - Video playing in background with a clear subtitle showing.
   - The WordTap dark card active over a clicked word (e.g. "Integrity" -> "نزاهة") with the golden "★ Save" button.
2. **Screenshot 2 — Extension Toolbar Popup:**
   - The popup open showing: "Signed in as [your email]", today's due count, current streak, and target language dropdown set to "العربية (Arabic)".
3. **Screenshot 3 — Web Dashboard & Word Library (https://wordtap.vercel.app/words):**
   - The "My Words" library showing saved English words with Arabic translations, Leitner Box indicators (Box 1 to Box 5), and source show badges.
4. **Screenshot 4 — Practice Session in Action (https://wordtap.vercel.app/practice):**
   - An active multiple-choice or typing exercise with audio speaker icon, showing immediate positive feedback.
5. **Small Promo Tile (440x280px):**
   - WordTap logo with subtitle: "Learn English from the shows you love".
