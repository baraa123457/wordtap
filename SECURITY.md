# WordTap Security & Production Policy

This document outlines security configurations, origin validation, authentication safeguards, and operational policies for deploying WordTap in production.

---

## 1. Environment Credentials & Roles

| Variable | Purpose | Requirement |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client/anon key with RLS | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged backend key for server-side cache upserts | Recommended in Production |
| `YOUGLISH_API_KEY` | Optional commercial YouGlish REST API v1 key | Optional |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key | Optional |
| `RAPIDAPI_FILMOT_KEY` | Filmot subtitle search API key | Optional |

> **Important**: Never expose `SUPABASE_SERVICE_ROLE_KEY` or `YOUGLISH_API_KEY` to client-side bundles. They must strictly remain server-side environment variables.

---

## 2. Content Security Policy (CSP) & Headers

WordTap enforces strict HTTP response headers configured in `next.config.ts`:
- **Content-Security-Policy**: Restricts media to trusted origins (`https://upload.wikimedia.org`, `blob:`, `data:`), frame embedding to YouTube (`https://www.youtube.com`, `https://www.youtube-nocookie.com`), and blocks untrusted scripts and objects (`object-src 'none'`).
- **X-Frame-Options**: `DENY` to prevent clickjacking.
- **X-Content-Type-Options**: `nosniff`.
- **Referrer-Policy**: `strict-origin-when-cross-origin`.
- **Permissions-Policy**: `camera=(), microphone=(), geolocation=(), browsing-topics=()`.
- **HSTS**: `max-age=63072000; includeSubDomains; preload`.

---

## 3. Video & Media Origin Whitelisting

To protect against SSRF, open redirect, and cross-site media abuse:
- Only media URLs matching `ALLOWED_MEDIA_HOSTS` (`upload.wikimedia.org`, `commons.wikimedia.org`, `youtube.com`, `youtu.be`) are accepted for playback or storage in `vocabulary_video_examples`.
- Video files exceeding 150MB are rejected prior to playback to prevent browser memory exhaustion, seek latency, and excessive user bandwidth consumption.

---

## 4. Spoken Language & Audio Verification Filter

All discovered videos must pass multi-layered filtering before being shown to learners:
1. **Audio Stream Check**: Video container metadata must contain an active audio stream with non-zero channels (rejects silent animations/timelapses).
2. **Spoken Language Verification**: Titles, categories, and descriptions are filtered with `video-language-constants.ts` to block non-English speech (e.g., German, Chinese, French, Spanish) even when English subtitle tracks are present.
3. **Speech Density**: Media must have at least 3 caption cues and 15+ transcript words to eliminate silent showcase reels and brief b-roll fragments.
