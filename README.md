# WordTap

Two parts that share one Supabase project:

- `extension/` — Chrome extension. Click a subtitle word on YouTube or Netflix to translate it; every word is saved to the signed-in user's account.
- `web/` — Next.js 15 site (TypeScript, Tailwind v4, Supabase). Accounts, saved words, and Duolingo-style practice.

## 1. Supabase

1. Create a project at supabase.com.
2. SQL editor: run `web/supabase/migrations/001_wordtap.sql`. It creates `words` and `user_stats`, row level security, and the functions `save_word`, `review_word`, `record_practice`, `set_daily_goal`.
3. Authentication → Providers → Email is on by default. If you leave "Confirm email" on, new users must click the link before they can sign in (the site and the extension both show the error). Turn it off while developing if you prefer.
4. Project settings → API: copy the **Project URL** and the **anon public key**.

## 2. Website

```bash
cd web
cp .env.example .env.local      # paste the URL and anon key
npm install
npm run dev                     # http://localhost:3000
```

Checks used for every milestone:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Build note: fonts come from the `@fontsource-variable/readex-pro` package, so the build needs no network access to Google Fonts.

## 3. Extension

1. Edit `extension/config.js`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `WEBSITE_URL` (where the site is hosted).
2. Chrome → `chrome://extensions` → Developer mode → Load unpacked → pick `extension/`.
3. Click the toolbar icon, sign in with the account you created on the website.

If you use a custom Supabase domain, add it to `host_permissions` in `extension/manifest.json`.

To offer the extension for download on the site, zip the **configured** `extension/` folder as `web/public/wordtap-extension.zip` (the Extension page links to it). The zip shipped in this project still has the placeholder values in `config.js`; replace it after you fill them in.

## How it works

**Saving.** Each tap is written to the device first, then sent to Supabase through the `save_word` function. If the user is signed out or offline, the word waits in a queue and is uploaded after the next sign-in or sync. Saving the same word again (any capitalisation) raises its counter instead of adding a duplicate.

**Practice.** A session picks up to 8 words, due ones first and weakest first. Question types: choose the translation, choose the word, type the answer (small typos and Arabic letter variants are accepted), listen and choose (browser speech, only when the language is known), and one matching round. A missed question comes back once at the end.

**Spaced repetition.** Leitner boxes 0–5. A correct first answer moves a word up one box and schedules it after 1, 3, 7, 14 or 30 days; a wrong one moves it down and makes it due again immediately. Only the first answer per word per session counts.

**XP and streak.** 10 XP for a first-try answer, 5 for a retry or a matching round with mistakes. The streak follows the learner's local date.

## Notes

- Translation uses Google's free web endpoint, which is unofficial and may be rate limited. For production, switch the one `fetch` in `extension/background.js` to the official Cloud Translation API.
- The UI is English. Arabic words display correctly (right-to-left per word), but the interface itself is not translated yet.
