// WordTap VLC Media Player - Core Renderer Script
(() => {
  const SUPABASE_URL = "https://vjjilwbhvoxfigrokqch.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_YzMg6sNWjpwwfP2T-apa-Q_c3EHVBNa";
  const WEBSITE_URL = "https://wordtap.vercel.app";

  const ICON_STAR_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const ICON_CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  // Elements
  const appContainer = document.getElementById('app-container');
  const topVlcMenu = document.getElementById('top-vlc-menu');
  const vlcBottomBar = document.getElementById('vlc-bottom-bar');
  const video = document.getElementById('main-video');
  const dropZone = document.getElementById('drop-zone');
  const subtitleContainer = document.getElementById('subtitle-container');
  const wordPopover = document.getElementById('word-popover');
  const toastEl = document.getElementById('toast');
  const audioUnmuteBanner = document.getElementById('audio-unmute-banner');
  const compatibleAudio = document.getElementById('compatible-audio');

  // VLsub OpenSubtitles Elements
  const vlsubModal = document.getElementById('vlsub-modal');
  const btnCloseVlsub = document.getElementById('btn-close-vlsub');
  const btnCloseVlsubFooter = document.getElementById('btn-vlsub-close-footer');
  const vlsubLangSelect = document.getElementById('vlsub-lang-select');
  const vlsubTitleInput = document.getElementById('vlsub-title-input');
  const vlsubSeasonInput = document.getElementById('vlsub-season-input');
  const vlsubEpisodeInput = document.getElementById('vlsub-episode-input');
  const btnVlsubSearchHash = document.getElementById('btn-vlsub-search-hash');
  const btnVlsubSearchName = document.getElementById('btn-vlsub-search-name');
  const vlsubSpinner = document.getElementById('vlsub-spinner');
  const vlsubResultsTbody = document.getElementById('vlsub-results-tbody');
  const vlsubStatusText = document.getElementById('vlsub-status-text');
  const btnVlsubDownload = document.getElementById('btn-vlsub-download');

  // Menu Dropdown Specific Actions
  const menuItemVlsub = document.getElementById('menu-item-vlsub');
  const menuItemSubVlsub = document.getElementById('menu-item-sub-vlsub');
  const menuItemAudioFix = document.getElementById('menu-item-audio-fix');

  // VLC Controls
  const btnPlayPause = document.getElementById('btn-play-pause');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const btnStop = document.getElementById('btn-stop');
  const btnReplayLine = document.getElementById('btn-replay-line');
  const btnSeekBack = document.getElementById('btn-seek-back');
  const btnSeekFwd = document.getElementById('btn-seek-fwd');
  const currentTimeEl = document.getElementById('current-time');
  const totalDurationEl = document.getElementById('total-duration');
  const scrubberContainer = document.getElementById('scrubber-container');
  const scrubberPlayed = document.getElementById('scrubber-played');
  const scrubberThumb = document.getElementById('scrubber-thumb');
  const timeTooltip = document.getElementById('time-tooltip');
  const speedGroup = document.getElementById('speed-group');
  const speedSlider = document.getElementById('speed-slider');
  const btnSpeedMinus = document.getElementById('btn-speed-minus');
  const btnSpeedPlus = document.getElementById('btn-speed-plus');
  const btnSpeed = document.getElementById('btn-speed');
  const btnToggleSub = document.getElementById('btn-toggle-sub');
  const btnMute = document.getElementById('btn-mute');
  const iconVolHigh = document.getElementById('icon-vol-high');
  const iconVolMute = document.getElementById('icon-vol-mute');
  const volumeSlider = document.getElementById('volume-slider');
  const volumePercentLabel = document.getElementById('volume-percent-label');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const iconFsEnter = document.getElementById('icon-fs-enter');
  const iconFsExit = document.getElementById('icon-fs-exit');

  // Menu Bar Controls
  const btnOpenVideo = document.getElementById('btn-open-video');
  const btnOpenSub = document.getElementById('btn-open-sub');
  const btnSubFont = document.getElementById('btn-sub-font');
  const btnSubSize = document.getElementById('btn-sub-size');
  const btnHelp = document.getElementById('btn-help');
  const btnSyncMinus = document.getElementById('btn-sync-minus');
  const btnSyncPlus = document.getElementById('btn-sync-plus');
  const syncDelayText = document.getElementById('sync-delay-text');
  const btnSplashOpenVideo = document.getElementById('btn-splash-open-video');
  const btnSavedWords = document.getElementById('btn-saved-words');
  const savedWordsCount = document.getElementById('saved-words-count');
  const btnAccount = document.getElementById('btn-account');
  const accountStatusDot = document.getElementById('account-status-dot');
  const accountLabel = document.getElementById('account-label');

  // Popover elements
  const popoverWordText = document.getElementById('popover-word-text');
  const popoverWordPos = document.getElementById('popover-word-pos');
  const popoverBtnAudio = document.getElementById('popover-btn-audio');
  const popoverTranslationAr = document.getElementById('popover-translation-ar');
  const popoverContextBox = document.getElementById('popover-context-box');
  const popoverBtnSave = document.getElementById('popover-btn-save');
  const popoverFooterText = document.getElementById('popover-footer-text');

  // Extension Word Saving Mode & Options Elements
  const btnModeManual = document.getElementById('btn-mode-manual');
  const btnModeSubs = document.getElementById('btn-mode-subs');
  const btnModeAuto = document.getElementById('btn-mode-auto');
  const saveModeHelper = document.getElementById('save-mode-helper');
  const optTargetLang = document.getElementById('opt-target-lang');
  const chkPauseOnClick = document.getElementById('chk-pause-on-click');
  const menuItemOptions = document.getElementById('menu-item-options');

  // Theme Toggle Elements
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const themeIconSun = document.getElementById('theme-icon-sun');
  const themeIconMoon = document.getElementById('theme-icon-moon');
  const themeLabel = document.getElementById('theme-label');
  const menuItemThemeToggle = document.getElementById('menu-item-theme-toggle');
  const menuThemeText = document.getElementById('menu-theme-text');
  const btnThemeDark = document.getElementById('btn-theme-dark');
  const btnThemeLight = document.getElementById('btn-theme-light');
  const btnThemeSystem = document.getElementById('btn-theme-system');
  let currentTheme = 'dark';

  // Mandatory Login Gate Elements
  const authGateScreen = document.getElementById('auth-gate-screen');
  const gateLoginForm = document.getElementById('gate-login-form');
  const gateEmail = document.getElementById('gate-email');
  const gatePassword = document.getElementById('gate-password');
  const gateAuthError = document.getElementById('gate-auth-error');
  const btnGateSignin = document.getElementById('btn-gate-signin');
  const btnGateGoogle = document.getElementById('btn-gate-google');
  const gateGoogleText = document.getElementById('gate-google-text');
  const btnGateOffline = document.getElementById('btn-gate-offline');
  const btnGatePasteKey = document.getElementById('btn-gate-paste-key');
  const btnGateCreateAcc = document.getElementById('btn-gate-create-acc');

  // Modals
  const helpModal = document.getElementById('help-modal');
  const btnCloseHelp = document.getElementById('btn-close-help');
  const accountModal = document.getElementById('account-modal');
  const btnCloseAccountModal = document.getElementById('btn-close-account-modal');
  const accountLoggedOutView = document.getElementById('account-logged-out-view');
  const accountLoggedInView = document.getElementById('account-logged-in-view');
  const accountUserEmail = document.getElementById('account-user-email');
  const accountAvatarDot = document.getElementById('account-avatar-dot');
  const accountSyncSubtitle = document.getElementById('account-sync-subtitle');
  const accountSyncIcon = document.getElementById('account-sync-icon');
  const accountSyncText = document.getElementById('account-sync-text');
  const authEmailInput = document.getElementById('auth-email');
  const authPasswordInput = document.getElementById('auth-password');
  const btnAuthSignin = document.getElementById('btn-auth-signin');
  const btnAccountGoogle = document.getElementById('btn-account-google');
  const accountGoogleText = document.getElementById('account-google-text');
  const btnAccountPasteKey = document.getElementById('btn-account-paste-key');
  const btnAuthSignout = document.getElementById('btn-auth-signout');
  const btnOpenWeb = document.getElementById('btn-open-web');

  const savedWordsModal = document.getElementById('saved-words-modal');
  const btnCloseSavedModal = document.getElementById('btn-close-saved-modal');
  const savedWordsListContainer = document.getElementById('saved-words-list-container');
  const btnSavedOpenWeb = document.getElementById('btn-saved-open-web');

  // Subtitle Style & Customization Modal Elements
  const subtitleStyleModal = document.getElementById('subtitle-style-modal');
  const btnCloseSubStyle = document.getElementById('btn-close-sub-style');
  const btnSubApplyClose = document.getElementById('btn-sub-apply-close');
  const btnSubResetDefaults = document.getElementById('btn-sub-reset-defaults');
  const subSelectFont = document.getElementById('sub-select-font');
  const subSizeSlider = document.getElementById('sub-size-slider');
  const subSizeInput = document.getElementById('sub-size-input');
  const subCustomColor = document.getElementById('sub-custom-color');
  const subBgStyleControl = document.getElementById('sub-bg-style-control');
  const subWeightControl = document.getElementById('sub-weight-control');
  const subOffsetSlider = document.getElementById('sub-offset-slider');
  const subOffsetInput = document.getElementById('sub-offset-input');
  const subOffsetValue = document.getElementById('sub-offset-value');
  const subStylePreviewLine = document.getElementById('sub-style-preview-line');
  const btnOpenSubStyleFromOptions = document.getElementById('btn-open-sub-style-from-options');

  // Subtitle Appearance Customization State
  let subCustomSize = 28;
  let subFontFamily = 'Arial, "Trebuchet MS", sans-serif';
  let subTextColor = '#FFFFFF';
  let subBgStyle = 'none'; // 'none' | 'translucent' | 'solid'
  let subFontWeight = '700';
  let subBottomOffset = 46;

  // Subtitle Sizes (Presets)
  const subSizes = [
    { label: '22px', cls: 'sub-size-compact', size: 22 },
    { label: '28px', cls: 'sub-size-standard', size: 28 },
    { label: '31px', cls: 'sub-size-medium', size: 31 },
    { label: '36px', cls: 'sub-size-large', size: 36 },
    { label: '44px', cls: 'sub-size-cinema', size: 44 }
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
  let toastTimer = null;
  let userSession = null;
  let systemSuspended = false;
  let connectionIssue = null; // null | 'offline' | 'suspended' | 'auth_expired'
  let connectionCheckPromise = null;
  let lastConnectionCheckAt = 0;
  let savedWords = [];
  let translateSaveMode = 'subtitles_only'; // 'manual' | 'subtitles_only' | 'auto'
  let pauseOnClick = false; // "dont stop the film when i click on word"
  let targetLang = 'ar';
  let popoverHideTimer = null;

  // Persistent client-side translation cache
  const translationCache = new Map();
  try {
    const rawCache = localStorage.getItem('wt_translation_cache');
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      for (const [k, v] of Object.entries(parsed)) {
        if (k && v && typeof v === 'object') translationCache.set(k, v);
      }
    }
  } catch (_) {}

  let persistDesktopCacheTimer = null;
  function persistDesktopTranslation(key, val) {
    if (translationCache.size > 2000) translationCache.delete(translationCache.keys().next().value);
    translationCache.set(key, val);

    if (!persistDesktopCacheTimer) {
      persistDesktopCacheTimer = setTimeout(() => {
        persistDesktopCacheTimer = null;
        try {
          const obj = Object.fromEntries(Array.from(translationCache.entries()).slice(-1000));
          localStorage.setItem('wt_translation_cache', JSON.stringify(obj));
        } catch (_) {}
      }, 2000);
    }
  }
  const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
  let currentSpeedIndex = 1;

  function setPlaybackSpeed(speed, showMessage = true) {
    if (isNaN(speed)) return;
    const clamped = Math.min(3.0, Math.max(0.25, Math.round(speed * 100) / 100));
    video.playbackRate = clamped;
    if (isAudioTranscoded && compatibleAudio && compatibleAudio.src) {
      compatibleAudio.playbackRate = clamped;
    }
    if (speedSlider) {
      speedSlider.value = clamped;
    }
    if (btnSpeed) {
      const formatted = clamped.toFixed(clamped % 1 === 0 ? 1 : (Math.round(clamped * 10) === clamped * 10 ? 1 : 2));
      btnSpeed.textContent = `${formatted}x`;
      if (clamped !== 1.0) {
        btnSpeed.style.color = 'var(--subtitle, #facc15)';
        btnSpeed.style.borderColor = 'rgba(250, 204, 59, 0.4)';
      } else {
        btnSpeed.style.color = '#FFFFFF';
        btnSpeed.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      }
    }
    if (showMessage) {
      const formatted = clamped.toFixed(clamped % 1 === 0 ? 1 : (Math.round(clamped * 10) === clamped * 10 ? 1 : 2));
      showToast(`Speed: ${formatted}x`);
    }
  }

  function adjustPlaybackSpeed(delta) {
    const cur = video.playbackRate || 1.0;
    setPlaybackSpeed(cur + delta, true);
  }
  let currentMediaTitle = 'No media loaded';
  let currentFilePath = null;
  let currentSubPath = null;
  let currentSubFileName = null;
  let currentSubContent = null;
  let lastSessionSaveTime = 0;
  let activeSavedTime = 0;

  function saveCurrentMediaSession(isSync = false) {
    if (!currentFilePath || !window.WordTapAPI) return;
    
    let curTime = 0;
    if (video && !isNaN(video.currentTime) && video.currentTime > 0) {
      curTime = video.currentTime;
      activeSavedTime = curTime;
    } else if (activeSavedTime > 0) {
      curTime = activeSavedTime;
    }

    const sessionData = {
      filePath: currentFilePath,
      fileName: currentMediaTitle,
      subPath: currentSubPath,
      subFileName: currentSubFileName,
      subContent: currentSubContent,
      subtitleDelayMs: subtitleDelayMs,
      savedTime: curTime
    };

    try {
      if (isSync && window.WordTapAPI.saveMediaSessionSync) {
        window.WordTapAPI.saveMediaSessionSync(sessionData);
      } else if (window.WordTapAPI.saveMediaSession) {
        window.WordTapAPI.saveMediaSession(sessionData);
      }
    } catch (e) {
      console.warn('Failed to save media session:', e);
    }
  }

  // Theme Management (Dark Cinema / Daylight Light Mode)
  function applyTheme(themeName, showToastFeedback = false) {
    currentTheme = themeName || 'dark';
    let effective = currentTheme;
    if (effective === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effective = prefersDark ? 'dark' : 'light';
    }

    if (effective === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
      if (themeIconSun) themeIconSun.style.display = 'block';
      if (themeIconMoon) themeIconMoon.style.display = 'none';
      if (themeLabel) themeLabel.textContent = 'Light';
      if (menuThemeText) menuThemeText.textContent = 'Switch to Dark Mode';
      if (btnThemeToggle) btnThemeToggle.title = 'Switch to Dark Mode [T]';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
      if (themeIconSun) themeIconSun.style.display = 'none';
      if (themeIconMoon) themeIconMoon.style.display = 'block';
      if (themeLabel) themeLabel.textContent = 'Dark';
      if (menuThemeText) menuThemeText.textContent = 'Switch to Light Mode';
      if (btnThemeToggle) btnThemeToggle.title = 'Switch to Light Mode [T]';
    }

    // Update segmented control buttons in options if present
    if (btnThemeDark) btnThemeDark.classList.toggle('active', currentTheme === 'dark');
    if (btnThemeLight) btnThemeLight.classList.toggle('active', currentTheme === 'light');
    if (btnThemeSystem) btnThemeSystem.classList.toggle('active', currentTheme === 'system');

    try {
      localStorage.setItem('wordtap_theme', currentTheme);
      if (window.WordTapAPI && window.WordTapAPI.saveConfig) {
        window.WordTapAPI.saveConfig({ theme: currentTheme });
      }
    } catch {}

    if (showToastFeedback) {
      showToast(effective === 'light' ? 'Light Mode Enabled' : 'Dark Mode Enabled');
    }
  }

  function toggleTheme() {
    const isCurrentlyLight = document.body.classList.contains('light-theme');
    const nextTheme = isCurrentlyLight ? 'dark' : 'light';
    applyTheme(nextTheme, true);
  }

  let isAudioTranscoded = false;
  let audioStreamStartTime = 0;
  let liveAudioResyncing = false;
  let audioDelayMs = 0;
  let audioSyncLoop = null;
  let userVolume = 1.0;
  let userMuted = false;
  let vlsubSearchResults = [];
  let selectedVlsubIndex = -1;

  // Video Aspect Ratio Control (VLC Style with DAR & Aspect Presets)
  const aspectRatios = [
    { label: 'Default (Auto)', value: 'auto' },
    { label: '16:9 (Widescreen)', value: '16/9' },
    { label: '4:3 (Standard TV)', value: '4/3' },
    { label: '16:10', value: '16/10' },
    { label: '2.35:1 (Cinema)', value: '2.35/1' },
    { label: '1:1 (Square)', value: '1/1' },
    { label: 'Fill Window', value: 'fill' }
  ];
  let currentAspectIndex = 0;
  let currentAspectVal = 'auto';

  function parseAspectRatioNumber(aspectVal) {
    if (!aspectVal || aspectVal === 'auto' || aspectVal === 'fill') return null;
    const parts = String(aspectVal).split('/');
    if (parts.length !== 2) return null;
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    return w / h;
  }

  function applyAspectRatioLayout() {
    if (!video) return;
    video.style.backgroundColor = '#000000';
    if (currentAspectVal === 'auto') {
      video.style.aspectRatio = 'auto';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.maxWidth = '100%';
      video.style.maxHeight = '100%';
      video.style.objectFit = 'contain';
      return;
    }
    if (currentAspectVal === 'fill') {
      video.style.aspectRatio = 'auto';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.maxWidth = '100%';
      video.style.maxHeight = '100%';
      video.style.objectFit = 'cover';
      return;
    }

    const ratio = parseAspectRatioNumber(currentAspectVal);
    const wrap = video.parentElement;
    if (ratio && wrap && wrap.clientWidth > 0 && wrap.clientHeight > 0) {
      const wrapW = wrap.clientWidth;
      const wrapH = wrap.clientHeight;
      if (wrapW / wrapH > ratio) {
        video.style.height = `${wrapH}px`;
        video.style.width = `${Math.round(wrapH * ratio)}px`;
      } else {
        video.style.width = `${wrapW}px`;
        video.style.height = `${Math.round(wrapW / ratio)}px`;
      }
      video.style.aspectRatio = 'auto';
      video.style.maxWidth = '100%';
      video.style.maxHeight = '100%';
      video.style.objectFit = 'fill';
    } else {
      video.style.aspectRatio = currentAspectVal;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.maxWidth = '100%';
      video.style.maxHeight = '100%';
      video.style.objectFit = 'contain';
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', applyAspectRatioLayout);
    if (typeof ResizeObserver !== 'undefined' && video && video.parentElement) {
      const ro = new ResizeObserver(() => applyAspectRatioLayout());
      ro.observe(video.parentElement);
    }
  }

  function setAspectRatio(aspectVal, label, showMessage = true) {
    if (!video) return;
    currentAspectVal = aspectVal || 'auto';
    applyAspectRatioLayout();
    const idx = aspectRatios.findIndex(a => a.value === aspectVal);
    if (idx !== -1) currentAspectIndex = idx;
    if (showMessage) {
      showToast(`Aspect Ratio: ${label}`);
    }
  }

  function cycleAspectRatio() {
    currentAspectIndex = (currentAspectIndex + 1) % aspectRatios.length;
    const item = aspectRatios[currentAspectIndex];
    setAspectRatio(item.value, item.label, true);
  }

  // Web Audio API Gain Pipeline for true sound amplification up to 150% and 5.1/7.1 Voice Protection
  let audioContext = null;
  let videoSourceNode = null;
  let videoGainNode = null;
  let compatibleAudioSourceNode = null;
  let compatibleAudioGainNode = null;

  function resumeAudioContext() {
    try {
      if (audioContext && (audioContext.state === 'suspended' || audioContext.state === 'interrupted')) {
        audioContext.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('resumeAudioContext notice:', e);
    }
  }

  // Auto-recovery listeners on window focus and DOM interactions (crucial after Google login or window switches)
  window.addEventListener('focus', () => {
    resumeAudioContext();
    if (isAudioTranscoded && compatibleAudio && compatibleAudio.src && video && !video.paused && compatibleAudio.paused) {
      compatibleAudio.play().catch(() => {});
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      resumeAudioContext();
      if (isAudioTranscoded && compatibleAudio && compatibleAudio.src && video && !video.paused && compatibleAudio.paused) {
        compatibleAudio.play().catch(() => {});
      }
    }
  });
  window.addEventListener('pointerdown', () => resumeAudioContext(), { passive: true });
  window.addEventListener('keydown', () => resumeAudioContext(), { passive: true });

  function ensureAudioNodes() {
    try {
      if (!audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          audioContext = new AudioCtx({ latencyHint: 'playback' });

          // CRITICAL FOR 5.1 / 7.1 DIALOGUE REPRODUCTION:
          // Ensure the audio destination is explicitly configured for stereo output with speaker downmixing.
          // This forces 5.1/7.1 center channel (speech/dialogue) to downmix into L and R channels
          // instead of disappearing into an unplugged physical Center speaker jack!
          if (audioContext.destination) {
            try {
              audioContext.destination.channelCount = 2;
              audioContext.destination.channelInterpretation = 'speakers';
              audioContext.destination.channelCountMode = 'explicit';
            } catch (destErr) {
              console.warn('Destination channel config notice:', destErr);
            }
          }

          // Auto-resume whenever AudioContext state transitions to suspended or interrupted
          audioContext.onstatechange = () => {
            if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
              audioContext.resume().catch(() => {});
            }
          };
        }
      }

      resumeAudioContext();

      if (audioContext && !videoSourceNode && video) {
        videoSourceNode = audioContext.createMediaElementSource(video);
        videoGainNode = audioContext.createGain();

        // Explicit 2-channel downmixing on GainNode guarantees that multi-channel audio
        // distributes Center dialogue evenly across stereo left/right channels.
        videoGainNode.channelCount = 2;
        videoGainNode.channelCountMode = 'explicit';
        videoGainNode.channelInterpretation = 'speakers';

        videoSourceNode.connect(videoGainNode);
        videoGainNode.connect(audioContext.destination);
      }

      if (audioContext && !compatibleAudioSourceNode && compatibleAudio) {
        compatibleAudioSourceNode = audioContext.createMediaElementSource(compatibleAudio);
        compatibleAudioGainNode = audioContext.createGain();

        compatibleAudioGainNode.channelCount = 2;
        compatibleAudioGainNode.channelCountMode = 'explicit';
        compatibleAudioGainNode.channelInterpretation = 'speakers';

        compatibleAudioSourceNode.connect(compatibleAudioGainNode);
        compatibleAudioGainNode.connect(audioContext.destination);
      }
    } catch (e) {
      console.warn('AudioContext / GainNode setup:', e);
    }
  }

  // Volume & Sound Handling (Direct Native Hardware-Locked Audio - 100% Reliable with 150% Boost)
  function updateVolumeDisplay() {
    resumeAudioContext();
    if (typeof userVolume !== 'number' || isNaN(userVolume) || userVolume < 0) {
      userVolume = 1.0;
    }
    userVolume = Math.min(1.5, Math.max(0, userVolume));

    const pct = Math.round(userVolume * 100);
    if (volumeSlider) volumeSlider.value = userVolume;

    // Update Slider Track Fill (VLC style with boost indicator up to 150%)
    const sliderRatio = Math.min(100, Math.max(0, (userVolume / 1.5) * 100));
    const normalRatio = (1.0 / 1.5) * 100; // ~66.7% (100% mark)
    if (volumeSlider) {
      const isLight = document.body && document.body.classList.contains('light-theme');
      const emptyBg = isLight ? 'rgba(30, 37, 80, 0.12)' : 'rgba(255, 255, 255, 0.2)';
      if (userMuted || userVolume === 0) {
        volumeSlider.style.background = emptyBg;
      } else if (pct > 100) {
        // Boost portion (>100%) shown in vibrant VLC orange/amber
        volumeSlider.style.background = `linear-gradient(to right, #F36F21 0%, #F36F21 ${normalRatio}%, #ff9800 ${normalRatio}%, #ff9800 ${sliderRatio}%, ${emptyBg} ${sliderRatio}%, ${emptyBg} 100%)`;
      } else {
        volumeSlider.style.background = `linear-gradient(to right, #F36F21 0%, #F36F21 ${sliderRatio}%, ${emptyBg} ${sliderRatio}%, ${emptyBg} 100%)`;
      }
    }

    if (volumePercentLabel) {
      if (userMuted || userVolume === 0) {
        volumePercentLabel.textContent = 'Muted';
        volumePercentLabel.style.color = '#72768a';
        volumePercentLabel.style.fontWeight = '600';
        if (iconVolHigh) iconVolHigh.style.display = 'none';
        if (iconVolMute) iconVolMute.style.display = 'block';
      } else {
        volumePercentLabel.textContent = `${pct}%`;
        if (pct > 100) {
          volumePercentLabel.style.color = '#F36F21';
          volumePercentLabel.style.fontWeight = '700';
        } else {
          volumePercentLabel.style.color = '#9c9da6';
          volumePercentLabel.style.fontWeight = '600';
        }
        if (iconVolHigh) iconVolHigh.style.display = 'block';
        if (iconVolMute) iconVolMute.style.display = 'none';
      }
    }

    // Direct Native Audio Routing with Gain Amplification up to 150%
    const isMuted = userMuted || userVolume === 0;
    const targetGain = isMuted ? 0 : userVolume;

    if (videoGainNode) {
      video.muted = isAudioTranscoded ? true : isMuted;
      video.volume = isAudioTranscoded ? 0 : 1.0;
      videoGainNode.gain.value = isAudioTranscoded ? 0 : targetGain;
    } else if (video) {
      video.muted = isAudioTranscoded ? true : isMuted;
      video.volume = isAudioTranscoded ? 0 : Math.max(0, Math.min(1.0, userVolume));
    }

    if (compatibleAudioGainNode) {
      compatibleAudio.muted = !isAudioTranscoded ? true : isMuted;
      compatibleAudio.volume = !isAudioTranscoded ? 0 : 1.0;
      compatibleAudioGainNode.gain.value = !isAudioTranscoded ? 0 : targetGain;
    } else if (compatibleAudio) {
      compatibleAudio.muted = !isAudioTranscoded ? true : isMuted;
      compatibleAudio.volume = !isAudioTranscoded ? 0 : Math.max(0, Math.min(1.0, userVolume));
    }
  }

  function toggleMute() {
    ensureAudioNodes();
    resumeAudioContext();
    userMuted = !userMuted;
    if (!userMuted && userVolume <= 0.05) {
      userVolume = 1.0;
    }
    updateVolumeDisplay();
    showToast(userMuted ? 'Muted' : `Volume: ${Math.round(userVolume * 100)}%`);
  }

  function adjustVolume(delta) {
    ensureAudioNodes();
    resumeAudioContext();
    userVolume = Math.max(0, Math.min(1.5, Math.round((userVolume + delta) * 100) / 100));
    if (userVolume > 0) userMuted = false;
    updateVolumeDisplay();
    if (window.WordTapAPI && window.WordTapAPI.saveConfig) {
      window.WordTapAPI.saveConfig({ volume: userVolume });
    }
    showToast(`Volume: ${Math.round(userVolume * 100)}%`);
  }

  function setVolume(val) {
    ensureAudioNodes();
    resumeAudioContext();
    userVolume = Math.max(0, Math.min(1.5, Math.round(val * 100) / 100));
    if (userVolume > 0) userMuted = false;
    updateVolumeDisplay();
    if (window.WordTapAPI && window.WordTapAPI.saveConfig) {
      window.WordTapAPI.saveConfig({ volume: userVolume });
    }
  }

  // Active Precision Audio-Video Lip-Sync Engine with Auto-Recovery
  function syncAudioWithVideo() {
    if (!isAudioTranscoded || !compatibleAudio || !compatibleAudio.src || isScrubbing) {
      return;
    }

    // Auto-recovery: If video is playing but compatibleAudio paused or stalled, resume it immediately
    if (!video.paused && compatibleAudio.paused) {
      resumeAudioContext();
      compatibleAudio.play().catch(() => {});
      return;
    }

    if (compatibleAudio.paused || video.paused) {
      return;
    }

    const audioElapsed = compatibleAudio.currentTime || 0;
    const currentAudioTime = audioStreamStartTime + audioElapsed + (audioDelayMs / 1000);
    const currentVideoTime = video.currentTime;
    const drift = currentVideoTime - currentAudioTime; // Positive: video ahead. Negative: audio ahead.

    if (Math.abs(drift) > 0.45) {
      // Large drift: snap video directly to audio timestamp (instant zero-stutter alignment)
      video.currentTime = Math.max(0, currentAudioTime);
      compatibleAudio.playbackRate = video.playbackRate;
    } else if (drift > 0.035) {
      // Audio is lagging slightly (35ms - 450ms): nudge audio rate +4% to smoothly close gap
      compatibleAudio.playbackRate = video.playbackRate * 1.04;
    } else if (drift < -0.035) {
      // Audio is ahead slightly (35ms - 450ms): nudge audio rate -4% to allow video to catch up
      compatibleAudio.playbackRate = video.playbackRate * 0.96;
    } else {
      // Sample-accurate lip-sync lock (within 35ms)
      compatibleAudio.playbackRate = video.playbackRate;
    }
  }

  function adjustAudioDelay(deltaMs) {
    audioDelayMs += deltaMs;
    const sign = audioDelayMs > 0 ? '+' : '';
    showToast(`Audio delay: ${sign}${audioDelayMs} ms`);
    syncAudioWithVideo();
  }

  function togglePlay() {
    if (wordPopover && wordPopover.classList.contains('visible')) {
      closePopover(true);
      return;
    }
    if (!video) return;
    ensureAudioNodes();
    updateVolumeDisplay();
    if (video.paused) {
      if (!isAudioTranscoded) {
        video.muted = userMuted;
        video.play().catch(() => {});
      } else {
        if (compatibleAudio && compatibleAudio.src) {
          const audioElapsed = compatibleAudio.currentTime || 0;
          const currentAudioTime = audioStreamStartTime + audioElapsed + (audioDelayMs / 1000);
          if (Math.abs(video.currentTime - currentAudioTime) > 0.4) {
            startLiveAudioStream(video.currentTime);
          } else {
            video.currentTime = Math.max(0, currentAudioTime);
            compatibleAudio.play().catch(() => {});
            video.play().catch(() => {});
          }
        } else {
          startLiveAudioStream(video.currentTime);
        }
      }
    } else {
      video.pause();
      if (isAudioTranscoded && compatibleAudio && !compatibleAudio.paused) {
        compatibleAudio.pause();
      }
    }
  }

  function replayCurrentLine() {
    if (!video) return;
    ensureAudioNodes();
    updateVolumeDisplay();
    if (currentCue) {
      const target = Math.max(0, currentCue.start + (subtitleDelayMs / 1000));
      video.currentTime = target;
      if (isAudioTranscoded && currentFilePath) {
        startLiveAudioStream(target);
      }
      video.play().catch(() => {});
      showToast('Replaying line');
    } else if (cues.length > 0) {
      const cur = video.currentTime - (subtitleDelayMs / 1000);
      const prevCue = [...cues].reverse().find(c => c.start <= cur);
      if (prevCue) {
        const target = Math.max(0, prevCue.start + (subtitleDelayMs / 1000));
        video.currentTime = target;
        if (isAudioTranscoded && currentFilePath) {
          startLiveAudioStream(target);
        }
        video.play().catch(() => {});
        showToast('Replaying line');
      }
    }
  }

  function closeAllMenus() {
    const menuDropdowns = document.querySelectorAll('.vlc-menu-dropdown');
    menuDropdowns.forEach(d => d.classList.remove('open'));
  }

  // Explicit Audio Initialization
  function initAudio() {
    try {
      updateVolumeDisplay();
    } catch (err) {
      console.warn('initAudio notice:', err);
    }
  }

  // Auth Gate helpers
  function showLoginGate() {
    if (authGateScreen) {
      authGateScreen.classList.remove('hidden');
      authGateScreen.style.display = 'flex';
      authGateScreen.style.visibility = 'visible';
      authGateScreen.style.opacity = '1';
      authGateScreen.style.pointerEvents = 'auto';
      if (gateAuthError) gateAuthError.style.display = 'none';
      setTimeout(() => {
        if (gateEmail) gateEmail.focus();
      }, 100);
    }
  }

  function hideLoginGate() {
    if (authGateScreen) {
      authGateScreen.classList.add('hidden');
      authGateScreen.style.display = 'none';
      authGateScreen.style.visibility = 'hidden';
      authGateScreen.style.opacity = '0';
      authGateScreen.style.pointerEvents = 'none';
    }
  }

  let authGateSetupDone = false;
  function setupAuthGate() {
    if (authGateSetupDone) return;
    authGateSetupDone = true;

    // Google Sign-In on Gate
    if (btnGateGoogle) {
      btnGateGoogle.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.WordTapAPI || !window.WordTapAPI.signInWithGoogle) {
          if (gateAuthError) {
            gateAuthError.textContent = 'Google sign-in is not supported in this build.';
            gateAuthError.style.display = 'block';
          }
          return;
        }

        btnGateGoogle.disabled = true;
        if (gateGoogleText) gateGoogleText.textContent = 'Connecting to Google…';
        if (gateAuthError) gateAuthError.style.display = 'none';

        try {
          const session = await window.WordTapAPI.signInWithGoogle();
          if (session && session.access_token) {
            userSession = session;
            connectionIssue = null;
            if (window.WordTapAPI.saveConfig) {
              await window.WordTapAPI.saveConfig({ session: userSession });
            }
            updateAccountUI();
            hideLoginGate();
            ensureAudioNodes();
            resumeAudioContext();
            updateVolumeDisplay();
            showToast(`Welcome back, ${userSession.email}!`);
            pushPendingOfflineWords();
          }
        } catch (err) {
          if (gateAuthError) {
            gateAuthError.textContent = err.message || 'Google sign-in was cancelled or failed.';
            gateAuthError.style.display = 'block';
          }
        } finally {
          btnGateGoogle.disabled = false;
          if (gateGoogleText) gateGoogleText.textContent = 'Continue with Google';
        }
      });
    }

    // Paste Sign-In Key Handlers (Fallback for strict browser sandboxes)
    async function handlePasteKeyPrompt() {
      const raw = prompt('Paste your WordTap Sign-In Key from the web browser:');
      if (!raw || !raw.trim()) return;
      try {
        if (!window.WordTapAPI || !window.WordTapAPI.importSessionKey) {
          alert('Key import is not supported in this version.');
          return;
        }
        const session = await window.WordTapAPI.importSessionKey(raw.trim());
        if (session && session.email) {
          userSession = session;
          connectionIssue = null;
          if (window.WordTapAPI.saveConfig) {
            await window.WordTapAPI.saveConfig({ session: userSession });
          }
          updateAccountUI();
          hideLoginGate();
          if (accountModal) accountModal.classList.remove('open');
          ensureAudioNodes();
          resumeAudioContext();
          updateVolumeDisplay();
          showToast(`Connected as ${userSession.email}`);
          pushPendingOfflineWords();
        }
      } catch (err) {
        alert(`Invalid sign-in key: ${err.message}`);
      }
    }

    if (btnGatePasteKey) {
      btnGatePasteKey.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void handlePasteKeyPrompt();
      });
    }

    if (btnAccountPasteKey) {
      btnAccountPasteKey.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void handlePasteKeyPrompt();
      });
    }

    // Continue as Guest (Offline Mode)
    if (btnGateOffline) {
      btnGateOffline.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideLoginGate();
        updateAccountUI();
        showToast('Running in Offline Mode');
      });
    }

    // Create WordTap Account link
    if (btnGateCreateAcc) {
      btnGateCreateAcc.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.WordTapAPI && window.WordTapAPI.openExternal) {
          window.WordTapAPI.openExternal(WEBSITE_URL + '/signup');
        }
      });
    }

    // Gate Login Form submission
    if (gateLoginForm) {
      gateLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const email = gateEmail ? gateEmail.value.trim() : '';
        const password = gatePassword ? gatePassword.value : '';
        if (!email || !password) {
          if (gateAuthError) {
            gateAuthError.textContent = 'Please enter both your email address and password.';
            gateAuthError.style.display = 'block';
          }
          return;
        }

        if (btnGateSignin) {
          btnGateSignin.disabled = true;
          btnGateSignin.textContent = 'Signing in...';
        }
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
            throw new Error(data.error_description || data.msg || data.message || 'Incorrect email or password');
          }

          userSession = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
            email: data.user ? data.user.email : email,
            user_id: data.user ? data.user.id : ''
          };
          connectionIssue = null;

          if (window.WordTapAPI && window.WordTapAPI.saveConfig) {
            await window.WordTapAPI.saveConfig({ session: userSession });
          }
          updateAccountUI();
          hideLoginGate();
          showToast(`Welcome back, ${userSession.email}!`);
          pushPendingOfflineWords();
        } catch (err) {
          if (gateAuthError) {
            gateAuthError.textContent = err.message || 'Login failed. Please check credentials or continue as guest.';
            gateAuthError.style.display = 'block';
          }
        } finally {
          if (btnGateSignin) {
            btnGateSignin.disabled = false;
            btnGateSignin.textContent = 'Sign In & Open Player';
          }
        }
      });
    }
  }

  // Sync UI with extension word saving mode & options
  function syncOptionsUI() {
    [btnModeManual, btnModeSubs, btnModeAuto].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    if (translateSaveMode === 'manual') {
      if (btnModeManual) btnModeManual.classList.add('active');
      if (saveModeHelper) saveModeHelper.textContent = 'Only saves when you click the save button';
    } else if (translateSaveMode === 'auto') {
      if (btnModeAuto) btnModeAuto.classList.add('active');
      if (saveModeHelper) saveModeHelper.textContent = 'Auto-saves all clicked words immediately';
    } else {
      translateSaveMode = 'subtitles_only';
      if (btnModeSubs) btnModeSubs.classList.add('active');
      if (saveModeHelper) saveModeHelper.textContent = 'Auto-saves words clicked in video subtitles';
    }

    if (optTargetLang) {
      optTargetLang.value = targetLang || 'ar';
    }

    if (chkPauseOnClick) {
      chkPauseOnClick.checked = !!pauseOnClick;
    }
  }

  // Initialize App
  async function init() {
    setupAuthGate();
    setupEvents();

    // Listen for incoming authenticated sessions via deep link (wordtap://auth) or loopback bridge
    if (window.WordTapAPI && window.WordTapAPI.onAuthSession) {
      window.WordTapAPI.onAuthSession(async (session) => {
        if (session && session.email) {
          userSession = session;
          connectionIssue = null;
          if (window.WordTapAPI.saveConfig) {
            await window.WordTapAPI.saveConfig({ session: userSession });
          }
          updateAccountUI();
          hideLoginGate();
          if (accountModal) accountModal.classList.remove('open');
          ensureAudioNodes();
          resumeAudioContext();
          if (video && !video.paused) {
            video.muted = isAudioTranscoded ? true : userMuted;
          }
          if (isAudioTranscoded && compatibleAudio && compatibleAudio.src && video && !video.paused) {
            compatibleAudio.muted = userMuted;
            compatibleAudio.play().catch(() => {});
          }
          updateVolumeDisplay();
          showToast(`Welcome back, ${userSession.email}!`);
          pushPendingOfflineWords();
        }
      });
    }

    try {
      initAudio();
    } catch (e) {
      console.warn('initAudio error:', e);
    }

    try {
      const config = await window.WordTapAPI.getConfig();
      if (config && config.session && config.session.access_token) {
        userSession = config.session;
        updateAccountUI();
        hideLoginGate();
        checkConnectionHealth(true).then((state) => {
          if (state === 'connected') pushPendingOfflineWords();
        });
      } else {
        updateAccountUI();
        showLoginGate();
      }
      subtitleDelayMs = 0;
      updateSyncDelayUI();
      if (config) {
        if (typeof config.subCustomSize === 'number' && config.subCustomSize >= 14 && config.subCustomSize <= 72) {
          subCustomSize = config.subCustomSize;
        } else if (typeof config.subSizeIdx === 'number' && config.subSizeIdx >= 0 && config.subSizeIdx < subSizes.length) {
          subCustomSize = subSizes[config.subSizeIdx].size || 28;
        }
        if (config.subFontFamily) subFontFamily = config.subFontFamily;
        if (config.subTextColor) subTextColor = config.subTextColor;
        if (config.subBgStyle) subBgStyle = config.subBgStyle;
        if (config.subFontWeight) subFontWeight = config.subFontWeight;
        if (typeof config.subBottomOffset === 'number') subBottomOffset = config.subBottomOffset;
      }
      if (config && config.translateSaveMode) {
        translateSaveMode = config.translateSaveMode;
      }
      if (config && typeof config.pauseOnClick === 'boolean') {
        pauseOnClick = config.pauseOnClick;
      }
      if (config && config.targetLang) {
        targetLang = config.targetLang;
      }
      if (config && typeof config.volume === 'number' && config.volume > 0.05 && config.volume <= 1.5) {
        userVolume = config.volume;
      } else {
        userVolume = 1.0;
      }
      userMuted = false;
      if (config && config.theme) {
        currentTheme = config.theme;
      } else {
        currentTheme = localStorage.getItem('wordtap_theme') || 'dark';
      }
      applyTheme(currentTheme, false);

      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          if (currentTheme === 'system') {
            applyTheme('system', false);
          }
        });
      }

      syncOptionsUI();
      applySubtitleAppearance();
      updateVolumeDisplay();
      refreshSavedWordsCount();

      if (window.WordTapAPI && window.WordTapAPI.isFullscreen) {
        window.WordTapAPI.isFullscreen().then(isFS => {
          if (isFS) setFullscreenState(true);
        }).catch(() => {});
      }

      // Check if launched directly with a video file (Windows Explorer "Open with" or double-click) or resume latest session
      if (window.WordTapAPI && window.WordTapAPI.getInitialFile) {
        try {
          const initFile = await window.WordTapAPI.getInitialFile();
          if (initFile && initFile.fileUrl) {
            playVideoFile(
              initFile.fileUrl,
              initFile.fileName,
              initFile.subContent,
              initFile.filePath,
              initFile.subtitleDelayMs || 0,
              initFile.savedTime || 0,
              initFile.subFile
            );
            hideLoginGate();
            if (initFile.isRestoredSession) {
              const timeFormatted = formatTime(initFile.savedTime || 0);
              const syncStr = (initFile.subtitleDelayMs !== 0) ? ` | Sync: ${initFile.subtitleDelayMs > 0 ? '+' : ''}${initFile.subtitleDelayMs}ms` : '';
              showToast(`Resumed at ${timeFormatted}${syncStr}`);
            }
          }
        } catch (err) {
          console.warn('Initial file launch check:', err);
        }
      }
    } catch (e) {
      console.warn('Config load error:', e);
      showLoginGate();
    }
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
    if (!toastEl) return;
    clearTimeout(toastTimer);
    // Authentic VLC On-Screen Display: Clean desktop typography without emoji clutter
    const cleanMsg = String(msg).replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}🔊⏹✓★↺⏪⏩]/gu, '').trim();
    toastEl.textContent = cleanMsg || msg;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 1500);
  }

  // Comprehensive Subtitle Appearance & Style Management
  function applySubtitleAppearance() {
    document.documentElement.style.setProperty('--sub-font-size', `${subCustomSize}px`);
    document.documentElement.style.setProperty('--sub-font-family', subFontFamily);
    document.documentElement.style.setProperty('--sub-text-color', subTextColor);
    document.documentElement.style.setProperty('--sub-font-weight', subFontWeight);
    document.documentElement.style.setProperty('--sub-bottom-offset', `${subBottomOffset}px`);

    let bgColor = 'transparent';
    let padding = '2px 8px';
    if (subBgStyle === 'translucent') {
      bgColor = 'rgba(0, 0, 0, 0.65)';
      padding = '4px 12px';
    } else if (subBgStyle === 'solid') {
      bgColor = '#000000';
      padding = '4px 12px';
    }
    document.documentElement.style.setProperty('--sub-bg-color', bgColor);
    document.documentElement.style.setProperty('--sub-bg-padding', padding);

    const fontDisplayName = getFontDisplayName(subFontFamily);
    const menuFontText = document.getElementById('menu-font-text');
    if (menuFontText) {
      menuFontText.textContent = `Font Type: ${fontDisplayName}`;
    }
    const menuSizeText = document.getElementById('menu-size-text');
    if (menuSizeText) {
      menuSizeText.textContent = `Font Size: ${subCustomSize}px`;
    }

    // Update active checkmarks in Font Family flyout submenu
    const fontItems = document.querySelectorAll('.sub-font-item');
    fontItems.forEach(item => {
      const f = item.getAttribute('data-font');
      const key = item.getAttribute('data-font-key');
      const isActive = f === subFontFamily || (key && subFontFamily && (
        subFontFamily.toLowerCase().startsWith(key.toLowerCase() + ',') ||
        subFontFamily.toLowerCase().startsWith('"' + key.toLowerCase())
      ));
      item.classList.toggle('active', !!isActive);
    });

    // Update active checkmarks in Font Size flyout submenu
    const sizeItems = document.querySelectorAll('.sub-size-item');
    sizeItems.forEach(item => {
      const sz = parseInt(item.getAttribute('data-size'), 10);
      item.classList.toggle('active', sz === subCustomSize);
    });

    syncSubStyleModalUI();
  }

  const availableFonts = [
    { name: 'Arial (Classic Cinema)', family: 'Arial, "Trebuchet MS", sans-serif' },
    { name: 'Trebuchet MS (Rounded)', family: '"Trebuchet MS", Arial, sans-serif' },
    { name: 'Segoe UI (Windows System)', family: '"Segoe UI", Tahoma, sans-serif' },
    { name: 'Roboto / Inter (Modern Sans)', family: 'Roboto, Inter, -apple-system, sans-serif' },
    { name: 'Verdana (Wide Legibility)', family: 'Verdana, Geneva, sans-serif' },
    { name: 'Tahoma (Clean Compact)', family: 'Tahoma, Arial, sans-serif' },
    { name: 'Impact (Heavy Cinema)', family: 'Impact, "Arial Black", sans-serif' },
    { name: 'Cairo (Arabic & English)', family: 'Cairo, "Segoe UI", Arial, sans-serif' },
    { name: 'Georgia (Serif)', family: 'Georgia, "Times New Roman", serif' },
    { name: 'Courier New (Monospace)', family: '"Courier New", Consolas, monospace' }
  ];

  function getFontDisplayName(family) {
    if (!family) return 'Arial (Classic Cinema)';
    const found = availableFonts.find(f => f.family === family || family.toLowerCase().includes(f.name.split(' ')[0].toLowerCase()));
    if (found) return found.name;
    return family.split(',')[0].replace(/['"]/g, '').trim();
  }

  function cycleSubFont() {
    let currentIdx = availableFonts.findIndex(f => f.family === subFontFamily || subFontFamily.includes(f.name.split(' ')[0]));
    if (currentIdx === -1) currentIdx = 0;
    const nextIdx = (currentIdx + 1) % availableFonts.length;
    subFontFamily = availableFonts[nextIdx].family;
    saveSubtitleAppearance(true);
  }

  function saveSubtitleAppearance(showNotification = false) {
    applySubtitleAppearance();
    if (window.WordTapAPI && window.WordTapAPI.saveConfig) {
      window.WordTapAPI.saveConfig({
        subCustomSize,
        subFontFamily,
        subTextColor,
        subBgStyle,
        subFontWeight,
        subBottomOffset
      });
    }
    if (showNotification) {
      const fontName = getFontDisplayName(subFontFamily);
      showToast(`Subtitle: ${subCustomSize}px | ${fontName}`);
    }
  }

  function applySubSize(index) {
    if (index >= 0 && index < subSizes.length) {
      subCustomSize = subSizes[index].size || 28;
      saveSubtitleAppearance(false);
    }
  }

  function cycleSubSize() {
    const presetSizes = [22, 28, 31, 36, 44];
    const currentIdx = presetSizes.indexOf(subCustomSize);
    const nextIdx = (currentIdx + 1) % presetSizes.length;
    subCustomSize = presetSizes[nextIdx];
    saveSubtitleAppearance(true);
  }

  function adjustSubCustomSize(delta) {
    subCustomSize = Math.max(14, Math.min(72, subCustomSize + delta));
    saveSubtitleAppearance(true);
  }

  function syncSubStyleModalUI() {
    if (!subtitleStyleModal) return;
    if (subSelectFont) subSelectFont.value = subFontFamily;
    if (subSizeSlider) subSizeSlider.value = subCustomSize;
    if (subSizeInput) subSizeInput.value = subCustomSize;
    if (subOffsetSlider) subOffsetSlider.value = Math.max(0, Math.min(600, subBottomOffset));
    if (subOffsetInput) subOffsetInput.value = subBottomOffset;
    if (subOffsetValue) subOffsetValue.textContent = `${subBottomOffset}px`;

    // Size preset buttons
    document.querySelectorAll('.sub-preset-btn').forEach(btn => {
      const sz = parseInt(btn.getAttribute('data-size'), 10);
      btn.classList.toggle('active', sz === subCustomSize);
    });

    // Position offset presets buttons
    document.querySelectorAll('.sub-offset-preset-btn').forEach(btn => {
      const off = parseInt(btn.getAttribute('data-offset'), 10);
      btn.classList.toggle('active', off === subBottomOffset);
    });

    // Color pills & custom wrap highlight
    let matchedPreset = false;
    document.querySelectorAll('.sub-color-pill').forEach(pill => {
      const col = pill.getAttribute('data-color');
      const isMatch = col && col.toLowerCase() === subTextColor.toLowerCase();
      pill.classList.toggle('active', isMatch);
      if (isMatch) matchedPreset = true;
    });
    if (subCustomColor) subCustomColor.value = subTextColor;
    const customColorWrap = document.querySelector('.custom-color-picker-wrap');
    if (customColorWrap) {
      customColorWrap.classList.toggle('active', !matchedPreset);
    }

    // Background control buttons
    if (subBgStyleControl) {
      subBgStyleControl.querySelectorAll('.segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-bg') === subBgStyle);
      });
    }

    // Weight control buttons
    if (subWeightControl) {
      subWeightControl.querySelectorAll('.segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-weight') === subFontWeight);
      });
    }
  }

  function openSubtitleStyleModal() {
    closeAllMenus();
    if (subtitleStyleModal) {
      syncSubStyleModalUI();
      subtitleStyleModal.classList.add('open');
    }
  }

  function closeSubtitleStyleModal() {
    if (subtitleStyleModal) {
      subtitleStyleModal.classList.remove('open');
    }
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
  function loadSubtitles(content, label = 'Subtitle loaded', subFilePath = null, preserveSync = false) {
    if (!preserveSync) {
      subtitleDelayMs = 0;
      updateSyncDelayUI();
    }
    cues = parseSubtitles(content);
    currentSubContent = content;
    if (subFilePath) currentSubPath = subFilePath;
    currentSubFileName = label;
    saveCurrentMediaSession();
    showToast(`Subtitles: ${cues.length} lines loaded`);
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

    prefetchCueWords(cue);
  }

  // Lookahead Pre-fetching for Active Cue Words (0ms Instant Translation Experience)
  const prefetchedSet = new Set();
  function prefetchCueWords(cue) {
    if (!cue || !cue.text) return;
    const words = (cue.text.match(/[a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?/g) || [])
      .map(w => w.toLowerCase())
      .filter(w => w.length > 2);

    const langToUse = currentTargetLang || 'ar';
    const uniqueUncached = Array.from(new Set(words)).filter(
      w => !translationCache.has(`${langToUse}:${w}`) && !prefetchedSet.has(`${langToUse}:${w}`)
    ).slice(0, 4);

    if (uniqueUncached.length === 0) return;

    for (const word of uniqueUncached) {
      prefetchedSet.add(`${langToUse}:${word}`);
      setTimeout(async () => {
        try {
          const res = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(langToUse)}&dt=t&dt=bd&q=${encodeURIComponent(word)}`,
            { signal: AbortSignal.timeout(2000) }
          );
          if (res.ok) {
            const data = await res.json();
            if (data && data[0] && data[0][0] && data[0][0][0]) {
              const tr = data[0][0][0];
              const p = (data[1] && data[1][0] && data[1][0][0]) || 'word';
              const alts = (data[1] && data[1][0] && Array.isArray(data[1][0][1])) ? data[1][0][1].slice(0, 4) : [];
              saveToCache(`${langToUse}:${word}`, {
                translation: tr,
                pos: p,
                alternatives: alts,
                timestamp: Date.now()
              });
            }
          }
        } catch (_) {}
      }, 60);
    }
  }

  // Schedule popover dismiss timer (default 850ms = 0.85s, paused while hovered or when video is paused)
  const AUTO_CLOSE_DELAY_MS = 850;

  function updatePopoverFooter() {
    if (!popoverFooterText) return;
    if (video && video.paused) {
      popoverFooterText.innerHTML = 'Paused • Press <strong>Space</strong> or <strong>Esc</strong> to resume video';
    } else {
      popoverFooterText.innerHTML = 'Hover to keep open • Auto-closes in 0.85s';
    }
  }

  function schedulePopoverClose(delayMs = AUTO_CLOSE_DELAY_MS) {
    clearTimeout(popoverHideTimer);
    if (!wordPopover) return;
    updatePopoverFooter();
    // When video is paused, do NOT auto-close! Keep open for studying/reading.
    if (video && video.paused) {
      return;
    }
    // When hovered, do not close
    if (wordPopover.dataset.hovered) {
      return;
    }
    popoverHideTimer = setTimeout(() => {
      closePopover(false);
    }, delayMs);
  }

  // Word Click Handler - Options Respecting & Extension Match
  async function onWordClick(element, cue) {
    // Film pause behavior: only pause if user enabled "pauseOnClick" (default: false -> film does NOT stop)
    if (pauseOnClick) {
      if (!video.paused) {
        video.pause();
        resumeVideoAfterPopover = true;
      } else {
        resumeVideoAfterPopover = false;
      }
    } else {
      resumeVideoAfterPopover = false;
    }

    const rawWord = element.dataset.raw;
    const cleanWord = element.dataset.word;
    const contextSentence = cue.text;

    activeWordData = {
      word: cleanWord,
      cleanWord: cleanWord,
      rawWord: rawWord,
      contextSentence: contextSentence,
      translation: '',
      pos: 'word'
    };

    popoverWordText.textContent = rawWord;
    popoverWordPos.textContent = '...';
    popoverTranslationAr.textContent = 'جاري الترجمة...';
    popoverContextBox.innerHTML = contextSentence.replace(
      new RegExp(`\\b(${rawWord})\\b`, 'i'),
      '<strong class="popover-context-keyword">$1</strong>'
    );

    const isAlreadySaved = savedWords.some(w => (w.text || '').toLowerCase() === cleanWord.toLowerCase());
    if (isAlreadySaved) {
      popoverBtnSave.classList.add('saved');
      popoverBtnSave.innerHTML = `${ICON_CHECK_SVG}<span>Saved to WordTap</span>`;
    } else {
      popoverBtnSave.classList.remove('saved');
      popoverBtnSave.innerHTML = `${ICON_STAR_SVG}<span>Save to WordTap</span>`;
    }

    clearTimeout(popoverHideTimer);
    updatePopoverFooter();

    // Precise placement above subtitle line: never cover the subtitle text!
    const rect = element.getBoundingClientRect();
    const subLine = element.closest('.subtitle-line') || element;
    const subLineRect = subLine.getBoundingClientRect();
    const popoverWidth = 320;
    const wrapper = document.getElementById('video-wrapper');
    const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, bottom: window.innerHeight };

    let left = (rect.left - wrapperRect.left) + (rect.width / 2) - (popoverWidth / 2);
    if (left < 16) left = 16;
    if (left + popoverWidth > wrapperRect.width - 16) left = wrapperRect.width - popoverWidth - 16;

    const clearance = 18; // 18px generous air gap directly above the subtitle text
    const bottomOffset = (wrapperRect.bottom - subLineRect.top) + clearance;

    // In the standard case (subtitles at bottom/lower half), anchor by bottom so it expands upward without covering subtitles
    if (subLineRect.top > wrapperRect.top + 260) {
      wordPopover.style.top = 'auto';
      wordPopover.style.bottom = `${bottomOffset}px`;
    } else {
      // Subtitles are near the very top of the screen; place below
      wordPopover.style.bottom = 'auto';
      wordPopover.style.top = `${(subLineRect.bottom - wrapperRect.top) + clearance}px`;
    }

    wordPopover.style.left = `${left}px`;
    wordPopover.classList.add('visible');

    // DO NOT auto-speak the English word - user requested silence on click.
    // Pronunciation is available on demand by clicking the speaker icon button.

    const langToUse = targetLang || 'ar';
    const cacheKey = `${langToUse}|${cleanWord.toLowerCase()}`;

    // Tier 1: Check in-memory & persistent translation cache (0ms lookup, 0 API calls)
    if (translationCache.has(cacheKey)) {
      const cached = translationCache.get(cacheKey);
      activeWordData.translation = cached.translation || '';
      activeWordData.pos = cached.pos || 'word';
      popoverTranslationAr.textContent = cached.translation || '—';
      popoverWordPos.textContent = cached.pos || 'word';

      const willAutoSave = (translateSaveMode === 'auto' || translateSaveMode === 'subtitles_only');
      if (willAutoSave && !isAlreadySaved) {
        saveActiveWord(true);
      }
      schedulePopoverClose(AUTO_CLOSE_DELAY_MS);
      return;
    }

    // Tier 2: Multi-client rotation with automatic failover
    const clients = ['dict-chrome-ex', 'gtx', 'webapp'];
    let translation = '';
    let pos = 'word';
    let fetchSuccess = false;

    for (const client of clients) {
      try {
        const res = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=${client}&sl=auto&tl=${encodeURIComponent(langToUse)}&dt=t&dt=bd&dt=qca&dt=at&q=${encodeURIComponent(cleanWord)}`,
          { signal: AbortSignal.timeout(1800) }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data[0] && data[0][0] && data[0][0][0]) {
            translation = data[0][0][0];
          }
          if (data && data[1] && data[1][0] && data[1][0][0]) {
            pos = data[1][0][0];
          }
          fetchSuccess = true;
          break;
        }
        if (res.status === 429) {
          console.warn(`Desktop translate client ${client} returned 429, trying next client.`);
        }
      } catch (err) {
        console.warn(`Desktop translate client ${client} error:`, err);
      }
    }

    // Tier 3: If direct endpoints failed, fall back to WordTap Web API gateway
    if (!fetchSuccess) {
      try {
        const fbRes = await fetch('https://wordtap.app/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanWord,
            target: langToUse,
            src: 'auto',
            context: activeWordData.contextSentence || '',
          }),
        });
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          if (fbData && fbData.translation) {
            translation = fbData.translation;
            pos = fbData.primaryPartOfSpeech || 'word';
            fetchSuccess = true;
          }
        }
      } catch (_) {}
    }

    if (fetchSuccess && translation) {
      activeWordData.translation = translation;
      activeWordData.pos = pos;
      popoverTranslationAr.textContent = translation || '—';
      popoverWordPos.textContent = pos;
      persistDesktopTranslation(cacheKey, { translation, pos });

      // Auto-save logic: if 'subtitles_only' or 'auto' mode is active, auto-save to WordTap!
      const willAutoSave = (translateSaveMode === 'auto' || translateSaveMode === 'subtitles_only');
      if (willAutoSave && !isAlreadySaved) {
        saveActiveWord(true);
      }
    } else {
      popoverTranslationAr.textContent = 'تعذر الاتصال بالترجمة';
    }

    schedulePopoverClose(AUTO_CLOSE_DELAY_MS);
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
    clearTimeout(popoverHideTimer);
    delete wordPopover.dataset.hovered;
    if (wordPopover.classList.contains('visible')) {
      wordPopover.classList.remove('visible');
      activeWordData = null;
      if (resume && resumeVideoAfterPopover) {
        video.play().catch(() => {});
      }
    }
    resetControlsTimeout();
  }

  // Auth Token Manager with Automatic Refresh
  let tokenRefreshPromise = null;

  async function getValidToken(force = false) {
    if (!userSession) return null;
    const now = Math.floor(Date.now() / 1000);

    if (!force && userSession.access_token && userSession.expires_at && (userSession.expires_at - 60 > now)) {
      return userSession.access_token;
    }

    if (userSession.refresh_token) {
      if (!tokenRefreshPromise) {
        tokenRefreshPromise = (async () => {
          try {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
              method: 'POST',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ refresh_token: userSession.refresh_token })
            });

            if (res.ok) {
              const data = await res.json();
              userSession.access_token = data.access_token;
              userSession.refresh_token = data.refresh_token;
              userSession.expires_at = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
              connectionIssue = null;
              if (window.WordTapAPI && window.WordTapAPI.saveConfig) {
                await window.WordTapAPI.saveConfig({ session: userSession });
              }
              updateAccountUI();
              return userSession.access_token;
            } else {
              console.warn('Refresh token rejected:', res.status);
              if (res.status === 400 || res.status === 401 || res.status === 403) {
                connectionIssue = 'auth_expired';
              } else if (res.status === 429 || res.status >= 500) {
                connectionIssue = 'suspended';
              }
              updateAccountUI();
              return null;
            }
          } catch (e) {
            console.warn('Error refreshing token:', e);
            connectionIssue = 'offline';
            updateAccountUI();
            return null;
          } finally {
            tokenRefreshPromise = null;
          }
        })();
      }
      return await tokenRefreshPromise;
    }

    return userSession.access_token;
  }

  // Save or Toggle Word Handler
  async function saveActiveWord(isAuto = false) {
    if (!activeWordData) return;
    const targetWord = (activeWordData.cleanWord || activeWordData.word || '').trim();
    if (!targetWord) return;

    const isAlreadySaved = savedWords.some(w => (w.text || '').trim().toLowerCase() === targetWord.toLowerCase());
    if (!isAuto && isAlreadySaved) {
      // Toggle off / delete word
      await deleteWordEntry(targetWord);
      popoverBtnSave.classList.remove('saved');
      popoverBtnSave.innerHTML = `${ICON_STAR_SVG}<span>Save to WordTap</span>`;
      return;
    }

    if (!isAuto) {
      popoverBtnSave.innerHTML = '<span>Saving...</span>';
    }

    const entry = {
      text: targetWord,
      translation: activeWordData.translation || '',
      sentence: activeWordData.contextSentence || '',
      title: currentMediaTitle !== 'No media loaded' ? currentMediaTitle : 'WordTap VLC Video',
      lang: targetLang || 'ar',
      src: 'en',
      createdAt: new Date().toISOString(),
      synced: false
    };

    await window.WordTapAPI.saveWord(entry);
    await refreshSavedWordsCount();

    if (userSession && !systemSuspended && navigator.onLine !== false) {
      try {
        const ok = await syncWordToSupabase(entry);
        if (ok) {
          entry.synced = true;
          await window.WordTapAPI.saveWord(entry);
        }
      } catch (err) {
        console.warn('Supabase sync background fail (queued locally):', err);
      }
    }

    popoverBtnSave.classList.add('saved');
    popoverBtnSave.innerHTML = `${ICON_CHECK_SVG}<span>Saved to WordTap</span>`;
    if (!isAuto) {
      showToast(`Saved: "${entry.text}"`);
    }
  }

  async function syncWordToSupabase(entry) {
    if (systemSuspended) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      connectionIssue = 'offline';
      updateAccountUI();
      return false;
    }

    let token = await getValidToken();
    if (!token) return false;

    const sentence = entry.sentence || '';
    const title = entry.title || '';
    const titleContext = sentence ? `"${sentence}" — ${title}` : title;

    const payload = {
      p_text: entry.text,
      p_translation: entry.translation || '',
      p_src_lang: entry.src || 'en',
      p_target_lang: entry.lang || 'ar',
      p_source_title: titleContext,
      p_source_url: 'wordtap-vlc-player',
      p_times: entry.count || 1,
      p_sentence: sentence
    };

    let res;
    try {
      res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_word`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      connectionIssue = 'offline';
      updateAccountUI();
      throw err;
    }

    if (res.status === 401) {
      token = await getValidToken(true);
      if (token) {
        try {
          res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_word`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        } catch (err) {
          connectionIssue = 'offline';
          updateAccountUI();
          throw err;
        }
      }
    }

    if (!res.ok) {
      if (res.status === 429 || res.status >= 500) {
        connectionIssue = 'suspended';
        updateAccountUI();
      } else if (res.status === 401 || res.status === 403) {
        connectionIssue = 'auth_expired';
        updateAccountUI();
      }
      const errText = await res.text();
      throw new Error(`Sync failed: HTTP ${res.status}: ${errText}`);
    }

    if (connectionIssue !== null) {
      connectionIssue = null;
      updateAccountUI();
    }

    return true;
  }

  async function refreshSavedWordsCount() {
    try {
      savedWords = await window.WordTapAPI.getSavedWords();
      savedWordsCount.textContent = `${savedWords.length} Word${savedWords.length === 1 ? '' : 's'}`;
    } catch {}
  }

  // Account / Sync Management
  function getConnectionStatus() {
    const isSignedIn = Boolean(userSession && userSession.email && userSession.access_token);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        state: 'disconnected',
        title: 'No network connection',
        subtitle: 'No network — saved offline'
      };
    }
    if (connectionIssue === 'offline') {
      return {
        state: 'disconnected',
        title: 'No network connection',
        subtitle: 'No network — saved offline'
      };
    }
    if (!isSignedIn) {
      return {
        state: 'disconnected',
        title: 'Disconnected — Sign in to sync',
        subtitle: 'Disconnected'
      };
    }
    if (connectionIssue === 'auth_expired') {
      return {
        state: 'disconnected',
        title: 'Session expired — Sign in again',
        subtitle: 'Session expired — sign in again'
      };
    }
    if (systemSuspended || connectionIssue === 'suspended') {
      return {
        state: 'suspended',
        title: systemSuspended ? 'Sync suspended (system sleep)' : 'Sync suspended',
        subtitle: 'Sync suspended — saved locally'
      };
    }
    return {
      state: 'connected',
      title: 'Connected — Synced to WordTap Cloud',
      subtitle: 'Synced to WordTap Cloud'
    };
  }

  function applyStatusClasses(el, state, includeOnlineClass = false) {
    if (!el) return;
    el.classList.remove('status-connected', 'status-suspended', 'status-disconnected', 'online');
    el.classList.add(`status-${state}`);
    if (includeOnlineClass && state === 'connected') {
      el.classList.add('online');
    }
  }

  function updateAccountUI() {
    const status = getConnectionStatus();
    applyStatusClasses(accountStatusDot, status.state, true);
    applyStatusClasses(accountAvatarDot, status.state, false);
    if (btnAccount) btnAccount.title = status.title;
    if (accountAvatarDot) accountAvatarDot.title = status.title;

    if (userSession && userSession.email) {
      accountLabel.textContent = userSession.email.split('@')[0];
      accountLoggedOutView.style.display = 'none';
      accountLoggedInView.style.display = 'block';
      accountUserEmail.textContent = userSession.email;
      const avatarEl = document.getElementById('account-user-avatar');
      if (avatarEl) {
        avatarEl.textContent = (userSession.email[0] || 'U').toUpperCase();
      }
      if (accountSyncSubtitle) {
        applyStatusClasses(accountSyncSubtitle, status.state, false);
      }
      if (accountSyncText) {
        accountSyncText.textContent = status.subtitle;
      }
      if (accountSyncIcon) {
        if (status.state === 'connected') {
          accountSyncIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
        } else if (status.state === 'suspended') {
          accountSyncIcon.innerHTML = '<line x1="10" y1="6" x2="10" y2="18"></line><line x1="14" y1="6" x2="14" y2="18"></line>';
        } else {
          accountSyncIcon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
        }
      }
    } else {
      accountLabel.textContent = 'WordTap Sync';
      accountLoggedOutView.style.display = 'block';
      accountLoggedInView.style.display = 'none';
    }
  }

  async function checkConnectionHealth(force = false) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      connectionIssue = 'offline';
      updateAccountUI();
      return 'disconnected';
    }
    if (!userSession || !userSession.email || !userSession.access_token) {
      connectionIssue = null;
      updateAccountUI();
      return 'disconnected';
    }
    if (systemSuspended) {
      updateAccountUI();
      return 'suspended';
    }

    const nowMs = Date.now();
    if (!force && connectionCheckPromise) return await connectionCheckPromise;
    if (!force && nowMs - lastConnectionCheckAt < 10000) {
      return getConnectionStatus().state;
    }

    connectionCheckPromise = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      try {
        lastConnectionCheckAt = Date.now();
        let token = await getValidToken();
        if (!token) {
          updateAccountUI();
          return getConnectionStatus().state;
        }

        let res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: 'GET',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal
        });

        if (res.status === 401 || res.status === 403) {
          token = await getValidToken(true);
          if (token) {
            res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
              method: 'GET',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${token}`
              },
              signal: controller.signal
            });
          }
        }

        if (res.ok) {
          connectionIssue = null;
        } else if (res.status === 401 || res.status === 403) {
          connectionIssue = 'auth_expired';
        } else if (res.status === 429 || res.status >= 500) {
          connectionIssue = 'suspended';
        } else {
          connectionIssue = 'offline';
        }
      } catch (_err) {
        connectionIssue = 'offline';
      } finally {
        clearTimeout(timeoutId);
        connectionCheckPromise = null;
        updateAccountUI();
      }
      return getConnectionStatus().state;
    })();

    return await connectionCheckPromise;
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
      connectionIssue = null;

      await window.WordTapAPI.saveConfig({ session: userSession });
      updateAccountUI();
      accountModal.classList.remove('open');
      showToast(`Connected as ${userSession.email}`);
      pushPendingOfflineWords();
    } catch (err) {
      alert(`Sign in error: ${err.message}`);
    } finally {
      btnAuthSignin.textContent = 'Sign In';
    }
  }

  async function handleSignOut() {
    userSession = null;
    connectionIssue = null;
    await window.WordTapAPI.saveConfig({ session: null });
    updateAccountUI();
    accountModal.classList.remove('open');
    showLoginGate();
    showToast('Signed out');
  }

  async function pushPendingOfflineWords() {
    if (!userSession || systemSuspended) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      connectionIssue = 'offline';
      updateAccountUI();
      return;
    }
    const token = await getValidToken();
    if (!token) return;

    const words = await window.WordTapAPI.getSavedWords();
    if (!words || words.length === 0) return;

    const unsynced = words.filter(w => !w.synced);
    if (unsynced.length === 0) return;

    showToast(`Syncing ${unsynced.length} words to website...`);
    let syncedAny = false;
    for (const w of unsynced) {
      try {
        const ok = await syncWordToSupabase(w);
        if (ok) {
          w.synced = true;
          await window.WordTapAPI.saveWord(w);
          syncedAny = true;
        }
      } catch (err) {
        console.warn('Sync word failed:', w.text, err);
      }
    }
    if (syncedAny) {
      showToast('All words synced to website');
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function syncDeleteToSupabase(wordText) {
    let token = await getValidToken();
    if (!token) return false;

    const payload = {
      p_text: wordText,
      p_src_lang: 'auto'
    };

    try {
      let res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_word_by_text`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        token = await getValidToken(true);
        if (token) {
          res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_word_by_text`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        }
      }

      // Also ensure deletion from words table directly
      await fetch(`${SUPABASE_URL}/rest/v1/words?text=ilike.${encodeURIComponent(wordText)}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`
        }
      }).catch(() => {});

      return true;
    } catch (err) {
      console.warn('Sync delete to Supabase error:', err);
      return false;
    }
  }

  async function syncUpdateToSupabase(oldText, updatedEntry) {
    if (systemSuspended) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      connectionIssue = 'offline';
      updateAccountUI();
      return false;
    }

    let token = await getValidToken();
    if (!token) return false;

    const sentence = updatedEntry.sentence || '';
    const title = updatedEntry.title || '';
    const titleContext = sentence ? `"${sentence}" — ${title}` : title;
    const patchPayload = {
      text: updatedEntry.text,
      translation: updatedEntry.translation || '',
      sentence,
      source_title: titleContext
    };

    const runPatch = async (authToken) => fetch(
      `${SUPABASE_URL}/rest/v1/words?text=ilike.${encodeURIComponent(oldText)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(patchPayload)
      }
    );

    let res;
    try {
      res = await runPatch(token);
      if (res.status === 401) {
        token = await getValidToken(true);
        if (token) res = await runPatch(token);
      }
    } catch (err) {
      connectionIssue = 'offline';
      updateAccountUI();
      throw err;
    }

    if (res && res.ok) {
      const updatedRows = await res.json().catch(() => []);
      if (Array.isArray(updatedRows) && updatedRows.length > 0) {
        if (connectionIssue !== null) {
          connectionIssue = null;
          updateAccountUI();
        }
        return true;
      }
      // Fallback if word didn't exist yet on Supabase or text case changed cleanly
      if (oldText.toLowerCase() !== updatedEntry.text.toLowerCase()) {
        await syncDeleteToSupabase(oldText);
      }
      return await syncWordToSupabase(updatedEntry);
    }

    if (res && (res.status === 429 || res.status >= 500)) {
      connectionIssue = 'suspended';
      updateAccountUI();
    } else if (res && (res.status === 401 || res.status === 403)) {
      connectionIssue = 'auth_expired';
      updateAccountUI();
    }
    return false;
  }

  async function updateWordEntry(oldText, nextText, nextTranslation, nextSentence) {
    const prevClean = (oldText || '').trim();
    const newClean = (nextText || '').trim();
    const newTrans = (nextTranslation || '').trim();
    const newSent = (nextSentence || '').trim();
    if (!prevClean || !newClean || !newTrans) return false;

    const existing = savedWords.find(w => (w.text || '').trim().toLowerCase() === prevClean.toLowerCase());
    if (!existing) return false;

    const updatedEntry = {
      ...existing,
      text: newClean,
      translation: newTrans,
      sentence: newSent,
      synced: false
    };

    try {
      if (window.WordTapAPI && window.WordTapAPI.updateSavedWord) {
        await window.WordTapAPI.updateSavedWord(prevClean, {
          text: newClean,
          translation: newTrans,
          sentence: newSent,
          synced: false
        });
      }
      await refreshSavedWordsCount();

      if (userSession && !systemSuspended && navigator.onLine !== false) {
        try {
          const synced = await syncUpdateToSupabase(prevClean, updatedEntry);
          if (synced && window.WordTapAPI && window.WordTapAPI.updateSavedWord) {
            await window.WordTapAPI.updateSavedWord(newClean, { synced: true });
            await refreshSavedWordsCount();
          }
        } catch (err) {
          console.warn('Supabase update sync warning (queued locally):', err);
        }
      }

      showToast(`Updated "${newClean}"`);
      return true;
    } catch (err) {
      console.error('Failed to update word:', err);
      showToast(`Failed to update "${prevClean}"`);
      return false;
    }
  }

  async function deleteWordEntry(wordText) {
    if (!wordText) return false;
    const clean = wordText.trim();
    try {
      if (window.WordTapAPI && window.WordTapAPI.deleteSavedWord) {
        await window.WordTapAPI.deleteSavedWord(clean);
      }
      savedWords = savedWords.filter(w => (w.text || '').trim().toLowerCase() !== clean.toLowerCase());
      if (savedWordsCount) {
        savedWordsCount.textContent = `${savedWords.length} Word${savedWords.length === 1 ? '' : 's'}`;
      }

      if (userSession) {
        syncDeleteToSupabase(clean).catch(err => console.warn('Supabase delete sync warning:', err));
      }

      if (activeWordData && (activeWordData.cleanWord || '').toLowerCase() === clean.toLowerCase()) {
        if (popoverBtnSave) {
          popoverBtnSave.classList.remove('saved');
          popoverBtnSave.innerHTML = `${ICON_STAR_SVG}<span>Save to WordTap</span>`;
        }
      }

      showToast(`Deleted "${clean}"`);
      return true;
    } catch (err) {
      console.error('Failed to delete word:', err);
      showToast(`Failed to delete "${clean}"`);
      return false;
    }
  }

  // Load Saved Words Modal
  let editingSavedWordKey = null;

  function openSavedWordsModal() {
    editingSavedWordKey = null;
    renderSavedWordsList();
    if (savedWordsModal) {
      savedWordsModal.classList.add('open');
    }
  }

  function renderSavedWordsList() {
    if (!savedWordsListContainer) return;
    if (savedWords.length === 0) {
      savedWordsListContainer.innerHTML = `
        <div style="color:var(--text-secondary); text-align:center; padding:28px 12px; font-size:13px; line-height:1.5;">
          No words saved yet.<br>
          <span style="font-size:11.5px; color:var(--text-dim); margin-top:4px; display:inline-block;">Click any subtitle word during video playback to save it!</span>
        </div>`;
      return;
    }

    let html = '';
    for (const w of savedWords) {
      const rawText = (w.text || '').trim();
      const text = escapeHtml(rawText);
      const trans = escapeHtml(w.translation || '');
      const sentence = escapeHtml(w.sentence || '');
      const isEditing = editingSavedWordKey && editingSavedWordKey.toLowerCase() === rawText.toLowerCase();

      html += `
        <div class="saved-word-row" data-word="${text}">
          <div class="saved-word-main">
            <span class="saved-word-title">${text}</span>
            <div class="saved-word-right">
              <span class="saved-word-ar" dir="auto">${trans}</span>
              <button type="button" class="btn-edit-saved-word${isEditing ? ' active' : ''}" data-word="${text}" title="Edit word" aria-label="Edit ${text}">
                <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                </svg>
              </button>
              <button type="button" class="btn-delete-saved-word" data-word="${text}" title="Delete word" aria-label="Delete ${text}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </div>
          ${isEditing ? `
          <div class="saved-word-edit-panel">
            <div class="saved-word-edit-grid">
              <div class="saved-word-edit-field">
                <label class="saved-word-edit-label">Word</label>
                <input type="text" class="saved-word-edit-input js-edit-word" value="${text}" dir="auto" />
              </div>
              <div class="saved-word-edit-field">
                <label class="saved-word-edit-label">Translation</label>
                <input type="text" class="saved-word-edit-input js-edit-trans" value="${trans}" dir="auto" />
              </div>
            </div>
            <div class="saved-word-edit-field">
              <label class="saved-word-edit-label">Context Sentence</label>
              <input type="text" class="saved-word-edit-input js-edit-sentence" value="${sentence}" placeholder="Optional subtitle context" dir="auto" />
            </div>
            <div class="saved-word-edit-actions">
              <button type="button" class="saved-word-edit-cancel">Cancel</button>
              <button type="button" class="saved-word-edit-save">Save Changes</button>
            </div>
          </div>` : ''}
        </div>
      `;
    }
    savedWordsListContainer.innerHTML = html;

    // Focus translation or word input when inline edit opens
    if (editingSavedWordKey) {
      const activeInput = savedWordsListContainer.querySelector('.js-edit-trans');
      if (activeInput) {
        activeInput.focus();
        activeInput.select();
      }
    }

    // Attach edit toggle handlers
    savedWordsListContainer.querySelectorAll('.btn-edit-saved-word').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = btn.getAttribute('data-word') || '';
        if (!word) return;
        editingSavedWordKey = (editingSavedWordKey && editingSavedWordKey.toLowerCase() === word.toLowerCase())
          ? null
          : word;
        renderSavedWordsList();
      });
    });

    // Attach inline edit Cancel / Save / keyboard handlers
    const editPanel = savedWordsListContainer.querySelector('.saved-word-edit-panel');
    if (editPanel) {
      const wordInput = editPanel.querySelector('.js-edit-word');
      const transInput = editPanel.querySelector('.js-edit-trans');
      const sentenceInput = editPanel.querySelector('.js-edit-sentence');
      const cancelBtn = editPanel.querySelector('.saved-word-edit-cancel');
      const saveBtn = editPanel.querySelector('.saved-word-edit-save');

      const syncSaveDisabled = () => {
        if (saveBtn) {
          saveBtn.disabled = !wordInput.value.trim() || !transInput.value.trim();
        }
      };

      const submitEdit = async () => {
        if (!editingSavedWordKey) return;
        const nextWord = wordInput.value.trim();
        const nextTrans = transInput.value.trim();
        const nextSent = sentenceInput ? sentenceInput.value.trim() : '';
        if (!nextWord || !nextTrans) return;
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Saving...';
        }
        const prevKey = editingSavedWordKey;
        const ok = await updateWordEntry(prevKey, nextWord, nextTrans, nextSent);
        if (ok) {
          editingSavedWordKey = null;
          renderSavedWordsList();
        } else if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
        }
      };

      [wordInput, transInput, sentenceInput].forEach(inp => {
        if (!inp) return;
        inp.addEventListener('input', syncSaveDisabled);
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitEdit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            editingSavedWordKey = null;
            renderSavedWordsList();
          }
        });
      });

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          editingSavedWordKey = null;
          renderSavedWordsList();
        });
      }
      if (saveBtn) {
        saveBtn.addEventListener('click', submitEdit);
      }
    }

    // Attach click handlers to delete buttons
    savedWordsListContainer.querySelectorAll('.btn-delete-saved-word').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const word = btn.getAttribute('data-word');
        if (!word) return;
        if (editingSavedWordKey && editingSavedWordKey.toLowerCase() === word.toLowerCase()) {
          editingSavedWordKey = null;
        }
        const row = btn.closest('.saved-word-row');
        if (row) {
          row.style.opacity = '0';
          row.style.transform = 'translateX(12px)';
          row.style.pointerEvents = 'none';
          setTimeout(() => {
            row.remove();
            if (savedWords.length === 0) {
              renderSavedWordsList();
            }
          }, 180);
        }
        await deleteWordEntry(word);
      });
    });
  }

  // Subtitle Synchronization Adjustment
  function updateSyncDelayUI() {
    const sign = subtitleDelayMs > 0 ? '+' : '';
    syncDelayText.textContent = `${sign}${subtitleDelayMs}ms`;
  }

  function adjustSubtitleDelay(deltaMs) {
    subtitleDelayMs += deltaMs;
    updateSyncDelayUI();
    saveCurrentMediaSession();
    const sign = subtitleDelayMs > 0 ? '+' : '';
    showToast(`Subtitle delay: ${sign}${subtitleDelayMs} ms`);
  }

  function resetSubtitleDelay() {
    subtitleDelayMs = 0;
    updateSyncDelayUI();
    saveCurrentMediaSession();
    showToast('Subtitle sync reset to 0ms');
  }

  function resetAudioDelay() {
    audioDelayMs = 0;
    syncAudioWithVideo();
    showToast('Audio sync reset to 0ms');
  }

  let activeAudioTrackIndex = 0;
  let detectedAudioTracks = [];

  // Video Load Handler - GUARANTEED AUDIO & DOLBY/DTS TRANSCODING
  async function playVideoFile(fileUrl, fileName, subContent = null, filePath = null, initSubDelay = 0, savedTime = 0, subPath = null) {
    currentMediaTitle = fileName;
    document.title = fileName ? `${fileName} - WordTap Player` : 'WordTap Player';
    currentFilePath = filePath;
    currentSubPath = subPath || null;
    isAudioTranscoded = false;
    updateAudioMenuState();
    audioStreamStartTime = 0;
    liveAudioResyncing = false;
    audioDelayMs = 0;
    subtitleDelayMs = typeof initSubDelay === 'number' ? initSubDelay : 0;
    activeSavedTime = (typeof savedTime === 'number' && savedTime > 0) ? savedTime : 0;
    updateSyncDelayUI();

    ensureAudioNodes();
    resumeAudioContext();

    if (compatibleAudio) {
      compatibleAudio.pause();
      compatibleAudio.removeAttribute('src');
      compatibleAudio.load();
    }

    video.src = fileUrl;
    dropZone.classList.add('hidden');

    // Make sure volume is active and unmuted
    userMuted = false;
    if (typeof userVolume !== 'number' || isNaN(userVolume) || userVolume <= 0.05) {
      userVolume = 1.0;
    }
    updateVolumeDisplay();

    if (subContent) {
      loadSubtitles(subContent, subPath ? subPath.split(/[/\\]/).pop() : 'Subtitle', subPath, true);
    } else {
      cues = [];
      currentCue = null;
      activeCueIdx = -1;
      subtitleContainer.innerHTML = '';
      currentSubContent = null;
      currentSubPath = null;
      currentSubFileName = null;
    }

    const targetSeek = activeSavedTime;

    // Automatic Dolby AC3 / E-AC3 / DTS Audio Stream Probing & Real-Time Transcoding
    if (filePath && window.WordTapAPI && window.WordTapAPI.probeAudio) {
      try {
        const info = await window.WordTapAPI.probeAudio(filePath);
        if (info && info.dar) {
          const darLabel = info.dar.replace('/', ':');
          setAspectRatio(info.dar, darLabel, false);
          console.log(`Auto-applied video aspect ratio from container DAR: ${info.dar}`);
        } else {
          setAspectRatio('auto', 'Default', false);
        }

        detectedAudioTracks = (info && info.audioTracks) || [];
        activeAudioTrackIndex = (info && typeof info.primaryAudioTrackIndex === 'number') ? info.primaryAudioTrackIndex : 0;

        if (info && info.needsTranscode) {
          const primary = info.primaryCodec || (info.codecs && info.codecs[0]) || 'AC3/DTS';
          const isDts = /dca|dts/i.test(primary);
          const isDolby = /ac3|ac-3|a52|eac3|eac-3|ec-3|truehd|mlp/i.test(primary);
          const badge = isDts ? 'DTS 5.1' : (isDolby ? 'Dolby Audio' : primary.toUpperCase());
          showToast(`Audio: Auto-fixing ${badge} (Voice Protection Engine)`);
          try { video.currentTime = targetSeek; } catch (e) {}
          await startLiveAudioStream(targetSeek, activeAudioTrackIndex);
          const p = video.play();
          if (p !== undefined) {
            p.catch((err) => {
              console.warn('Autoplay warning:', err);
              audioUnmuteBanner.style.display = 'block';
            });
          }
          return;
        }
      } catch (e) {
        console.warn('Audio probe err:', e);
      }
    }

    // Default play for standard native audio formats (AAC, MP3, etc.)
    if (targetSeek > 0) {
      if (video.readyState >= 1) {
        try { video.currentTime = targetSeek; } catch (e) {}
      } else {
        const onLoaded = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          try { video.currentTime = targetSeek; } catch (e) {}
        };
        video.addEventListener('loadedmetadata', onLoaded);
      }
    }

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Autoplay warning:', err);
        audioUnmuteBanner.style.display = 'block';
      });
    }
  }

  // Real-Time On-Demand Audio Streaming Engine (FFmpeg live MP3 stream with Active Lip-Sync & Voice Protection)
  async function startLiveAudioStream(seekTime = 0, trackIndex = null) {
    if (!currentFilePath || !window.WordTapAPI || !window.WordTapAPI.getAudioStreamUrl) {
      showToast('Please open a media file first');
      return;
    }
    try {
      ensureAudioNodes();
      resumeAudioContext();

      const targetTime = Math.max(0, seekTime);
      audioStreamStartTime = targetTime;

      if (trackIndex !== null && typeof trackIndex === 'number') {
        activeAudioTrackIndex = trackIndex;
      }

      const streamUrl = await window.WordTapAPI.getAudioStreamUrl({
        filePath: currentFilePath,
        startTime: targetTime,
        trackIndex: activeAudioTrackIndex
      });

      if (streamUrl) {
        // Video element must stay muted so its unsupported audio track doesn't clash
        video.muted = true;
        isAudioTranscoded = true;
        updateAudioMenuState();

        compatibleAudio.src = streamUrl;
        compatibleAudio.playbackRate = video.playbackRate;

        // Ensure audio element has user's volume and unmuted state
        compatibleAudio.muted = userMuted;
        updateVolumeDisplay();

        // Hardware-lock event: Align video frame to the audio stream's exact presentation time the instant sound begins!
        const onAudioPlaying = () => {
          compatibleAudio.removeEventListener('playing', onAudioPlaying);
          if (isAudioTranscoded) {
            const elapsed = compatibleAudio.currentTime || 0;
            video.currentTime = Math.max(0, audioStreamStartTime + elapsed + (audioDelayMs / 1000));
            if (video.paused) {
              video.play().catch(() => {});
            }
          }
        };
        compatibleAudio.addEventListener('playing', onAudioPlaying);

        compatibleAudio.onerror = (e) => {
          console.warn('[WordTap Audio] compatibleAudio error event:', e);
          if (isAudioTranscoded && !video.paused && currentFilePath) {
            setTimeout(() => {
              if (isAudioTranscoded && !video.paused) {
                startLiveAudioStream(video.currentTime, activeAudioTrackIndex);
              }
            }, 600);
          }
        };

        const p = compatibleAudio.play();
        if (p !== undefined) {
          p.catch((err) => {
            console.warn('compatibleAudio play notice:', err);
            resumeAudioContext();
          });
        }
        showToast('Audio: Transcode Engine Active (Stereo Downmix)');

        // Start active precision lip-sync loop (100ms interval)
        if (!audioSyncLoop) {
          audioSyncLoop = setInterval(syncAudioWithVideo, 100);
        }
      }
    } catch (err) {
      console.error('Live audio stream error:', err);
      showToast('Audio error: ' + err.message);
    }
  }

  // Fallback Audio Transcoding
  async function transcodeAndAttachAudio(filePath) {
    startLiveAudioStream(video.currentTime || 0);
  }

  function updateAudioMenuState() {
    const item = document.getElementById('menu-item-audio-fix');
    if (item) {
      const span = item.querySelector('span');
      if (span) {
        span.textContent = isAudioTranscoded
          ? '✓ Transcode Audio Stream (Active)'
          : 'Transcode Audio Stream (AC3 / DTS)';
      }
    }
  }

  // Helper: Extract clean movie/show name and season/episode from filename
  function cleanMovieTitle(raw) {
    if (!raw) return { title: '', season: '', episode: '' };
    let title = raw.replace(/\.[^/.]+$/, '');
    let season = '';
    let episode = '';

    const seMatch = title.match(/[sS](\d{1,2})[eE](\d{1,2})/);
    if (seMatch) {
      season = parseInt(seMatch[1], 10).toString();
      episode = parseInt(seMatch[2], 10).toString();
      title = title.substring(0, seMatch.index);
    }

    // Strip common release tags
    title = title.replace(/\b(1080p|720p|480p|2160p|4k|bluray|bdrip|brrip|webrip|web-dl|hdtv|x264|x265|hevc|yts|yify|rarbg|ac3|dts|aac|10bit|repack)\b/gi, ' ');
    title = title.replace(/[\._\+]/g, ' ');
    title = title.replace(/\s*\(\d{4}\)\s*/g, ' ');
    title = title.trim();

    return { title, season, episode };
  }

  // VLsub 0.10.2 OpenSubtitles Dialog Logic
  function openVLsubModal() {
    vlsubModal.classList.add('open');
    if (currentMediaTitle && currentMediaTitle !== 'No media loaded') {
      const parsed = cleanMovieTitle(currentMediaTitle);
      vlsubTitleInput.value = parsed.title;
      if (parsed.season) vlsubSeasonInput.value = parsed.season;
      if (parsed.episode) vlsubEpisodeInput.value = parsed.episode;
    }
    vlsubStatusText.textContent = 'Ready to search OpenSubtitles';
    vlsubStatusText.className = 'vlsub-status-message';
    setTimeout(() => {
      vlsubTitleInput.focus();
    }, 100);
  }

  function closeVLsubModal() {
    vlsubModal.classList.remove('open');
  }

  async function searchVLsubByName() {
    const query = vlsubTitleInput.value.trim();
    if (!query) {
      vlsubStatusText.textContent = 'Please enter a title to search';
      return;
    }

    const langCode = vlsubLangSelect.value;
    const season = vlsubSeasonInput.value.trim() ? parseInt(vlsubSeasonInput.value.trim(), 10) : undefined;
    const episode = vlsubEpisodeInput.value.trim() ? parseInt(vlsubEpisodeInput.value.trim(), 10) : undefined;

    vlsubSpinner.style.display = 'block';
    vlsubStatusText.textContent = `Searching OpenSubtitles for "${query}"...`;
    vlsubStatusText.className = 'vlsub-status-message';
    btnVlsubDownload.disabled = true;
    selectedVlsubIndex = -1;

    try {
      const res = await window.WordTapAPI.searchVLSub({ query, langCode, season, episode });
      if (res && res.ok && res.data && res.data.length > 0) {
        vlsubSearchResults = res.data;
        renderVLsubResults(res.data);
        vlsubStatusText.textContent = `Found ${res.data.length} subtitles for "${query}"`;
      } else {
        vlsubSearchResults = [];
        renderVLsubEmpty('No subtitles found. Try another search term or language.');
        vlsubStatusText.textContent = '0 subtitles found';
      }
    } catch (err) {
      console.error('VLsub search err:', err);
      vlsubStatusText.textContent = 'Search failed: ' + err.message;
      renderVLsubEmpty('Failed to connect to OpenSubtitles.');
    } finally {
      vlsubSpinner.style.display = 'none';
    }
  }

  async function searchVLsubByHash() {
    if (!currentFilePath) {
      vlsubStatusText.textContent = 'Please open a video file first to search by hash';
      return;
    }

    vlsubSpinner.style.display = 'block';
    vlsubStatusText.textContent = 'Calculating movie hash...';
    vlsubStatusText.className = 'vlsub-status-message';
    btnVlsubDownload.disabled = true;
    selectedVlsubIndex = -1;

    try {
      const hashInfo = await window.WordTapAPI.calculateVLSubHash(currentFilePath);
      if (!hashInfo) {
        vlsubStatusText.textContent = 'Could not compute hash for this file';
        vlsubSpinner.style.display = 'none';
        return;
      }

      vlsubStatusText.textContent = 'Searching OpenSubtitles by movie hash...';
      const langCode = vlsubLangSelect.value;
      const res = await window.WordTapAPI.searchVLSub({
        movieHash: hashInfo.movieHash,
        movieByteSize: hashInfo.movieByteSize,
        langCode
      });

      if (res && res.ok && res.data && res.data.length > 0) {
        vlsubSearchResults = res.data;
        renderVLsubResults(res.data);
        vlsubStatusText.textContent = `Found ${res.data.length} exact hash matching subtitles!`;
      } else {
        vlsubStatusText.textContent = 'No exact hash match found. Searching by title...';
        await searchVLsubByName();
      }
    } catch (err) {
      console.error('VLsub hash search err:', err);
      vlsubStatusText.textContent = 'Hash search error: ' + err.message;
    } finally {
      vlsubSpinner.style.display = 'none';
    }
  }

  function renderVLsubResults(list) {
    let html = '';
    list.forEach((item, idx) => {
      const rating = item.rating ? parseFloat(item.rating).toFixed(1) : '—';
      const dls = item.downloads ? parseInt(item.downloads, 10).toLocaleString() : '0';
      html += `
        <tr class="vlsub-row" data-idx="${idx}">
          <td class="td-filename" title="${item.fileName}">${item.fileName}</td>
          <td class="td-lang">${item.langName}</td>
          <td class="td-rating" style="text-align:center;">${rating}</td>
          <td class="td-dl" style="text-align:right;">${dls}</td>
        </tr>
      `;
    });
    vlsubResultsTbody.innerHTML = html;

    const rows = vlsubResultsTbody.querySelectorAll('.vlsub-row');
    rows.forEach(row => {
      row.addEventListener('click', () => {
        rows.forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        selectedVlsubIndex = parseInt(row.getAttribute('data-idx'), 10);
        btnVlsubDownload.disabled = false;
      });

      row.addEventListener('dblclick', () => {
        selectedVlsubIndex = parseInt(row.getAttribute('data-idx'), 10);
        downloadSelectedVLsub();
      });
    });
  }

  function renderVLsubEmpty(msg) {
    vlsubResultsTbody.innerHTML = `
      <tr>
        <td colspan="4" class="vlsub-empty-cell">${msg}</td>
      </tr>
    `;
    btnVlsubDownload.disabled = true;
  }

  async function downloadSelectedVLsub() {
    if (selectedVlsubIndex < 0 || selectedVlsubIndex >= vlsubSearchResults.length) return;
    const item = vlsubSearchResults[selectedVlsubIndex];

    btnVlsubDownload.disabled = true;
    vlsubSpinner.style.display = 'block';
    vlsubStatusText.textContent = `Downloading ${item.fileName}...`;

    try {
      const res = await window.WordTapAPI.downloadVLSub({
        subId: item.id,
        videoPath: currentFilePath,
        fileName: item.fileName,
        langCode: item.langCode
      });
      if (res && res.ok && res.srtContent) {
        loadSubtitles(res.srtContent, `VLsub: ${res.fileName || item.fileName}`, res.savedPath, false);
        vlsubStatusText.textContent = res.savedPath ? `Saved to disk: ${res.fileName}` : 'Subtitle loaded successfully into player';
        vlsubStatusText.className = 'vlsub-status-message success';
        setTimeout(() => {
          closeVLsubModal();
        }, 600);
        showToast(res.savedPath ? `Saved & Loaded: ${res.fileName}` : `Subtitles: ${item.fileName}`);
      } else {
        vlsubStatusText.textContent = 'Download error: ' + (res ? res.error : 'Unknown');
        btnVlsubDownload.disabled = false;
      }
    } catch (err) {
      console.error('VLsub download error:', err);
      vlsubStatusText.textContent = 'Download failed: ' + err.message;
      btnVlsubDownload.disabled = false;
    } finally {
      vlsubSpinner.style.display = 'none';
    }
  }

  // Fullscreen & Controls Auto-Hide Management (VLC Cinema Style)
  let isFullscreenActive = false;
  let controlsTimeout = null;
  const CONTROLS_HIDE_DELAY_MS = 2500;
  let isMouseOverControls = false;
  let lastMouseX = -1;
  let lastMouseY = -1;

  function showControls() {
    appContainer.classList.remove('controls-hidden');
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
      controlsTimeout = null;
    }
  }

  function hideControls() {
    if (!isFullscreenActive) return;
    if (video.paused) return;
    if (isScrubbing) return;
    if (isMouseOverControls) return;
    if (wordPopover && wordPopover.classList.contains('visible')) return;
    if (document.querySelector('.vlc-menu-dropdown.open')) return;
    if (document.querySelector('.modal-overlay.open, #login-gate-overlay:not(.hidden)')) return;

    appContainer.classList.add('controls-hidden');
  }

  function resetControlsTimeout() {
    showControls();
    if (isFullscreenActive && !video.paused) {
      if (controlsTimeout) clearTimeout(controlsTimeout);
      controlsTimeout = setTimeout(hideControls, CONTROLS_HIDE_DELAY_MS);
    }
  }

  function setFullscreenState(isFS) {
    isFullscreenActive = !!isFS;
    if (isFullscreenActive) {
      appContainer.classList.add('is-fullscreen');
      iconFsEnter.style.display = 'none';
      iconFsExit.style.display = 'block';
      showToast('Fullscreen');
      resetControlsTimeout();
    } else {
      appContainer.classList.remove('is-fullscreen');
      showControls();
      iconFsEnter.style.display = 'block';
      iconFsExit.style.display = 'none';
    }
    requestAnimationFrame(applyAspectRatioLayout);
    setTimeout(applyAspectRatioLayout, 150);
  }

  async function toggleFullscreen() {
    if (window.WordTapAPI && window.WordTapAPI.toggleFullscreen) {
      const isFS = await window.WordTapAPI.toggleFullscreen();
      setFullscreenState(isFS);
    } else if (!document.fullscreenElement) {
      document.getElementById('app-container').requestFullscreen().catch(() => {});
      setFullscreenState(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreenState(false);
    }
  }

  if (window.WordTapAPI && window.WordTapAPI.onFullscreenChange) {
    window.WordTapAPI.onFullscreenChange((isFS) => {
      setFullscreenState(isFS);
    });
  }

  document.addEventListener('fullscreenchange', () => {
    setFullscreenState(!!document.fullscreenElement);
  });

  // Setup Event Listeners
  function setupEvents() {
    // Listen for file opened via Windows Explorer "Open with" while app is already running
    if (window.WordTapAPI && window.WordTapAPI.onOpenFile) {
      window.WordTapAPI.onOpenFile((payload) => {
        if (payload && payload.fileUrl) {
          playVideoFile(
            payload.fileUrl,
            payload.fileName,
            payload.subContent,
            payload.filePath,
            payload.subtitleDelayMs || 0,
            payload.savedTime || 0,
            payload.subFile
          );
          hideLoginGate();
        }
      });
    }

    // Audio Unmute Banner
    audioUnmuteBanner.addEventListener('click', () => {
      ensureAudioNodes();
      resumeAudioContext();
      userMuted = false;
      if (userVolume <= 0.05) userVolume = 1.0;
      updateVolumeDisplay();
      if (isAudioTranscoded && compatibleAudio && compatibleAudio.src) {
        compatibleAudio.play().catch(() => {});
      } else {
        video.muted = false;
        video.play().catch(() => {});
      }
      audioUnmuteBanner.style.display = 'none';
    });

    // Auto-resume audio whenever window recovers focus (e.g. returning from Google OAuth or switching tabs)
    window.addEventListener('focus', () => {
      resumeAudioContext();
      updateVolumeDisplay();
      if (!video.paused) {
        if (isAudioTranscoded && compatibleAudio && compatibleAudio.paused) {
          compatibleAudio.play().catch(() => {});
        }
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        resumeAudioContext();
        updateVolumeDisplay();
        if (!video.paused) {
          if (isAudioTranscoded && compatibleAudio && compatibleAudio.paused) {
            compatibleAudio.play().catch(() => {});
          }
        }
      }
    });

    // User gesture activates audio engine
    window.addEventListener('click', resumeAudioContext, { passive: true });
    window.addEventListener('keydown', resumeAudioContext, { passive: true });

    // Setup Auth Gate Listeners (Immediate & Responsive)
    setupAuthGate();

    // Open Video
    btnOpenVideo.addEventListener('click', async () => {
      closeAllMenus();
      const res = await window.WordTapAPI.openVideoFile();
      if (res) {
        playVideoFile(
          res.fileUrl,
          res.fileName,
          res.subContent,
          res.filePath,
          res.subtitleDelayMs || 0,
          res.savedTime || 0,
          res.subFile
        );
      }
    });

    btnSplashOpenVideo.addEventListener('click', async () => {
      const res = await window.WordTapAPI.openVideoFile();
      if (res) {
        playVideoFile(
          res.fileUrl,
          res.fileName,
          res.subContent,
          res.filePath,
          res.subtitleDelayMs || 0,
          res.savedTime || 0,
          res.subFile
        );
      }
    });

    // Open Subtitle
    btnOpenSub.addEventListener('click', async () => {
      closeAllMenus();
      const res = await window.WordTapAPI.openSubtitleFile();
      if (res && res.content) {
        loadSubtitles(res.content, `Loaded ${res.fileName}`, res.filePath, false);
      }
    });

    // VLsub Dialog Controls
    if (btnCloseVlsub) btnCloseVlsub.addEventListener('click', closeVLsubModal);
    if (btnCloseVlsubFooter) btnCloseVlsubFooter.addEventListener('click', closeVLsubModal);
    if (btnVlsubSearchName) btnVlsubSearchName.addEventListener('click', searchVLsubByName);
    if (btnVlsubSearchHash) btnVlsubSearchHash.addEventListener('click', searchVLsubByHash);
    if (btnVlsubDownload) btnVlsubDownload.addEventListener('click', downloadSelectedVLsub);

    if (vlsubTitleInput) {
      vlsubTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchVLsubByName();
      });
    }
    if (vlsubSeasonInput) {
      vlsubSeasonInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchVLsubByName();
      });
    }
    if (vlsubEpisodeInput) {
      vlsubEpisodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchVLsubByName();
      });
    }

    // Top VLC Menu Dropdown Management
    const menuDropdowns = document.querySelectorAll('.vlc-menu-dropdown');
    let isAnyMenuOpen = false;

    function closeAllMenus() {
      menuDropdowns.forEach(d => d.classList.remove('open'));
      isAnyMenuOpen = false;
      resetControlsTimeout();
    }

    menuDropdowns.forEach(dropdown => {
      const headerBtn = dropdown.querySelector('.menu-header-btn');
      if (!headerBtn) return;

      headerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        closeAllMenus();
        if (!isOpen) {
          dropdown.classList.add('open');
          isAnyMenuOpen = true;
        }
      });

      dropdown.addEventListener('mouseenter', () => {
        if (isAnyMenuOpen && !dropdown.classList.contains('open')) {
          closeAllMenus();
          dropdown.classList.add('open');
          isAnyMenuOpen = true;
        }
      });
    });

    window.addEventListener('click', (e) => {
      if (!e.target.closest('.vlc-menu-dropdown')) {
        closeAllMenus();
      }
    });

    // Menu Item Actions
    const bindMenuItem = (id, fn) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          closeAllMenus();
          fn();
        });
      }
    };

    bindMenuItem('menu-item-play', togglePlay);
    bindMenuItem('menu-item-stop', () => {
      video.pause();
      video.currentTime = 0;
      subtitleDelayMs = 0;
      audioDelayMs = 0;
      updateSyncDelayUI();
      if (isAudioTranscoded && compatibleAudio) {
        compatibleAudio.pause();
        compatibleAudio.currentTime = 0;
      }
      showToast('Stop (Sync reset to 0ms)');
    });
    bindMenuItem('menu-item-replay', replayCurrentLine);
    bindMenuItem('menu-item-fwd', () => {
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
      showToast('+00:05');
    });
    bindMenuItem('menu-item-back', () => {
      video.currentTime = Math.max(0, video.currentTime - 5);
      showToast('-00:05');
    });
    bindMenuItem('menu-item-speed', () => {
      currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
      setPlaybackSpeed(speeds[currentSpeedIndex], true);
    });

    // Audio Menu Actions (CRITICAL FIX FOR USER: AC3 / DTS Transcode & Lip-Sync)
    bindMenuItem('menu-item-audio-fix', () => {
      if (!currentFilePath) {
        showToast('Please open a media file first');
        return;
      }
      transcodeAndAttachAudio(currentFilePath);
    });
    bindMenuItem('menu-item-audio-delay-plus', () => adjustAudioDelay(50));
    bindMenuItem('menu-item-audio-delay-minus', () => adjustAudioDelay(-50));
    bindMenuItem('menu-item-audio-delay-reset', resetAudioDelay);
    bindMenuItem('menu-item-mute', toggleMute);
    bindMenuItem('menu-item-vol-up', () => adjustVolume(0.05));
    bindMenuItem('menu-item-vol-down', () => adjustVolume(-0.05));

    // Video Menu Actions (Aspect Ratio & Fullscreen)
    bindMenuItem('menu-item-fullscreen', toggleFullscreen);
    bindMenuItem('menu-item-aspect-cycle', cycleAspectRatio);
    bindMenuItem('menu-item-aspect-auto', () => setAspectRatio('auto', 'Default (Auto)'));
    bindMenuItem('menu-item-aspect-16-9', () => setAspectRatio('16/9', '16:9 (Widescreen)'));
    bindMenuItem('menu-item-aspect-4-3', () => setAspectRatio('4/3', '4:3 (Standard TV)'));
    bindMenuItem('menu-item-aspect-16-10', () => setAspectRatio('16/10', '16:10'));
    bindMenuItem('menu-item-aspect-235', () => setAspectRatio('2.35/1', '2.35:1 (Cinema)'));
    bindMenuItem('menu-item-aspect-1-1', () => setAspectRatio('1/1', '1:1 (Square)'));
    bindMenuItem('menu-item-aspect-fill', () => setAspectRatio('fill', 'Fill Window'));

    // Subtitle Menu Actions
    bindMenuItem('menu-item-add-sub', async () => {
      const res = await window.WordTapAPI.openSubtitleFile();
      if (res && res.content) {
        loadSubtitles(res.content, `Loaded ${res.fileName}`, res.filePath, false);
      }
    });
    bindMenuItem('menu-item-sub-vlsub', openVLsubModal);
    bindMenuItem('menu-item-sub-style', openSubtitleStyleModal);
    bindMenuItem('menu-item-sub-size-plus', () => adjustSubCustomSize(2));
    bindMenuItem('menu-item-sub-size-minus', () => adjustSubCustomSize(-2));
    bindMenuItem('menu-item-toggle-sub', () => {
      subtitlesVisible = !subtitlesVisible;
      btnToggleSub.classList.toggle('active', subtitlesVisible);
      renderSubtitle(currentCue);
      showToast(subtitlesVisible ? 'Subtitles: Enabled' : 'Subtitles: Disabled');
    });
    bindMenuItem('menu-item-sub-delay-plus', () => adjustSubtitleDelay(100));
    bindMenuItem('menu-item-sub-delay-minus', () => adjustSubtitleDelay(-100));
    bindMenuItem('menu-item-sub-delay-reset', resetSubtitleDelay);

    // Tools Menu Actions
    bindMenuItem('menu-item-options', () => accountModal.classList.add('open'));
    bindMenuItem('menu-item-words', openSavedWordsModal);
    bindMenuItem('menu-item-account', () => accountModal.classList.add('open'));

    // View Menu Actions (EXACT MATCH FOR USER SCREENSHOT!)
    bindMenuItem('menu-item-vlsub', openVLsubModal);
    bindMenuItem('menu-item-theme-toggle', toggleTheme);
    bindMenuItem('menu-item-fs', toggleFullscreen);

    // Theme Toggle Controls
    if (btnThemeToggle) {
      btnThemeToggle.addEventListener('click', toggleTheme);
    }
    if (btnThemeDark) {
      btnThemeDark.addEventListener('click', () => applyTheme('dark', true));
    }
    if (btnThemeLight) {
      btnThemeLight.addEventListener('click', () => applyTheme('light', true));
    }
    if (btnThemeSystem) {
      btnThemeSystem.addEventListener('click', () => applyTheme('system', true));
    }

    // Help Menu Actions
    bindMenuItem('menu-item-help-shortcuts', () => helpModal.classList.add('open'));
    bindMenuItem('menu-item-help-web', () => window.WordTapAPI.openExternal(WEBSITE_URL));

    // Subtitle Sync
    btnSyncMinus.addEventListener('click', () => adjustSubtitleDelay(-100));
    btnSyncPlus.addEventListener('click', () => adjustSubtitleDelay(100));
    syncDelayText.addEventListener('click', resetSubtitleDelay);

    // Subtitle Font & Size Actions
    if (btnSubFont) {
      btnSubFont.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        cycleSubFont();
      });
    }
    if (btnSubSize) {
      btnSubSize.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        cycleSubSize();
      });
    }

    // Submenu Individual Font Family Items Click
    document.querySelectorAll('.sub-font-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        const family = btn.getAttribute('data-font');
        if (family) {
          subFontFamily = family;
          saveSubtitleAppearance(true);
        }
      });
    });

    // Submenu Individual Font Size Items Click
    document.querySelectorAll('.sub-size-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        const sz = parseInt(btn.getAttribute('data-size'), 10);
        if (!isNaN(sz)) {
          subCustomSize = sz;
          saveSubtitleAppearance(true);
        }
      });
    });

    bindMenuItem('menu-sub-size-plus-item', () => adjustSubCustomSize(2));
    bindMenuItem('menu-sub-size-minus-item', () => adjustSubCustomSize(-2));
    bindMenuItem('menu-sub-size-custom-item', openSubtitleStyleModal);

    // Bottom Bar Font & Subtitle Options Button
    const btnFontOptions = document.getElementById('btn-font-options');
    if (btnFontOptions) {
      btnFontOptions.addEventListener('click', () => {
        if (subtitleStyleModal && subtitleStyleModal.classList.contains('open')) {
          closeSubtitleStyleModal();
        } else {
          openSubtitleStyleModal();
        }
      });
    }

    // Subtitle Style & Customization Modal Controls
    if (btnOpenSubStyleFromOptions) {
      btnOpenSubStyleFromOptions.addEventListener('click', () => {
        accountModal.classList.remove('open');
        openSubtitleStyleModal();
      });
    }
    if (btnCloseSubStyle) btnCloseSubStyle.addEventListener('click', closeSubtitleStyleModal);
    if (btnSubApplyClose) btnSubApplyClose.addEventListener('click', closeSubtitleStyleModal);

    if (subSelectFont) {
      subSelectFont.addEventListener('change', (e) => {
        subFontFamily = e.target.value;
        saveSubtitleAppearance(false);
      });
    }

    if (subSizeSlider) {
      subSizeSlider.addEventListener('input', (e) => {
        subCustomSize = parseInt(e.target.value, 10) || 28;
        if (subSizeInput) subSizeInput.value = subCustomSize;
        saveSubtitleAppearance(false);
      });
    }

    if (subSizeInput) {
      subSizeInput.addEventListener('change', (e) => {
        const val = Math.max(14, Math.min(72, parseInt(e.target.value, 10) || 28));
        subCustomSize = val;
        subSizeInput.value = val;
        if (subSizeSlider) subSizeSlider.value = val;
        saveSubtitleAppearance(false);
      });
    }

    // Size preset buttons
    document.querySelectorAll('.sub-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        subCustomSize = parseInt(btn.getAttribute('data-size'), 10) || 28;
        saveSubtitleAppearance(false);
      });
    });

    // Color pills
    document.querySelectorAll('.sub-color-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        subTextColor = pill.getAttribute('data-color') || '#FFFFFF';
        saveSubtitleAppearance(false);
      });
    });

    if (subCustomColor) {
      subCustomColor.addEventListener('input', (e) => {
        subTextColor = e.target.value;
        saveSubtitleAppearance(false);
      });
    }

    // Background control
    if (subBgStyleControl) {
      subBgStyleControl.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          subBgStyle = btn.getAttribute('data-bg') || 'none';
          saveSubtitleAppearance(false);
        });
      });
    }

    // Weight control
    if (subWeightControl) {
      subWeightControl.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          subFontWeight = btn.getAttribute('data-weight') || '700';
          saveSubtitleAppearance(false);
        });
      });
    }

    // Vertical Offset slider & direct number input & presets
    if (subOffsetSlider) {
      subOffsetSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        subBottomOffset = isNaN(val) ? 46 : val;
        if (subOffsetInput) subOffsetInput.value = subBottomOffset;
        if (subOffsetValue) subOffsetValue.textContent = `${subBottomOffset}px`;
        saveSubtitleAppearance(false);
      });
    }

    if (subOffsetInput) {
      const handleOffsetInput = (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = 46;
        subBottomOffset = val;
        if (subOffsetSlider) subOffsetSlider.value = Math.max(0, Math.min(600, val));
        if (subOffsetValue) subOffsetValue.textContent = `${subBottomOffset}px`;
        saveSubtitleAppearance(false);
      };
      subOffsetInput.addEventListener('change', handleOffsetInput);
      subOffsetInput.addEventListener('input', handleOffsetInput);
    }

    document.querySelectorAll('.sub-offset-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-offset'), 10);
        subBottomOffset = isNaN(val) ? 46 : val;
        saveSubtitleAppearance(false);
      });
    });

    // Reset Defaults
    if (btnSubResetDefaults) {
      btnSubResetDefaults.addEventListener('click', () => {
        subCustomSize = 28;
        subFontFamily = 'Arial, "Trebuchet MS", sans-serif';
        subTextColor = '#FFFFFF';
        subBgStyle = 'none';
        subFontWeight = '700';
        subBottomOffset = 46;
        saveSubtitleAppearance(true);
        showToast('Subtitle style reset to default');
      });
    }

    // Preview words interactive click
    const previewWords = document.querySelectorAll('#sub-style-preview-stage .wt-word');
    previewWords.forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onWordClick(el, { text: "You're my new partner. That's right!" });
      });
    });

    // Shortcuts Help Modal
    btnHelp.addEventListener('click', () => helpModal.classList.add('open'));
    btnCloseHelp.addEventListener('click', () => helpModal.classList.remove('open'));

    // Popover Audio and Save Buttons
    popoverBtnAudio.addEventListener('click', () => {
      if (activeWordData) speakWord(activeWordData.rawWord);
    });

    popoverBtnSave.addEventListener('click', () => saveActiveWord(false));

    // Popover Hover Dismiss Timing: Wait for 1 sec like extension before disappearing!
    if (!wordPopover.dataset.hoverWired) {
      wordPopover.dataset.hoverWired = '1';
      wordPopover.addEventListener('mouseenter', () => {
        wordPopover.dataset.hovered = '1';
        clearTimeout(popoverHideTimer);
      });
      wordPopover.addEventListener('mouseleave', () => {
        delete wordPopover.dataset.hovered;
        clearTimeout(popoverHideTimer);
        // If video is paused, do NOT auto-close! Keep open for studying/reading.
        if (video && video.paused) {
          updatePopoverFooter();
          return;
        }
        schedulePopoverClose(AUTO_CLOSE_DELAY_MS);
      });
    }

    // Word Saving Mode & Options Controls
    function setSaveMode(mode) {
      translateSaveMode = mode;
      syncOptionsUI();
      window.WordTapAPI.saveConfig({ translateSaveMode: mode });
    }

    if (btnModeManual) btnModeManual.addEventListener('click', () => setSaveMode('manual'));
    if (btnModeSubs) btnModeSubs.addEventListener('click', () => setSaveMode('subtitles_only'));
    if (btnModeAuto) btnModeAuto.addEventListener('click', () => setSaveMode('auto'));

    if (optTargetLang) {
      optTargetLang.addEventListener('change', (e) => {
        targetLang = e.target.value;
        window.WordTapAPI.saveConfig({ targetLang });
      });
    }

    if (chkPauseOnClick) {
      chkPauseOnClick.addEventListener('change', (e) => {
        pauseOnClick = e.target.checked;
        window.WordTapAPI.saveConfig({ pauseOnClick });
      });
    }

    // Account Modal
    btnAccount.addEventListener('click', () => {
      accountModal.classList.add('open');
      checkConnectionHealth(true);
    });
    btnCloseAccountModal.addEventListener('click', () => accountModal.classList.remove('open'));
    btnAuthSignin.addEventListener('click', handleSignIn);
    if (btnAccountGoogle) {
      btnAccountGoogle.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.WordTapAPI || !window.WordTapAPI.signInWithGoogle) {
          alert('Google sign-in is not supported in this build.');
          return;
        }

        btnAccountGoogle.disabled = true;
        if (accountGoogleText) accountGoogleText.textContent = 'Connecting to Google…';

        try {
          const session = await window.WordTapAPI.signInWithGoogle();
          if (session && session.access_token) {
            userSession = session;
            connectionIssue = null;
            if (window.WordTapAPI.saveConfig) {
              await window.WordTapAPI.saveConfig({ session: userSession });
            }
            updateAccountUI();
            if (accountModal) accountModal.classList.remove('open');
            ensureAudioNodes();
            resumeAudioContext();
            updateVolumeDisplay();
            showToast(`Connected as ${userSession.email}`);
            pushPendingOfflineWords();
          }
        } catch (err) {
          alert(`Google sign-in failed: ${err.message || 'Cancelled'}`);
        } finally {
          btnAccountGoogle.disabled = false;
          if (accountGoogleText) accountGoogleText.textContent = 'Continue with Google';
        }
      });
    }
    btnAuthSignout.addEventListener('click', handleSignOut);
    btnOpenWeb.addEventListener('click', () => window.WordTapAPI.openExternal(WEBSITE_URL));

    // Network, Focus & OS Power Suspend/Resume Status Listeners
    window.addEventListener('offline', () => {
      connectionIssue = 'offline';
      updateAccountUI();
    });
    window.addEventListener('online', async () => {
      connectionIssue = null;
      updateAccountUI();
      const state = await checkConnectionHealth(true);
      if (state === 'connected') {
        pushPendingOfflineWords();
      }
    });
    window.addEventListener('focus', () => {
      if (userSession && !systemSuspended) {
        checkConnectionHealth(false);
      }
    });
    if (window.WordTapAPI && window.WordTapAPI.onPowerSuspendChange) {
      window.WordTapAPI.onPowerSuspendChange(async (suspended) => {
        systemSuspended = Boolean(suspended);
        updateAccountUI();
        if (!systemSuspended && userSession) {
          const state = await checkConnectionHealth(true);
          if (state === 'connected') {
            pushPendingOfflineWords();
          }
        }
      });
    }
    setInterval(() => {
      if (userSession && !systemSuspended && navigator.onLine !== false) {
        checkConnectionHealth(false);
      }
    }, 30000);

    // Saved Words Modal
    btnSavedWords.addEventListener('click', openSavedWordsModal);
    btnCloseSavedModal.addEventListener('click', () => savedWordsModal.classList.remove('open'));
    btnSavedOpenWeb.addEventListener('click', () => window.WordTapAPI.openExternal(WEBSITE_URL));

    // Play/Pause button and actions

    btnPlayPause.addEventListener('click', togglePlay);
    btnStop.addEventListener('click', () => {
      video.pause();
      video.currentTime = 0;
      subtitleDelayMs = 0;
      audioDelayMs = 0;
      updateSyncDelayUI();
      if (isAudioTranscoded && compatibleAudio) {
        compatibleAudio.pause();
        compatibleAudio.removeAttribute('src');
      }
      showToast('Stop (Sync reset to 0ms)');
    });

    // YouTube-Style Hold-to-2x Speed on Left Mouse Press & Hold
    const videoWrapper = document.getElementById('video-wrapper');
    const holdSpeedBadge = document.getElementById('hold-speed-badge');
    const vlcContextMenu = document.getElementById('vlc-context-menu');
    const ctxPlayIcon = document.getElementById('ctx-play-icon');
    const ctxPlayLabel = document.getElementById('ctx-play-label');
    const ctxMuteLabel = document.getElementById('ctx-mute-label');
    const ctxFsLabel = document.getElementById('ctx-fs-label');
    const ctxSubToggleLabel = document.getElementById('ctx-sub-toggle-label');

    let holdSpeedTimer = null;
    let isHoldSpeedActive = false;
    let preHoldSpeed = 1.0;
    let suppressNextVideoClick = false;

    const endHoldSpeed = () => {
      if (holdSpeedTimer) {
        clearTimeout(holdSpeedTimer);
        holdSpeedTimer = null;
      }
      if (isHoldSpeedActive) {
        isHoldSpeedActive = false;
        video.playbackRate = preHoldSpeed;
        if (isAudioTranscoded && compatibleAudio && compatibleAudio.src) {
          compatibleAudio.playbackRate = preHoldSpeed;
        }
        if (holdSpeedBadge) holdSpeedBadge.classList.remove('visible');
        suppressNextVideoClick = true;
        setTimeout(() => { suppressNextVideoClick = false; }, 120);
      }
    };

    video.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (wordPopover && wordPopover.classList.contains('visible')) return;
      if (vlcContextMenu && vlcContextMenu.classList.contains('open')) return;
      if (!video.src || video.paused) return;

      if (holdSpeedTimer) clearTimeout(holdSpeedTimer);
      holdSpeedTimer = setTimeout(() => {
        holdSpeedTimer = null;
        if (video.paused) return;
        preHoldSpeed = video.playbackRate || 1.0;
        isHoldSpeedActive = true;
        video.playbackRate = 2.0;
        if (isAudioTranscoded && compatibleAudio && compatibleAudio.src) {
          compatibleAudio.playbackRate = 2.0;
        }
        if (holdSpeedBadge) holdSpeedBadge.classList.add('visible');
      }, 240);
    });

    video.addEventListener('mouseup', endHoldSpeed);
    video.addEventListener('mouseleave', endHoldSpeed);
    video.addEventListener('dblclick', endHoldSpeed);
    window.addEventListener('blur', endHoldSpeed);

    video.addEventListener('click', () => {
      if (vlcContextMenu && vlcContextMenu.classList.contains('open')) {
        closeVlcContextMenu();
        return;
      }
      if (suppressNextVideoClick) {
        suppressNextVideoClick = false;
        return;
      }
      if (wordPopover.classList.contains('visible')) {
        closePopover(false);
      } else {
        togglePlay();
      }
    });

    // VLC-Style Right-Click Context Menu
    function closeVlcContextMenu() {
      if (!vlcContextMenu) return;
      vlcContextMenu.classList.remove('open');
      vlcContextMenu.setAttribute('aria-hidden', 'true');
    }

    function updateVlcContextMenuState() {
      if (!vlcContextMenu) return;
      const isPaused = video.paused;
      if (ctxPlayLabel) ctxPlayLabel.textContent = isPaused ? 'Play' : 'Pause';
      if (ctxPlayIcon) {
        ctxPlayIcon.innerHTML = isPaused
          ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>'
          : '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
      }
      if (ctxMuteLabel) ctxMuteLabel.textContent = userMuted ? 'Unmute' : 'Mute';
      if (ctxFsLabel) ctxFsLabel.textContent = appContainer.classList.contains('is-fullscreen') ? 'Exit Fullscreen' : 'Fullscreen';
      if (ctxSubToggleLabel) ctxSubToggleLabel.textContent = subtitlesVisible ? 'Hide Subtitles' : 'Show Subtitles';

      const curSpeed = Number(video.playbackRate || 1);
      vlcContextMenu.querySelectorAll('.ctx-check[data-ctx-speed]').forEach(el => {
        const s = Number(el.getAttribute('data-ctx-speed'));
        el.classList.toggle('active', Math.abs(curSpeed - s) < 0.05);
      });
      vlcContextMenu.querySelectorAll('.ctx-check[data-ctx-aspect]').forEach(el => {
        const a = el.getAttribute('data-ctx-aspect');
        el.classList.toggle('active', a === currentAspectVal);
      });
    }

    if (videoWrapper && vlcContextMenu) {
      videoWrapper.addEventListener('contextmenu', (e) => {
        if (e.target && e.target.closest && e.target.closest('#word-popover')) return;
        e.preventDefault();
        e.stopPropagation();
        endHoldSpeed();
        closeAllMenus();
        updateVlcContextMenuState();

        vlcContextMenu.classList.add('open');
        vlcContextMenu.setAttribute('aria-hidden', 'false');

        const menuRect = vlcContextMenu.getBoundingClientRect();
        const pad = 8;
        let left = e.clientX;
        let top = e.clientY;
        if (left + menuRect.width > window.innerWidth - pad) {
          left = Math.max(pad, window.innerWidth - menuRect.width - pad);
        }
        if (top + menuRect.height > window.innerHeight - pad) {
          top = Math.max(pad, window.innerHeight - menuRect.height - pad);
        }
        vlcContextMenu.style.left = `${left}px`;
        vlcContextMenu.style.top = `${top}px`;

        vlcContextMenu.querySelectorAll('.ctx-has-sub').forEach(subWrap => {
          subWrap.classList.remove('flip-left', 'flip-up');
          const sub = subWrap.querySelector('.ctx-submenu');
          if (!sub) return;
          const wrapRect = subWrap.getBoundingClientRect();
          if (wrapRect.right + 220 > window.innerWidth - pad) {
            subWrap.classList.add('flip-left');
          }
          if (wrapRect.top + 230 > window.innerHeight - pad) {
            subWrap.classList.add('flip-up');
          }
        });
      });

      vlcContextMenu.addEventListener('click', async (e) => {
        const btn = e.target.closest('.ctx-item[data-ctx-action]');
        if (!btn) return;
        e.stopPropagation();
        const action = btn.getAttribute('data-ctx-action');
        closeVlcContextMenu();

        switch (action) {
          case 'play-pause': togglePlay(); break;
          case 'stop':
            video.pause();
            video.currentTime = 0;
            subtitleDelayMs = 0;
            audioDelayMs = 0;
            updateSyncDelayUI();
            if (isAudioTranscoded && compatibleAudio) {
              compatibleAudio.pause();
              compatibleAudio.currentTime = 0;
            }
            showToast('Stop (Sync reset to 0ms)');
            break;
          case 'prev':
            video.currentTime = Math.max(0, video.currentTime - 5);
            showToast('-00:05');
            break;
          case 'next':
            video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
            showToast('+00:05');
            break;
          case 'mute': toggleMute(); break;
          case 'vol-up': adjustVolume(0.05); break;
          case 'vol-down': adjustVolume(-0.05); break;
          case 'audio-fix':
            if (!currentFilePath) showToast('Please open a media file first');
            else transcodeAndAttachAudio(currentFilePath);
            break;
          case 'audio-delay-plus': adjustAudioDelay(50); break;
          case 'audio-delay-minus': adjustAudioDelay(-50); break;
          case 'fullscreen': toggleFullscreen(); break;
          case 'aspect-cycle': cycleAspectRatio(); break;
          case 'aspect-auto': setAspectRatio('auto', 'Default (Auto)'); break;
          case 'aspect-16-9': setAspectRatio('16/9', '16:9 (Widescreen)'); break;
          case 'aspect-4-3': setAspectRatio('4/3', '4:3 (Standard TV)'); break;
          case 'aspect-16-10': setAspectRatio('16/10', '16:10'); break;
          case 'aspect-235': setAspectRatio('2.35/1', '2.35:1 (Cinema)'); break;
          case 'aspect-1-1': setAspectRatio('1/1', '1:1 (Square)'); break;
          case 'aspect-fill': setAspectRatio('fill', 'Fill Window'); break;
          case 'add-sub': {
            const res = await window.WordTapAPI.openSubtitleFile();
            if (res && res.content) loadSubtitles(res.content, `Loaded ${res.fileName}`, res.filePath, false);
            break;
          }
          case 'sub-vlsub': openVLsubModal(); break;
          case 'toggle-sub':
            subtitlesVisible = !subtitlesVisible;
            btnToggleSub.classList.toggle('active', subtitlesVisible);
            renderSubtitle(currentCue);
            showToast(subtitlesVisible ? 'Subtitles: Enabled' : 'Subtitles: Disabled');
            break;
          case 'sub-style': openSubtitleStyleModal(); break;
          case 'sub-delay-plus': adjustSubtitleDelay(100); break;
          case 'sub-delay-minus': adjustSubtitleDelay(-100); break;
          case 'speed-075': setPlaybackSpeed(0.75, true); break;
          case 'speed-100': setPlaybackSpeed(1.0, true); break;
          case 'speed-125': setPlaybackSpeed(1.25, true); break;
          case 'speed-150': setPlaybackSpeed(1.5, true); break;
          case 'speed-200': setPlaybackSpeed(2.0, true); break;
          case 'replay': replayCurrentLine(); break;
          case 'theme-toggle': toggleTheme(); break;
          case 'saved-words': openSavedWordsModal(); break;
          case 'options': if (accountModal) accountModal.classList.add('open'); break;
          case 'open-file': {
            const res = await window.WordTapAPI.openVideoFile();
            if (res) playVideoFile(res.fileUrl, res.fileName, res.subContent, res.filePath);
            break;
          }
          case 'quit':
            if (window.WordTapAPI && window.WordTapAPI.quitApp) window.WordTapAPI.quitApp();
            break;
        }
      });

      document.addEventListener('mousedown', (e) => {
        if (vlcContextMenu.classList.contains('open') && !vlcContextMenu.contains(e.target)) {
          closeVlcContextMenu();
        }
      });
      window.addEventListener('blur', closeVlcContextMenu);
    }

    video.addEventListener('play', () => {
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
      audioUnmuteBanner.style.display = 'none';
      resumeAudioContext();
      updateVolumeDisplay();
      if (isAudioTranscoded && compatibleAudio && compatibleAudio.src) {
        if (compatibleAudio.paused) {
          compatibleAudio.play().catch(() => {});
        }
        syncAudioWithVideo();
      }
      if (wordPopover && wordPopover.classList.contains('visible') && !wordPopover.dataset.hovered) {
        updatePopoverFooter();
        schedulePopoverClose(AUTO_CLOSE_DELAY_MS);
      }
      resetControlsTimeout();
    });

    video.addEventListener('pause', () => {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      if (isAudioTranscoded && compatibleAudio && !compatibleAudio.paused) {
        compatibleAudio.pause();
      }
      clearTimeout(popoverHideTimer);
      if (wordPopover && wordPopover.classList.contains('visible')) {
        updatePopoverFooter();
      }
      showControls();
    });

    video.addEventListener('ended', () => {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      subtitleDelayMs = 0;
      audioDelayMs = 0;
      updateSyncDelayUI();
      if (isAudioTranscoded && compatibleAudio && !compatibleAudio.paused) {
        compatibleAudio.pause();
      }
      showControls();
      showToast('Playback finished (Sync reset to 0ms)');
    });

    video.addEventListener('seeked', () => {
      if (!isScrubbing && isAudioTranscoded && currentFilePath) {
        const audioElapsed = compatibleAudio ? (compatibleAudio.currentTime || 0) : 0;
        const currentAudioTime = audioStreamStartTime + audioElapsed + (audioDelayMs / 1000);
        if (Math.abs(video.currentTime - currentAudioTime) > 0.4) {
          startLiveAudioStream(video.currentTime);
        } else {
          syncAudioWithVideo();
        }
      }
    });

    video.addEventListener('ratechange', () => {
      if (isAudioTranscoded && compatibleAudio && compatibleAudio.src) {
        compatibleAudio.playbackRate = video.playbackRate;
      }
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

      // Continuous sample-accurate audio sync
      syncAudioWithVideo();

      // Periodic media session persistence (every 2s)
      const now = Date.now();
      if (now - lastSessionSaveTime > 2000) {
        lastSessionSaveTime = now;
        saveCurrentMediaSession(false);
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
        } else if (foundIdx === -1 && currentCue !== null) {
          activeCueIdx = -1;
          currentCue = null;
          renderSubtitle(null);
        }
      }
    });

    // Scrubber Seeking
    function seekFromEvent(e) {
      const rect = scrubberContainer.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (video.duration) {
        const targetTime = pos * video.duration;
        video.currentTime = targetTime;
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
      if (isScrubbing) {
        isScrubbing = false;
        if (isAudioTranscoded && currentFilePath) {
          startLiveAudioStream(video.currentTime);
        }
        resetControlsTimeout();
      }
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
        const target = Math.max(0, currentCue.start + (subtitleDelayMs / 1000));
        video.currentTime = target;
        if (isAudioTranscoded && currentFilePath) {
          startLiveAudioStream(target);
        }
        video.play().catch(() => {});
        showToast('Replaying line');
      } else if (cues.length > 0) {
        const cur = video.currentTime - (subtitleDelayMs / 1000);
        const prevCue = [...cues].reverse().find(c => c.start <= cur);
        if (prevCue) {
          const target = Math.max(0, prevCue.start + (subtitleDelayMs / 1000));
          video.currentTime = target;
          if (isAudioTranscoded && currentFilePath) {
            startLiveAudioStream(target);
          }
          video.play().catch(() => {});
          showToast('Replaying line');
        }
      }
    }
    btnReplayLine.addEventListener('click', replayCurrentLine);

    // Seek buttons (-5s, +5s)
    btnSeekBack.addEventListener('click', () => {
      const target = Math.max(0, video.currentTime - 5);
      video.currentTime = target;
      if (isAudioTranscoded && currentFilePath) startLiveAudioStream(target);
      showToast('-00:05');
    });
    btnSeekFwd.addEventListener('click', () => {
      const target = Math.min(video.duration || 0, video.currentTime + 5);
      video.currentTime = target;
      if (isAudioTranscoded && currentFilePath) startLiveAudioStream(target);
      showToast('+00:05');
    });

    // Speed Bar Controls (Slider, Steps, Wheel, Click-to-Reset)
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        setPlaybackSpeed(parseFloat(e.target.value), true);
      });
    }

    if (btnSpeedMinus) {
      btnSpeedMinus.addEventListener('click', (e) => {
        e.stopPropagation();
        adjustPlaybackSpeed(-0.1);
      });
    }

    if (btnSpeedPlus) {
      btnSpeedPlus.addEventListener('click', (e) => {
        e.stopPropagation();
        adjustPlaybackSpeed(0.1);
      });
    }

    if (speedGroup) {
      speedGroup.addEventListener('wheel', (e) => {
        e.preventDefault();
        adjustPlaybackSpeed(e.deltaY < 0 ? 0.1 : -0.1);
      }, { passive: false });
    }

    if (btnSpeed) {
      btnSpeed.addEventListener('click', (e) => {
        e.stopPropagation();
        // If not at normal 1.0x, clicking the badge resets to 1.0x (=)
        if (Math.abs((video.playbackRate || 1.0) - 1.0) > 0.04) {
          setPlaybackSpeed(1.0, true);
        } else {
          // If already 1.0x, cycle through presets
          currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
          setPlaybackSpeed(speeds[currentSpeedIndex], true);
        }
      });
    }

    // Subtitle Toggle (CC)
    btnToggleSub.addEventListener('click', () => {
      subtitlesVisible = !subtitlesVisible;
      btnToggleSub.classList.toggle('active', subtitlesVisible);
      renderSubtitle(currentCue);
      showToast(subtitlesVisible ? 'Subtitles: Enabled' : 'Subtitles: Disabled');
    });

    // Volume & Sound Handling Listeners (uses outer scoped functions)
    btnMute.addEventListener('click', toggleMute);
    if (volumePercentLabel) {
      volumePercentLabel.style.cursor = 'pointer';
      volumePercentLabel.title = 'Click to mute/unmute';
      volumePercentLabel.addEventListener('click', toggleMute);
    }

    volumeSlider.addEventListener('input', (e) => {
      setVolume(parseFloat(e.target.value));
    });

    // Mouse wheel support on volume controls (VLC style)
    const volumeGroup = document.querySelector('.volume-group');
    if (volumeGroup) {
      volumeGroup.addEventListener('wheel', (e) => {
        e.preventDefault();
        adjustVolume(e.deltaY < 0 ? 0.05 : -0.05);
      }, { passive: false });
    }

    btnFullscreen.addEventListener('click', toggleFullscreen);
    video.addEventListener('dblclick', toggleFullscreen);

    // Mouse & Keyboard Activity Tracking for Fullscreen Auto-Hide Controls
    appContainer.addEventListener('mousemove', (e) => {
      if (e.clientX === lastMouseX && e.clientY === lastMouseY) return;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      resetControlsTimeout();
    });

    appContainer.addEventListener('mousedown', resetControlsTimeout);
    document.addEventListener('keydown', resetControlsTimeout);

    topVlcMenu.addEventListener('mouseenter', () => {
      isMouseOverControls = true;
      showControls();
    });
    topVlcMenu.addEventListener('mouseleave', () => {
      isMouseOverControls = false;
      resetControlsTimeout();
    });

    vlcBottomBar.addEventListener('mouseenter', () => {
      isMouseOverControls = true;
      showControls();
    });
    vlcBottomBar.addEventListener('mouseleave', () => {
      isMouseOverControls = false;
      resetControlsTimeout();
    });

    // Drag & Drop Handling
    appContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    appContainer.addEventListener('drop', async (e) => {
      e.preventDefault();

      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const ext = file.name.split('.').pop().toLowerCase();

        if (['srt', 'vtt', 'sub'].includes(ext)) {
          const droppedSubPath = (window.WordTapAPI && window.WordTapAPI.getPathForFile) ? window.WordTapAPI.getPathForFile(file) : (file.path || '');
          const reader = new FileReader();
          reader.onload = (re) => {
            loadSubtitles(re.target.result, `Loaded ${file.name}`, droppedSubPath, false);
          };
          reader.readAsText(file);
        } else if (['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v', 'ts', 'flv'].includes(ext)) {
          const fileUrl = URL.createObjectURL(file);
          const droppedPath = (window.WordTapAPI && window.WordTapAPI.getPathForFile) ? window.WordTapAPI.getPathForFile(file) : (file.path || '');
          
          let hist = null;
          if (droppedPath && window.WordTapAPI && window.WordTapAPI.getMediaHistory) {
            try {
              hist = await window.WordTapAPI.getMediaHistory(droppedPath);
            } catch {}
          }

          if (hist && hist.subPath) {
            const histSub = await window.WordTapAPI.readSubtitleFile(hist.subPath);
            if (histSub && histSub.content) {
              playVideoFile(fileUrl, file.name, histSub.content, droppedPath, hist.subtitleDelayMs || 0, hist.savedTime || 0, hist.subPath);
              return;
            }
          }

          let adjContent = null;
          let adjPath = null;
          if (droppedPath) {
            const adjacentResult = await window.WordTapAPI.readSubtitleFile(
              droppedPath.replace(/\.[^/.]+$/, '.srt')
            );
            if (adjacentResult && adjacentResult.content) {
              adjContent = adjacentResult.content;
              adjPath = adjacentResult.filePath;
            }
          }

          playVideoFile(fileUrl, file.name, adjContent, droppedPath, 0, 0, adjPath);
        }
      }
    });

    // Session Persistence on Unload, Pause, and Seek
    window.addEventListener('beforeunload', () => {
      saveCurrentMediaSession(true);
    });
    window.addEventListener('unload', () => {
      saveCurrentMediaSession(true);
    });
    video.addEventListener('pause', () => {
      saveCurrentMediaSession(false);
    });
    video.addEventListener('seeked', () => {
      saveCurrentMediaSession(false);
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        if (e.code === 'Escape') {
          if (subtitleStyleModal && subtitleStyleModal.classList.contains('open')) {
            closeSubtitleStyleModal();
          } else if (vlsubModal && vlsubModal.classList.contains('open')) {
            closeVLsubModal();
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyO') {
        e.preventDefault();
        window.WordTapAPI.openVideoFile().then(res => {
          if (res) playVideoFile(res.fileUrl, res.fileName, res.subContent, res.filePath);
        });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyQ') {
        e.preventDefault();
        if (window.WordTapAPI && window.WordTapAPI.quitApp) {
          window.WordTapAPI.quitApp();
        }
        return;
      }

      if (e.code === 'Escape' && typeof closeVlcContextMenu === 'function') {
        closeVlcContextMenu();
      }

      if (e.altKey && (e.code === 'KeyS' || e.code === 'KeyF')) {
        e.preventDefault();
        if (subtitleStyleModal && subtitleStyleModal.classList.contains('open')) {
          closeSubtitleStyleModal();
        } else {
          openSubtitleStyleModal();
        }
        return;
      }

      if (e.altKey && e.code === 'KeyA') {
        e.preventDefault();
        cycleSubSize();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        adjustSubCustomSize(2);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        adjustSubCustomSize(-2);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'Escape') {
        closeAllMenus();
        if (subtitleStyleModal && subtitleStyleModal.classList.contains('open')) {
          closeSubtitleStyleModal();
        } else if (vlsubModal && vlsubModal.classList.contains('open')) {
          closeVLsubModal();
        } else if (wordPopover.classList.contains('visible')) {
          closePopover(true);
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
        toggleMute();
      } else if (e.code === 'KeyT') {
        toggleTheme();
      } else if (e.code === 'KeyS') {
        replayCurrentLine();
      } else if (e.code === 'KeyC') {
        subtitlesVisible = !subtitlesVisible;
        btnToggleSub.classList.toggle('active', subtitlesVisible);
        renderSubtitle(currentCue);
      } else if (e.code === 'KeyA') {
        cycleAspectRatio();
      } else if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
        helpModal.classList.toggle('open');
      } else if (e.code === 'ArrowLeft') {
        const target = Math.max(0, video.currentTime - 5);
        video.currentTime = target;
        if (isAudioTranscoded && currentFilePath) startLiveAudioStream(target);
        showToast('-00:05');
      } else if (e.code === 'ArrowRight') {
        const target = Math.min(video.duration || 0, video.currentTime + 5);
        video.currentTime = target;
        if (isAudioTranscoded && currentFilePath) startLiveAudioStream(target);
        showToast('+00:05');
      } else if (e.code === 'ArrowUp') {
        adjustVolume(0.05);
      } else if (e.code === 'ArrowDown') {
        adjustVolume(-0.05);
      } else if (e.code === 'KeyJ') {
        adjustAudioDelay(-50);
      } else if (e.code === 'KeyK') {
        adjustAudioDelay(50);
      } else if (e.code === 'KeyG') {
        adjustSubtitleDelay(-50);
      } else if (e.code === 'KeyH') {
        adjustSubtitleDelay(50);
      } else if (e.code === 'BracketLeft') {
        e.preventDefault();
        adjustPlaybackSpeed(-0.1);
      } else if (e.code === 'BracketRight') {
        e.preventDefault();
        adjustPlaybackSpeed(0.1);
      } else if (!e.ctrlKey && !e.metaKey && (e.key === '=' || (e.code === 'Equal' && !e.shiftKey))) {
        e.preventDefault();
        setPlaybackSpeed(1.0, true);
      } else if (!e.ctrlKey && !e.metaKey && (e.key === '+' || e.code === 'NumpadAdd' || (e.code === 'Equal' && e.shiftKey))) {
        e.preventDefault();
        adjustPlaybackSpeed(0.5);
      } else if (!e.ctrlKey && !e.metaKey && (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault();
        adjustPlaybackSpeed(-0.5);
      }
    });
  }

  setupAuthGate();
  init();
})();
