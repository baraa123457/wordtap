// WordTap VLC Player - Core Renderer Script
(() => {
  const SUPABASE_URL = "https://vjjilwbhvoxfigrokqch.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_YzMg6sNWjpwwfP2T-apa-Q_c3EHVBNa";
  const WEBSITE_URL = "https://wordtap.vercel.app";

  // Elements
  const video = document.getElementById('main-video');
  const dropZone = document.getElementById('drop-zone');
  const nowPlayingTitle = document.getElementById('now-playing-title');
  const subtitleContainer = document.getElementById('subtitle-container');
  const wordPopover = document.getElementById('word-popover');
  const toastEl = document.getElementById('toast');

  // Controls
  const btnPlayPause = document.getElementById('btn-play-pause');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const btnReplayLine = document.getElementById('btn-replay-line');
  const btnSeekBack = document.getElementById('btn-seek-back');
  const btnSeekFwd = document.getElementById('btn-seek-fwd');
  const currentTimeEl = document.getElementById('current-time');
  const totalDurationEl = document.getElementById('total-duration');
  const scrubberContainer = document.getElementById('scrubber-container');
  const scrubberPlayed = document.getElementById('scrubber-played');
  const scrubberBuffer = document.getElementById('scrubber-buffer');
  const scrubberThumb = document.getElementById('scrubber-thumb');
  const timeTooltip = document.getElementById('time-tooltip');
  const btnSpeed = document.getElementById('btn-speed');
  const btnToggleSub = document.getElementById('btn-toggle-sub');
  const btnMute = document.getElementById('btn-mute');
  const iconVolHigh = document.getElementById('icon-vol-high');
  const iconVolMute = document.getElementById('icon-vol-mute');
  const volumeSlider = document.getElementById('volume-slider');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const iconFsEnter = document.getElementById('icon-fs-enter');
  const iconFsExit = document.getElementById('icon-fs-exit');

  // Header & Navigation
  const btnSyncMinus = document.getElementById('btn-sync-minus');
  const btnSyncPlus = document.getElementById('btn-sync-plus');
  const syncDelayText = document.getElementById('sync-delay-text');
  const btnSubSize = document.getElementById('btn-sub-size');
  const subSizeLabel = document.getElementById('sub-size-label');
  const btnToggleScript = document.getElementById('btn-toggle-script');
  const btnOpenVideo = document.getElementById('btn-open-video');
  const btnOpenSub = document.getElementById('btn-open-sub');
  const subBtnLabel = document.getElementById('sub-btn-label');
  const btnSplashOpenVideo = document.getElementById('btn-splash-open-video');
  const btnSavedWords = document.getElementById('btn-saved-words');
  const savedWordsCount = document.getElementById('saved-words-count');
  const btnAccount = document.getElementById('btn-account');
  const accountStatusDot = document.getElementById('account-status-dot');
  const accountLabel = document.getElementById('account-label');
  const btnHelp = document.getElementById('btn-help');

  // Popover elements
  const popoverWordText = document.getElementById('popover-word-text');
  const popoverWordPos = document.getElementById('popover-word-pos');
  const popoverBtnAudio = document.getElementById('popover-btn-audio');
  const popoverTranslationAr = document.getElementById('popover-translation-ar');
  const popoverContextBox = document.getElementById('popover-context-box');
  const popoverBtnSave = document.getElementById('popover-btn-save');

  // Dialogue Script Drawer
  const scriptDrawer = document.getElementById('script-drawer');
  const btnCloseScript = document.getElementById('btn-close-script');
  const scriptSearchInput = document.getElementById('script-search-input');
  const drawerCuesList = document.getElementById('drawer-cues-list');

  // Modals
  const helpModal = document.getElementById('help-modal');
  const btnCloseHelp = document.getElementById('btn-close-help');
  const accountModal = document.getElementById('account-modal');
  const btnCloseAccountModal = document.getElementById('btn-close-account-modal');
  const accountLoggedOutView = document.getElementById('account-logged-out-view');
  const accountLoggedInView = document.getElementById('account-logged-in-view');
  const accountUserEmail = document.getElementById('account-user-email');
  const authEmailInput = document.getElementById('auth-email');
  const authPasswordInput = document.getElementById('auth-password');
  const btnAuthSignin = document.getElementById('btn-auth-signin');
  const btnAuthSignout = document.getElementById('btn-auth-signout');
  const btnOpenWeb = document.getElementById('btn-open-web');

  const savedWordsModal = document.getElementById('saved-words-modal');
  const btnCloseSavedModal = document.getElementById('btn-close-saved-modal');
  const savedWordsListContainer = document.getElementById('saved-words-list-container');
  const btnSavedOpenWeb = document.getElementById('btn-saved-open-web');

  // Auth Gate Elements
  const authGateScreen = document.getElementById('auth-gate-screen');
  const gateLoginForm = document.getElementById('gate-login-form');
  const gateEmail = document.getElementById('gate-email');
  const gatePassword = document.getElementById('gate-password');
  const gateAuthError = document.getElementById('gate-auth-error');
  const btnGateSignin = document.getElementById('btn-gate-signin');
  const btnGateOffline = document.getElementById('btn-gate-offline');
  const btnGateCreateAcc = document.getElementById('btn-gate-create-acc');

  // Subtitle Sizes
  const subSizes = [
    { label: 'Size 20px', cls: 'sub-size-compact' },
    { label: 'Size 26px', cls: 'sub-size-standard' },
    { label: 'Size 34px', cls: 'sub-size-large' },
    { label: 'Size 42px', cls: 'sub-size-cinema' }
  ];
  let currentSubSizeIdx = 1;

  // State
  let cues = [];
  let currentCue = null;
  let activeCueIdx = -1;
  let subtitleDelayMs = 0;
  let subtitlesVisible = true;
  let activeWordData = null;
  let resumeVideoAfterPopover = false;
  let isScrubbing = false;
  let idleTimer = null;
  let toastTimer = null;
  let userSession = null;
  let savedWords = [];
  const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
  let currentSpeedIndex = 1;

  // Auth Gate helpers
  function showLoginGate() {
    if (authGateScreen) {
      authGateScreen.classList.remove('hidden');
      if (gateAuthError) gateAuthError.style.display = 'none';
      setTimeout(() => {
        if (gateEmail) gateEmail.focus();
      }, 100);
    }
  }

  function hideLoginGate() {
    if (authGateScreen) {
      authGateScreen.classList.add('hidden');
    }
  }

  // Initialize
  async function init() {
    try {
      const config = await window.WordTapAPI.getConfig();
      if (config.session && config.session.access_token) {
        userSession = config.session;
        updateAccountUI();
        hideLoginGate();
      } else {
        showLoginGate();
      }
      if (config.subtitleDelayMs) {
        subtitleDelayMs = config.subtitleDelayMs;
        updateSyncDelayUI();
      }
      if (typeof config.subSizeIdx === 'number' && config.subSizeIdx >= 0 && config.subSizeIdx < subSizes.length) {
        currentSubSizeIdx = config.subSizeIdx;
      }
      applySubSize(currentSubSizeIdx);
      refreshSavedWordsCount();
    } catch (e) {
      console.warn('Config load error:', e);
      showLoginGate();
    }
    setupEvents();
  }

  // Formatting helpers
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function showToast(msg) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2000);
  }

  // Subtitle Sizing
  function applySubSize(index) {
    subSizes.forEach(s => subtitleContainer.classList.remove(s.cls));
    const size = subSizes[index];
    subtitleContainer.classList.add(size.cls);
    if (subSizeLabel) subSizeLabel.textContent = size.label;
  }

  function cycleSubSize() {
    currentSubSizeIdx = (currentSubSizeIdx + 1) % subSizes.length;
    applySubSize(currentSubSizeIdx);
    window.WordTapAPI.saveConfig({ subSizeIdx: currentSubSizeIdx });
    showToast(`Subtitle: ${subSizes[currentSubSizeIdx].label}`);
  }

  // Subtitle Parsing (.srt, .vtt)
  function parseSRTTimestamp(str) {
    const parts = str.trim().split(':');
    if (parts.length < 3) return 0;
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const secParts = parts[2].replace(',', '.').split('.');
    const seconds = parseFloat(secParts[0]);
    const ms = secParts[1] ? parseFloat(secParts[1]) : 0;
    return hours * 3600 + minutes * 60 + seconds + (ms / 1000);
  }

  function parseSubtitles(rawText) {
    const clean = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = clean.split(/\n\s*\n/);
    const parsed = [];

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;

      let timeLineIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
          timeLineIdx = i;
          break;
        }
      }

      if (timeLineIdx === -1) continue;

      const timeParts = lines[timeLineIdx].split('-->');
      const start = parseSRTTimestamp(timeParts[0]);
      const end = parseSRTTimestamp(timeParts[1]);

      const textLines = lines.slice(timeLineIdx + 1);
      const text = textLines
        .join(' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\{[^\}]+\}/g, '')
        .trim();

      if (text && end > start) {
        parsed.push({
          start,
          end,
          text
        });
      }
    }

    return parsed.sort((a, b) => a.start - b.start);
  }

  // Load Subtitles
  function loadSubtitles(content, label = 'Subtitle loaded') {
    cues = parseSubtitles(content);
    subBtnLabel.textContent = cues.length > 0 ? `Subtitles (${cues.length})` : 'Load Subtitle';
    showToast(`${label} (${cues.length} lines)`);
    renderScriptDrawer();
  }

  // Interactive Subtitle Rendering on Screen
  function renderSubtitle(cue) {
    if (!subtitlesVisible || !cue) {
      subtitleContainer.innerHTML = '';
      return;
    }

    const tokens = cue.text.match(/([a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?|[^\s\w]+|\s+)/g) || [cue.text];
    
    let html = '<div class="subtitle-line">';
    for (const tok of tokens) {
      if (/^[a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?$/.test(tok)) {
        const cleanWord = tok.toLowerCase();
        html += `<span class="wt-word" data-word="${cleanWord}" data-raw="${tok}">${tok}</span>`;
      } else {
        html += `<span class="wt-punct">${tok}</span>`;
      }
    }
    html += '</div>';

    subtitleContainer.innerHTML = html;

    const wordElements = subtitleContainer.querySelectorAll('.wt-word');
    wordElements.forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onWordClick(el, cue);
      });
    });
  }

  // Dialogue Script Drawer Rendering
  function renderScriptDrawer(filterText = '') {
    if (!drawerCuesList) return;
    if (cues.length === 0) {
      drawerCuesList.innerHTML = '<div class="drawer-empty-msg">No subtitle cues loaded yet. Open a video or load a subtitle (.srt) file.</div>';
      return;
    }

    const query = filterText.trim().toLowerCase();
    let html = '';

    cues.forEach((cue, index) => {
      if (query && !cue.text.toLowerCase().includes(query)) return;

      const tokens = cue.text.match(/([a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?|[^\s\w]+|\s+)/g) || [cue.text];
      let wordsHtml = '';
      for (const tok of tokens) {
        if (/^[a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?$/.test(tok)) {
          wordsHtml += `<span class="drawer-cue-word" data-word="${tok.toLowerCase()}" data-raw="${tok}">${tok}</span>`;
        } else {
          wordsHtml += tok;
        }
      }

      html += `
        <div class="drawer-cue-item ${index === activeCueIdx ? 'active' : ''}" id="drawer-cue-${index}" data-index="${index}">
          <div class="drawer-cue-time" data-start="${cue.start}">⏱️ ${formatTime(cue.start)}</div>
          <div class="drawer-cue-text">${wordsHtml}</div>
        </div>
      `;
    });

    drawerCuesList.innerHTML = html;

    // Attach listeners in drawer
    drawerCuesList.querySelectorAll('.drawer-cue-time').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const start = parseFloat(el.dataset.start);
        if (!isNaN(start)) {
          video.currentTime = Math.max(0, start + (subtitleDelayMs / 1000));
          video.play();
        }
      });
    });

    drawerCuesList.querySelectorAll('.drawer-cue-word').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const cueItem = el.closest('.drawer-cue-item');
        const cueIdx = parseInt(cueItem.dataset.index, 10);
        const cue = cues[cueIdx];
        if (cue) {
          onWordClick(el, cue);
        }
      });
    });
  }

  // Word Click Handler - Auto Pause & Open Card
  async function onWordClick(element, cue) {
    if (!video.paused) {
      video.pause();
      resumeVideoAfterPopover = true;
    } else {
      resumeVideoAfterPopover = false;
    }

    const rawWord = element.dataset.raw;
    const cleanWord = element.dataset.word;
    const contextSentence = cue.text;

    activeWordData = {
      word: cleanWord,
      rawWord: rawWord,
      contextSentence: contextSentence,
      translation: '',
      pos: 'word'
    };

    const rect = element.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverHeight = 220;

    let left = rect.left + (rect.width / 2) - (popoverWidth / 2);
    if (left < 16) left = 16;
    if (left + popoverWidth > window.innerWidth - 16) left = window.innerWidth - popoverWidth - 16;

    let top = rect.top - popoverHeight - 14;
    if (top < 70) {
      top = rect.bottom + 14;
    }

    wordPopover.style.left = `${left}px`;
    wordPopover.style.top = `${top}px`;

    popoverWordText.textContent = rawWord;
    popoverWordPos.textContent = '...';
    popoverTranslationAr.textContent = 'جاري الترجمة...';
    popoverContextBox.innerHTML = contextSentence.replace(
      new RegExp(`\\b(${rawWord})\\b`, 'i'),
      '<strong style="color:var(--accent-gold);">$1</strong>'
    );
    popoverBtnSave.classList.remove('saved');
    popoverBtnSave.innerHTML = '<span>★ Save to WordTap</span>';
    wordPopover.classList.add('visible');

    speakWord(rawWord);

    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&dt=bd&dt=qca&dt=at&q=${encodeURIComponent(cleanWord)}`
      );
      if (res.ok) {
        const data = await res.json();
        let translation = '';
        if (data && data[0] && data[0][0] && data[0][0][0]) {
          translation = data[0][0][0];
        }

        let pos = 'word';
        if (data && data[1] && data[1][0] && data[1][0][0]) {
          pos = data[1][0][0];
        }

        activeWordData.translation = translation;
        activeWordData.pos = pos;

        popoverTranslationAr.textContent = translation || '—';
        popoverWordPos.textContent = pos;
      } else {
        popoverTranslationAr.textContent = 'تعذر الاتصال بالترجمة';
      }
    } catch (err) {
      console.warn('Translation error:', err);
      popoverTranslationAr.textContent = 'خطأ في الترجمة';
    }
  }

  // Audio Pronunciation
  function speakWord(text) {
    if (!text) return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      } else {
        const audio = new Audio(`https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(text)}`);
        audio.play().catch(() => {});
      }
    } catch (err) {
      console.warn('TTS error:', err);
    }
  }

  // Close Popover
  function closePopover(resume = false) {
    if (wordPopover.classList.contains('visible')) {
      wordPopover.classList.remove('visible');
      activeWordData = null;
      if (resume && resumeVideoAfterPopover) {
        video.play();
      }
    }
  }

  // Save Word Handler
  async function saveActiveWord() {
    if (!activeWordData) return;

    popoverBtnSave.innerHTML = '<span>Saving...</span>';

    const entry = {
      text: activeWordData.cleanWord || activeWordData.word,
      translation: activeWordData.translation || '',
      sentence: activeWordData.contextSentence || '',
      title: nowPlayingTitle.textContent !== 'No video loaded' ? nowPlayingTitle.textContent : 'WordTap VLC Video',
      lang: 'ar',
      src: 'en',
      createdAt: new Date().toISOString()
    };

    await window.WordTapAPI.saveWord(entry);
    refreshSavedWordsCount();

    if (userSession && userSession.access_token) {
      try {
        await syncWordToSupabase(entry, userSession.access_token);
      } catch (err) {
        console.warn('Supabase sync background fail (will retry):', err);
      }
    }

    popoverBtnSave.classList.add('saved');
    popoverBtnSave.innerHTML = '<span>✓ Saved in WordTap!</span>';
    showToast(`Saved "${entry.text}" to WordTap!`);
  }

  async function syncWordToSupabase(entry, token) {
    const payload = {
      p_text: entry.text,
      p_translation: entry.translation,
      p_src_lang: 'en',
      p_target_lang: 'ar',
      p_source_title: `"${entry.sentence}" — ${entry.title}`,
      p_source_url: 'wordtap-vlc-player',
      p_times: 1,
      p_sentence: entry.sentence
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_word`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Sync failed: HTTP ${res.status}`);
    }
  }

  async function refreshSavedWordsCount() {
    try {
      savedWords = await window.WordTapAPI.getSavedWords();
      savedWordsCount.textContent = `${savedWords.length} Word${savedWords.length === 1 ? '' : 's'}`;
    } catch {}
  }

  // Account / Sync Management
  function updateAccountUI() {
    if (userSession && userSession.email) {
      accountStatusDot.classList.add('online');
      accountLabel.textContent = userSession.email.split('@')[0];
      accountLoggedOutView.style.display = 'none';
      accountLoggedInView.style.display = 'block';
      accountUserEmail.textContent = userSession.email;
    } else {
      accountStatusDot.classList.remove('online');
      accountLabel.textContent = 'WordTap Sync';
      accountLoggedOutView.style.display = 'block';
      accountLoggedInView.style.display = 'none';
    }
  }

  async function handleSignIn() {
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;
    if (!email || !password) {
      showToast('Please enter email and password');
      return;
    }

    btnAuthSignin.textContent = 'Signing in...';
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error_description || data.msg || 'Sign in failed');
      }

      userSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
        email: data.user ? data.user.email : email,
        user_id: data.user ? data.user.id : ''
      };

      await window.WordTapAPI.saveConfig({ session: userSession });
      updateAccountUI();
      accountModal.classList.remove('open');
      showToast(`Connected as ${userSession.email}`);
      pushPendingOfflineWords();
    } catch (err) {
      alert(`Sign in error: ${err.message}`);
    } finally {
      btnAuthSignin.textContent = 'Sign In & Connect';
    }
  }

  async function handleSignOut() {
    userSession = null;
    await window.WordTapAPI.saveConfig({ session: null });
    updateAccountUI();
    accountModal.classList.remove('open');
    showLoginGate();
    showToast('Signed out from WordTap');
  }

  async function pushPendingOfflineWords() {
    if (!userSession || !userSession.access_token) return;
    const words = await window.WordTapAPI.getSavedWords();
    if (!words || words.length === 0) return;
    showToast(`Syncing ${words.length} saved words to WordTap...`);
    for (const w of words) {
      try {
        await syncWordToSupabase(w, userSession.access_token);
      } catch {}
    }
    showToast('All words synced to cloud!');
  }

  // Load Saved Words Modal
  function openSavedWordsModal() {
    let html = '';
    if (savedWords.length === 0) {
      html = '<div style="color:var(--text-muted); text-align:center; padding:20px;">No words saved yet. Click any subtitle word during video playback to save it!</div>';
    } else {
      for (const w of savedWords) {
        html += `
          <div class="saved-word-row">
            <div class="saved-word-left">
              <span class="saved-word-title">${w.text}</span>
              <span class="saved-word-ar">${w.translation || ''}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="saved-word-count">Seen ${w.count || 1}x</span>
              <button style="background:none; border:none; cursor:pointer; color:var(--accent-gold);" onclick="window.speakWordDirect('${w.text}')">🔊</button>
            </div>
          </div>
        `;
      }
    }
    savedWordsListContainer.innerHTML = html;
    savedWordsModal.classList.add('open');
  }

  window.speakWordDirect = (text) => speakWord(text);

  // Subtitle Synchronization Adjustment
  function updateSyncDelayUI() {
    const sign = subtitleDelayMs > 0 ? '+' : '';
    syncDelayText.textContent = `${sign}${subtitleDelayMs}ms`;
  }

  function adjustSubtitleDelay(deltaMs) {
    subtitleDelayMs += deltaMs;
    updateSyncDelayUI();
    window.WordTapAPI.saveConfig({ subtitleDelayMs });
    const sign = subtitleDelayMs > 0 ? '+' : '';
    showToast(`Subtitle sync: ${sign}${subtitleDelayMs}ms`);
  }

  // Video Load Handler
  function playVideoFile(fileUrl, fileName, subContent = null) {
    video.src = fileUrl;
    nowPlayingTitle.textContent = fileName;
    dropZone.classList.add('hidden');
    video.play().catch(() => {});

    if (subContent) {
      loadSubtitles(subContent, 'Auto-loaded matching subtitle');
    }
  }

  // Fullscreen Management
  async function toggleFullscreen() {
    if (window.WordTapAPI && window.WordTapAPI.toggleFullscreen) {
      const isFS = await window.WordTapAPI.toggleFullscreen();
      updateFullscreenIcons(isFS);
    } else if (!document.fullscreenElement) {
      document.getElementById('app-container').requestFullscreen().catch(() => {});
      updateFullscreenIcons(true);
    } else {
      document.exitFullscreen().catch(() => {});
      updateFullscreenIcons(false);
    }
  }

  function updateFullscreenIcons(isFS) {
    if (isFS) {
      iconFsEnter.style.display = 'none';
      iconFsExit.style.display = 'block';
      showToast('Fullscreen (Press F or Esc to exit)');
    } else {
      iconFsEnter.style.display = 'block';
      iconFsExit.style.display = 'none';
    }
  }

  if (window.WordTapAPI && window.WordTapAPI.onFullscreenChange) {
    window.WordTapAPI.onFullscreenChange((isFS) => {
      updateFullscreenIcons(isFS);
    });
  }

  document.addEventListener('fullscreenchange', () => {
    updateFullscreenIcons(Boolean(document.fullscreenElement));
  });

  // Setup Event Listeners
  function setupEvents() {
    // Auth Gate Form Submit
    if (gateLoginForm) {
      gateLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = gateEmail.value.trim();
        const password = gatePassword.value;
        if (!email || !password) return;

        btnGateSignin.disabled = true;
        btnGateSignin.innerHTML = '<span>Signing in...</span>';
        if (gateAuthError) gateAuthError.style.display = 'none';

        try {
          const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error_description || data.msg || 'Incorrect email or password');
          }

          userSession = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
            email: data.user ? data.user.email : email,
            user_id: data.user ? data.user.id : ''
          };

          await window.WordTapAPI.saveConfig({ session: userSession });
          updateAccountUI();
          hideLoginGate();
          showToast(`Welcome back, ${userSession.email}!`);
          pushPendingOfflineWords();
        } catch (err) {
          if (gateAuthError) {
            gateAuthError.textContent = err.message || 'Login failed. Please check credentials.';
            gateAuthError.style.display = 'block';
          }
        } finally {
          btnGateSignin.disabled = false;
          btnGateSignin.innerHTML = '<span>Sign In & Open Player</span> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        }
      });
    }

    if (btnGateOffline) {
      btnGateOffline.addEventListener('click', () => {
        hideLoginGate();
        showToast('Running in Offline Mode');
      });
    }

    if (btnGateCreateAcc) {
      btnGateCreateAcc.addEventListener('click', () => {
        window.WordTapAPI.openExternal(WEBSITE_URL);
      });
    }

    // Open Video
    btnOpenVideo.addEventListener('click', async () => {
      const res = await window.WordTapAPI.openVideoFile();
      if (res) {
        playVideoFile(res.fileUrl, res.fileName, res.subContent);
      }
    });

    btnSplashOpenVideo.addEventListener('click', async () => {
      const res = await window.WordTapAPI.openVideoFile();
      if (res) {
        playVideoFile(res.fileUrl, res.fileName, res.subContent);
      }
    });

    // Open Subtitle
    btnOpenSub.addEventListener('click', async () => {
      const res = await window.WordTapAPI.openSubtitleFile();
      if (res && res.content) {
        loadSubtitles(res.content, `Loaded ${res.fileName}`);
      }
    });

    // Subtitle Sync
    btnSyncMinus.addEventListener('click', () => adjustSubtitleDelay(-100));
    btnSyncPlus.addEventListener('click', () => adjustSubtitleDelay(100));

    // Subtitle Size
    btnSubSize.addEventListener('click', cycleSubSize);

    // Dialogue Script Drawer Toggle
    btnToggleScript.addEventListener('click', () => {
      scriptDrawer.classList.toggle('open');
    });

    btnCloseScript.addEventListener('click', () => {
      scriptDrawer.classList.remove('open');
    });

    scriptSearchInput.addEventListener('input', (e) => {
      renderScriptDrawer(e.target.value);
    });

    // Shortcuts Help Modal
    btnHelp.addEventListener('click', () => helpModal.classList.add('open'));
    btnCloseHelp.addEventListener('click', () => helpModal.classList.remove('open'));

    // Popover Audio and Save Buttons
    popoverBtnAudio.addEventListener('click', () => {
      if (activeWordData) speakWord(activeWordData.rawWord);
    });

    popoverBtnSave.addEventListener('click', saveActiveWord);

    // Account Modal
    btnAccount.addEventListener('click', () => accountModal.classList.add('open'));
    btnCloseAccountModal.addEventListener('click', () => accountModal.classList.remove('open'));
    btnAuthSignin.addEventListener('click', handleSignIn);
    btnAuthSignout.addEventListener('click', handleSignOut);
    btnOpenWeb.addEventListener('click', () => window.WordTapAPI.openExternal(WEBSITE_URL));

    // Saved Words Modal
    btnSavedWords.addEventListener('click', openSavedWordsModal);
    btnCloseSavedModal.addEventListener('click', () => savedWordsModal.classList.remove('open'));
    btnSavedOpenWeb.addEventListener('click', () => window.WordTapAPI.openExternal(WEBSITE_URL));

    // Play/Pause
    function togglePlay() {
      if (wordPopover.classList.contains('visible')) {
        closePopover(true);
        return;
      }
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }

    btnPlayPause.addEventListener('click', togglePlay);
    video.addEventListener('click', () => {
      if (wordPopover.classList.contains('visible')) {
        closePopover(false);
      } else {
        togglePlay();
      }
    });

    video.addEventListener('play', () => {
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
    });

    video.addEventListener('pause', () => {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
    });

    // Video Time Updates & Subtitle Matching
    video.addEventListener('timeupdate', () => {
      if (isScrubbing) return;
      const cur = video.currentTime;
      const dur = video.duration || 0;

      currentTimeEl.textContent = formatTime(cur);
      totalDurationEl.textContent = formatTime(dur);

      if (dur > 0) {
        const pct = (cur / dur) * 100;
        scrubberPlayed.style.width = `${pct}%`;
        scrubberThumb.style.left = `${pct}%`;
      }

      // Check Subtitles
      if (cues.length > 0) {
        const adjustedTime = cur - (subtitleDelayMs / 1000);
        let foundIdx = -1;
        for (let i = 0; i < cues.length; i++) {
          if (adjustedTime >= cues[i].start && adjustedTime <= cues[i].end) {
            foundIdx = i;
            break;
          }
        }

        if (foundIdx !== -1 && foundIdx !== activeCueIdx) {
          activeCueIdx = foundIdx;
          currentCue = cues[foundIdx];
          renderSubtitle(currentCue);

          // Update active item in drawer
          if (drawerCuesList) {
            drawerCuesList.querySelectorAll('.drawer-cue-item.active').forEach(el => el.classList.remove('active'));
            const activeEl = document.getElementById(`drawer-cue-${activeCueIdx}`);
            if (activeEl) {
              activeEl.classList.add('active');
              if (scriptDrawer.classList.contains('open')) {
                activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }
          }
        } else if (foundIdx === -1 && currentCue !== null) {
          activeCueIdx = -1;
          currentCue = null;
          renderSubtitle(null);
        }
      }
    });

    // Buffer Progress
    video.addEventListener('progress', () => {
      if (video.buffered.length > 0 && video.duration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const pct = (bufferedEnd / video.duration) * 100;
        scrubberBuffer.style.width = `${pct}%`;
      }
    });

    // Scrubber Seeking
    function seekFromEvent(e) {
      const rect = scrubberContainer.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (video.duration) {
        video.currentTime = pos * video.duration;
      }
    }

    scrubberContainer.addEventListener('mousedown', (e) => {
      isScrubbing = true;
      seekFromEvent(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (isScrubbing) {
        seekFromEvent(e);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isScrubbing) isScrubbing = false;
    });

    // Scrubber Tooltip Hover
    scrubberContainer.addEventListener('mousemove', (e) => {
      if (!video.duration) return;
      const rect = scrubberContainer.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const previewTime = pos * video.duration;
      timeTooltip.style.left = `${e.clientX - rect.left}px`;
      timeTooltip.textContent = formatTime(previewTime);
      timeTooltip.style.opacity = '1';
    });

    scrubberContainer.addEventListener('mouseleave', () => {
      timeTooltip.style.opacity = '0';
    });

    // Replay Line (S key or button)
    function replayCurrentLine() {
      if (currentCue) {
        video.currentTime = Math.max(0, currentCue.start + (subtitleDelayMs / 1000));
        video.play();
        showToast('↺ Replaying line');
      } else if (cues.length > 0) {
        const cur = video.currentTime - (subtitleDelayMs / 1000);
        const prevCue = [...cues].reverse().find(c => c.start <= cur);
        if (prevCue) {
          video.currentTime = Math.max(0, prevCue.start + (subtitleDelayMs / 1000));
          video.play();
          showToast('↺ Replaying line');
        }
      }
    }
    btnReplayLine.addEventListener('click', replayCurrentLine);

    // Seek buttons (-5s, +5s)
    btnSeekBack.addEventListener('click', () => {
      video.currentTime = Math.max(0, video.currentTime - 5);
    });
    btnSeekFwd.addEventListener('click', () => {
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
    });

    // Speed Selector
    btnSpeed.addEventListener('click', () => {
      currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
      const speed = speeds[currentSpeedIndex];
      video.playbackRate = speed;
      btnSpeed.textContent = `${speed.toFixed(speed === 1.0 ? 1 : 2).replace('.00', '.0')}x`;
      showToast(`Speed: ${speed}x`);
    });

    // Subtitle Toggle (CC)
    btnToggleSub.addEventListener('click', () => {
      subtitlesVisible = !subtitlesVisible;
      btnToggleSub.classList.toggle('active', subtitlesVisible);
      renderSubtitle(currentCue);
      showToast(subtitlesVisible ? 'Subtitles On' : 'Subtitles Off');
    });

    // Volume & Mute
    function updateVolumeUI() {
      if (video.muted || video.volume === 0) {
        iconVolHigh.style.display = 'none';
        iconVolMute.style.display = 'block';
        volumeSlider.value = 0;
      } else {
        iconVolHigh.style.display = 'block';
        iconVolMute.style.display = 'none';
        volumeSlider.value = video.volume;
      }
    }

    btnMute.addEventListener('click', () => {
      video.muted = !video.muted;
      updateVolumeUI();
    });

    volumeSlider.addEventListener('input', (e) => {
      video.volume = parseFloat(e.target.value);
      video.muted = false;
      updateVolumeUI();
    });

    btnFullscreen.addEventListener('click', toggleFullscreen);
    video.addEventListener('dblclick', toggleFullscreen);

    // Drag & Drop Handling
    const appContainer = document.getElementById('app-container');

    appContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    appContainer.addEventListener('dragleave', (e) => {
      if (e.target === dropZone) {
        dropZone.classList.remove('dragover');
      }
    });

    appContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');

      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const ext = file.name.split('.').pop().toLowerCase();

        if (['srt', 'vtt', 'sub'].includes(ext)) {
          const reader = new FileReader();
          reader.onload = (re) => {
            loadSubtitles(re.target.result, `Loaded ${file.name}`);
          };
          reader.readAsText(file);
        } else if (['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v'].includes(ext)) {
          const fileUrl = URL.createObjectURL(file);
          playVideoFile(fileUrl, file.name);

          if (file.path) {
            const adjacentResult = await window.WordTapAPI.readSubtitleFile(
              file.path.replace(/\.[^/.]+$/, '.srt')
            );
            if (adjacentResult && adjacentResult.content) {
              loadSubtitles(adjacentResult.content, 'Auto-loaded adjacent .srt');
            }
          }
        }
      }
    });

    // Keyboard Shortcuts (Space, Left, Right, F, M, S, [, ], A, D, ?)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'Escape') {
        if (wordPopover.classList.contains('visible')) {
          closePopover(true);
        } else if (scriptDrawer.classList.contains('open')) {
          scriptDrawer.classList.remove('open');
        } else if (helpModal.classList.contains('open')) {
          helpModal.classList.remove('open');
        } else if (accountModal.classList.contains('open')) {
          accountModal.classList.remove('open');
        } else if (savedWordsModal.classList.contains('open')) {
          savedWordsModal.classList.remove('open');
        } else {
          if (window.WordTapAPI && window.WordTapAPI.isFullscreen) {
            window.WordTapAPI.isFullscreen().then(isFS => {
              if (isFS) toggleFullscreen();
            });
          }
        }
      } else if (e.code === 'KeyF') {
        toggleFullscreen();
      } else if (e.code === 'KeyM') {
        video.muted = !video.muted;
        updateVolumeUI();
      } else if (e.code === 'KeyS') {
        replayCurrentLine();
      } else if (e.code === 'KeyC') {
        subtitlesVisible = !subtitlesVisible;
        btnToggleSub.classList.toggle('active', subtitlesVisible);
        renderSubtitle(currentCue);
      } else if (e.code === 'KeyA') {
        cycleSubSize();
      } else if (e.code === 'KeyD') {
        scriptDrawer.classList.toggle('open');
      } else if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
        helpModal.classList.toggle('open');
      } else if (e.code === 'ArrowLeft') {
        video.currentTime = Math.max(0, video.currentTime - 5);
        showToast('⏪ -5s');
      } else if (e.code === 'ArrowRight') {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
        showToast('⏩ +5s');
      } else if (e.code === 'ArrowUp') {
        video.volume = Math.min(1, video.volume + 0.05);
        video.muted = false;
        updateVolumeUI();
        showToast(`Volume: ${Math.round(video.volume * 100)}%`);
      } else if (e.code === 'ArrowDown') {
        video.volume = Math.max(0, video.volume - 0.05);
        updateVolumeUI();
        showToast(`Volume: ${Math.round(video.volume * 100)}%`);
      } else if (e.code === 'BracketLeft') {
        adjustSubtitleDelay(-100);
      } else if (e.code === 'BracketRight') {
        adjustSubtitleDelay(100);
      }
    });

    // Auto-Hide Controls on Inactivity
    function resetIdleTimer() {
      appContainer.classList.remove('idle-hidden');
      clearTimeout(idleTimer);
      if (!video.paused && !wordPopover.classList.contains('visible') && !scriptDrawer.classList.contains('open')) {
        idleTimer = setTimeout(() => {
          appContainer.classList.add('idle-hidden');
        }, 2800);
      }
    }

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('mousedown', resetIdleTimer);
  }

  // Start initialization
  init();
})();
