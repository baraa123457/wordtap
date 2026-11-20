// WordTap VLC Media Player - Core Renderer Script
(() => {
  const SUPABASE_URL = "https://vjjilwbhvoxfigrokqch.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_YzMg6sNWjpwwfP2T-apa-Q_c3EHVBNa";
  const WEBSITE_URL = "https://wordtap.vercel.app";

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

  // Mandatory Login Gate Elements
  const authGateScreen = document.getElementById('auth-gate-screen');
  const gateLoginForm = document.getElementById('gate-login-form');
  const gateEmail = document.getElementById('gate-email');
  const gatePassword = document.getElementById('gate-password');
  const gateAuthError = document.getElementById('gate-auth-error');
  const btnGateSignin = document.getElementById('btn-gate-signin');
  const btnGateOffline = document.getElementById('btn-gate-offline');
  const btnGateCreateAcc = document.getElementById('btn-gate-create-acc');

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

  // Subtitle Sizes
  const subSizes = [
    { label: '20px', cls: 'sub-size-compact' },
    { label: '26px', cls: 'sub-size-standard' },
    { label: '34px', cls: 'sub-size-large' },
    { label: '42px', cls: 'sub-size-cinema' }
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
  let savedWords = [];
  let translateSaveMode = 'subtitles_only'; // 'manual' | 'subtitles_only' | 'auto'
  let pauseOnClick = false; // "dont stop the film when i click on word"
  let targetLang = 'ar';
  let popoverHideTimer = null;
  const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
  let currentSpeedIndex = 1;
  let currentMediaTitle = 'No media loaded';
  let currentFilePath = null;
  let isAudioTranscoded = false;
  let audioStreamStartTime = 0;
  let liveAudioResyncing = false;
  let audioDelayMs = 0;
  let audioSyncLoop = null;
  let userVolume = 1.0;
  let userMuted = false;
  let vlsubSearchResults = [];
  let selectedVlsubIndex = -1;

  // Web Audio Amplification Graph (VLC-Style Volume Boost up to 200%)
  let audioCtx = null;
  let masterGainNode = null;
  let limiterNode = null;

  function ensureWebAudioGraph() {
    if (audioCtx) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      audioCtx = new AudioCtxClass();

      // Master Gain: scales audio cleanly from 0.0 to 2.0 (0% - 200%)
      masterGainNode = audioCtx.createGain();
      masterGainNode.gain.setValueAtTime(userMuted ? 0 : userVolume, audioCtx.currentTime);

      // Dynamics Compressor acts as a soft limiter when boosting > 100% to prevent harsh digital clipping
      limiterNode = audioCtx.createDynamicsCompressor();
      limiterNode.threshold.setValueAtTime(-1.5, audioCtx.currentTime);
      limiterNode.knee.setValueAtTime(6, audioCtx.currentTime);
      limiterNode.ratio.setValueAtTime(10, audioCtx.currentTime);
      limiterNode.attack.setValueAtTime(0.002, audioCtx.currentTime);
      limiterNode.release.setValueAtTime(0.15, audioCtx.currentTime);

      masterGainNode.connect(limiterNode);
      limiterNode.connect(audioCtx.destination);
    } catch (e) {
      console.warn('Web Audio Graph initialization notice:', e);
    }
  }

  function hookAudioElement(element) {
    if (!element || element._webAudioHooked) return;
    try {
      ensureWebAudioGraph();
      if (audioCtx && masterGainNode) {
        const srcNode = audioCtx.createMediaElementSource(element);
        srcNode.connect(masterGainNode);
        element._webAudioHooked = true;
      }
    } catch (err) {
      console.warn('Could not hook media element to Web Audio:', err);
    }
  }

  // Volume & Sound Handling (VLC Style with Percentage and Boost >100% up to 200%)
  function updateVolumeDisplay() {
    ensureWebAudioGraph();
    hookAudioElement(video);
    hookAudioElement(compatibleAudio);

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const pct = Math.round(userVolume * 100);
    if (volumeSlider) volumeSlider.value = userVolume;

    // Update Slider Track Fill (VLC style with boost indicator)
    const sliderRatio = Math.min(100, Math.max(0, (userVolume / 2.0) * 100));
    if (volumeSlider) {
      if (userMuted || userVolume === 0) {
        volumeSlider.style.background = 'rgba(255, 255, 255, 0.2)';
      } else if (pct > 100) {
        // Boost portion (>100%) shown in vibrant VLC orange/amber
        volumeSlider.style.background = `linear-gradient(to right, #F36F21 0%, #F36F21 50%, #ff9800 50%, #ff9800 ${sliderRatio}%, rgba(255, 255, 255, 0.2) ${sliderRatio}%, rgba(255, 255, 255, 0.2) 100%)`;
      } else {
        volumeSlider.style.background = `linear-gradient(to right, #F36F21 0%, #F36F21 ${sliderRatio}%, rgba(255, 255, 255, 0.2) ${sliderRatio}%, rgba(255, 255, 255, 0.2) 100%)`;
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

    // Route volume through Web Audio Gain Node
    if (masterGainNode && audioCtx) {
      const targetGain = userMuted ? 0 : userVolume;
      try {
        masterGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        masterGainNode.gain.setValueAtTime(targetGain, audioCtx.currentTime);
      } catch {}

      if (video) {
        video.muted = isAudioTranscoded ? true : userMuted;
        video.volume = 1.0;
      }
      if (compatibleAudio) {
        compatibleAudio.muted = !isAudioTranscoded ? true : userMuted;
        compatibleAudio.volume = 1.0;
      }
    } else {
      // Fallback for non-WebAudio environments (clamped to 1.0)
      const clampedVol = Math.max(0, Math.min(1.0, userVolume));
      if (video) {
        video.muted = isAudioTranscoded ? true : userMuted;
        video.volume = clampedVol;
      }
      if (compatibleAudio) {
        compatibleAudio.muted = !isAudioTranscoded ? true : userMuted;
        compatibleAudio.volume = clampedVol;
      }
    }
  }

  function toggleMute() {
    userMuted = !userMuted;
    updateVolumeDisplay();
    showToast(userMuted ? 'Muted' : `Volume: ${Math.round(userVolume * 100)}%`);
  }

  function adjustVolume(delta) {
    userVolume = Math.max(0, Math.min(2.0, Math.round((userVolume + delta) * 100) / 100));
    if (userVolume > 0) userMuted = false;
    updateVolumeDisplay();
    if (window.WordTapAPI && window.WordTapAPI.saveConfig) {
      window.WordTapAPI.saveConfig({ volume: userVolume });
    }
    showToast(`Volume: ${Math.round(userVolume * 100)}%`);
  }

  function setVolume(val) {
    userVolume = Math.max(0, Math.min(2.0, Math.round(val * 100) / 100));
    if (userVolume > 0) userMuted = false;
    updateVolumeDisplay();
    if (window.WordTapAPI && window.WordTapAPI.saveConfig) {
      window.WordTapAPI.saveConfig({ volume: userVolume });
    }
  }

  // Active Precision Audio-Video Lip-Sync Engine
  function syncAudioWithVideo() {
    if (!isAudioTranscoded || !compatibleAudio || !compatibleAudio.src || compatibleAudio.paused || video.paused || isScrubbing) {
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
      ensureWebAudioGraph();
      hookAudioElement(video);
      hookAudioElement(compatibleAudio);
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

    // Continue as Guest (Offline Mode)
    if (btnGateOffline) {
      btnGateOffline.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideLoginGate();
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
      } else {
        showLoginGate();
      }
      subtitleDelayMs = 0;
      updateSyncDelayUI();
      if (config && typeof config.subSizeIdx === 'number' && config.subSizeIdx >= 0 && config.subSizeIdx < subSizes.length) {
        currentSubSizeIdx = config.subSizeIdx;
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
      if (config && typeof config.volume === 'number' && config.volume >= 0 && config.volume <= 2.0) {
        userVolume = config.volume;
      }
      syncOptionsUI();
      applySubSize(currentSubSizeIdx);
      updateVolumeDisplay();
      refreshSavedWordsCount();

      if (window.WordTapAPI && window.WordTapAPI.isFullscreen) {
        window.WordTapAPI.isFullscreen().then(isFS => {
          if (isFS) setFullscreenState(true);
        }).catch(() => {});
      }

      // Check if launched directly with a video file (Windows Explorer "Open with" or double-click)
      if (window.WordTapAPI && window.WordTapAPI.getInitialFile) {
        try {
          const initFile = await window.WordTapAPI.getInitialFile();
          if (initFile && initFile.fileUrl) {
            playVideoFile(initFile.fileUrl, initFile.fileName, initFile.subContent, initFile.filePath);
            hideLoginGate();
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

  // Subtitle Sizing
  function applySubSize(index) {
    subSizes.forEach(s => subtitleContainer.classList.remove(s.cls));
    const size = subSizes[index];
    subtitleContainer.classList.add(size.cls);
    if (btnSubSize) btnSubSize.textContent = `Font Size (${size.label})`;
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
    subtitleDelayMs = 0;
    updateSyncDelayUI();
    cues = parseSubtitles(content);
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
  }

  // Schedule popover dismiss timer (default 2600ms, paused while hovered)
  function schedulePopoverClose(delayMs = 2600) {
    clearTimeout(popoverHideTimer);
    if (!wordPopover.dataset.hovered) {
      popoverHideTimer = setTimeout(() => {
        closePopover(false);
      }, delayMs);
    }
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
      '<strong style="color:var(--wt-gold);">$1</strong>'
    );

    const isAlreadySaved = savedWords.some(w => (w.text || '').toLowerCase() === cleanWord.toLowerCase());
    if (isAlreadySaved) {
      popoverBtnSave.classList.add('saved');
      popoverBtnSave.innerHTML = '<span>✓ Saved to WordTap</span>';
    } else {
      popoverBtnSave.classList.remove('saved');
      popoverBtnSave.innerHTML = '<span>★ Save to WordTap</span>';
    }

    if (popoverFooterText) {
      if (pauseOnClick) {
        popoverFooterText.innerHTML = 'Press <strong>Space</strong> or <strong>Esc</strong> to resume video';
      } else {
        popoverFooterText.innerHTML = 'Hover to keep open • Auto-closes in 1s';
      }
    }

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

    // Initial dismiss timer: stays for 2.6s unless mouse hovers over it
    schedulePopoverClose(2600);

    const langToUse = targetLang || 'ar';
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(langToUse)}&dt=t&dt=bd&dt=qca&dt=at&q=${encodeURIComponent(cleanWord)}`
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

        // Auto-save logic: if 'subtitles_only' or 'auto' mode is active, auto-save to WordTap!
        const willAutoSave = (translateSaveMode === 'auto' || translateSaveMode === 'subtitles_only');
        if (willAutoSave && !isAlreadySaved) {
          saveActiveWord(true);
        }
      } else {
        popoverTranslationAr.textContent = 'تعذر الاتصال بالترجمة';
      }
    } catch (err) {
      console.warn('Translation error:', err);
      popoverTranslationAr.textContent = 'خطأ في الترجمة';
    }

    schedulePopoverClose(2600);
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

  // Save Word Handler
  async function saveActiveWord(isAuto = false) {
    if (!activeWordData) return;

    if (!isAuto) {
      popoverBtnSave.innerHTML = '<span>Saving...</span>';
    }

    const entry = {
      text: activeWordData.cleanWord || activeWordData.word,
      translation: activeWordData.translation || '',
      sentence: activeWordData.contextSentence || '',
      title: currentMediaTitle !== 'No media loaded' ? currentMediaTitle : 'WordTap VLC Video',
      lang: targetLang || 'ar',
      src: 'en',
      createdAt: new Date().toISOString()
    };

    await window.WordTapAPI.saveWord(entry);
    await refreshSavedWordsCount();

    if (userSession && userSession.access_token) {
      try {
        await syncWordToSupabase(entry, userSession.access_token);
      } catch (err) {
        console.warn('Supabase sync background fail (will retry):', err);
      }
    }

    popoverBtnSave.classList.add('saved');
    popoverBtnSave.innerHTML = '<span>✓ Saved to WordTap</span>';
    if (!isAuto) {
      showToast(`Saved: "${entry.text}"`);
    }
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
      btnAuthSignin.textContent = 'Sign In';
    }
  }

  async function handleSignOut() {
    userSession = null;
    await window.WordTapAPI.saveConfig({ session: null });
    updateAccountUI();
    accountModal.classList.remove('open');
    showLoginGate();
    showToast('Signed out');
  }

  async function pushPendingOfflineWords() {
    if (!userSession || !userSession.access_token) return;
    const words = await window.WordTapAPI.getSavedWords();
    if (!words || words.length === 0) return;
    showToast(`Syncing ${words.length} words...`);
    for (const w of words) {
      try {
        await syncWordToSupabase(w, userSession.access_token);
      } catch {}
    }
    showToast('Words synced');
  }

  // Load Saved Words Modal
  function openSavedWordsModal() {
    let html = '';
    if (savedWords.length === 0) {
      html = '<div style="color:var(--text-secondary); text-align:center; padding:20px;">No words saved yet. Click any subtitle word during video playback to save it!</div>';
    } else {
      for (const w of savedWords) {
        html += `
          <div class="saved-word-row">
            <span class="saved-word-title">${w.text}</span>
            <span class="saved-word-ar">${w.translation || ''}</span>
          </div>
        `;
      }
    }
    savedWordsListContainer.innerHTML = html;
    savedWordsModal.classList.add('open');
  }

  // Subtitle Synchronization Adjustment
  function updateSyncDelayUI() {
    const sign = subtitleDelayMs > 0 ? '+' : '';
    syncDelayText.textContent = `${sign}${subtitleDelayMs}ms`;
  }

  function adjustSubtitleDelay(deltaMs) {
    subtitleDelayMs += deltaMs;
    updateSyncDelayUI();
    const sign = subtitleDelayMs > 0 ? '+' : '';
    showToast(`Subtitle delay: ${sign}${subtitleDelayMs} ms`);
  }

  function resetSubtitleDelay() {
    subtitleDelayMs = 0;
    updateSyncDelayUI();
    showToast('Subtitle sync reset to 0ms');
  }

  function resetAudioDelay() {
    audioDelayMs = 0;
    syncAudioWithVideo();
    showToast('Audio sync reset to 0ms');
  }

  // Video Load Handler - GUARANTEED AUDIO & DOLBY/DTS TRANSCODING
  async function playVideoFile(fileUrl, fileName, subContent = null, filePath = null) {
    currentMediaTitle = fileName;
    currentFilePath = filePath;
    isAudioTranscoded = false;
    audioStreamStartTime = 0;
    liveAudioResyncing = false;
    audioDelayMs = 0;
    subtitleDelayMs = 0;
    updateSyncDelayUI();

    if (compatibleAudio) {
      compatibleAudio.pause();
      compatibleAudio.removeAttribute('src');
      compatibleAudio.load();
    }

    video.src = fileUrl;
    dropZone.classList.add('hidden');

    // Make sure audio element is hooked and display updated with current volume
    hookAudioElement(video);
    userMuted = false;
    updateVolumeDisplay();

    if (subContent) {
      loadSubtitles(subContent, 'Auto-loaded matching subtitle');
    }
    showToast(fileName);

    // Automatic Dolby AC3 / E-AC3 / DTS Audio Stream Probing & Real-Time Transcoding
    if (filePath && window.WordTapAPI && window.WordTapAPI.probeAudio) {
      try {
        const info = await window.WordTapAPI.probeAudio(filePath);
        if (info && info.needsTranscode) {
          const codecName = (info.codecs && info.codecs.length > 0) ? info.codecs.join('/') : 'DDP 5.1';
          showToast(`Audio: Dolby ${codecName}`);
          video.currentTime = 0;
          await startLiveAudioStream(0);
          return;
        }
      } catch (e) {
        console.warn('Audio probe err:', e);
      }
    }

    // Default play for standard native audio formats (AAC, MP3, etc.)
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Autoplay warning:', err);
        audioUnmuteBanner.style.display = 'block';
      });
    }
  }

  // Real-Time On-Demand Audio Streaming Engine (FFmpeg live MP3 stream with Active Lip-Sync)
  async function startLiveAudioStream(seekTime = 0) {
    if (!currentFilePath || !window.WordTapAPI || !window.WordTapAPI.getAudioStreamUrl) {
      showToast('Please open a media file first');
      return;
    }
    try {
      const targetTime = Math.max(0, seekTime);
      audioStreamStartTime = targetTime;

      const streamUrl = await window.WordTapAPI.getAudioStreamUrl({
        filePath: currentFilePath,
        startTime: targetTime
      });

      if (streamUrl) {
        // Video element must stay muted so its unsupported audio track doesn't clash
        video.muted = true;
        isAudioTranscoded = true;

        compatibleAudio.src = streamUrl;
        compatibleAudio.playbackRate = video.playbackRate;

        // Ensure audio element has user's volume and unmuted state
        hookAudioElement(compatibleAudio);
        compatibleAudio.muted = userMuted;
        compatibleAudio.volume = Math.max(0, Math.min(1.0, userVolume));
        updateVolumeDisplay();

        // Hardware-lock event: Align video frame to the audio stream's exact presentation time the instant sound begins!
        const onAudioPlaying = () => {
          compatibleAudio.removeEventListener('playing', onAudioPlaying);
          if (isAudioTranscoded && !video.paused) {
            const elapsed = compatibleAudio.currentTime || 0;
            video.currentTime = Math.max(0, audioStreamStartTime + elapsed + (audioDelayMs / 1000));
          }
        };
        compatibleAudio.addEventListener('playing', onAudioPlaying);

        if (!video.paused) {
          const p = compatibleAudio.play();
          if (p !== undefined) p.catch(() => {});
        }
        showToast('Audio: Dolby Digital Plus 5.1 (Direct)');

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
      const res = await window.WordTapAPI.downloadVLSub(item.id);
      if (res && res.ok && res.srtContent) {
        loadSubtitles(res.srtContent, `VLsub: ${item.fileName}`);
        vlsubStatusText.textContent = 'Subtitle loaded successfully into player';
        vlsubStatusText.className = 'vlsub-status-message success';
        setTimeout(() => {
          closeVLsubModal();
        }, 500);
        showToast(`Subtitles: ${item.fileName}`);
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
          playVideoFile(payload.fileUrl, payload.fileName, payload.subContent, payload.filePath);
          hideLoginGate();
        }
      });
    }

    // Audio Unmute Banner
    audioUnmuteBanner.addEventListener('click', () => {
      video.muted = false;
      video.volume = 1.0;
      video.play().catch(() => {});
      audioUnmuteBanner.style.display = 'none';
    });

    // Setup Auth Gate Listeners (Immediate & Responsive)
    setupAuthGate();

    // Open Video
    btnOpenVideo.addEventListener('click', async () => {
      closeAllMenus();
      const res = await window.WordTapAPI.openVideoFile();
      if (res) {
        playVideoFile(res.fileUrl, res.fileName, res.subContent, res.filePath);
      }
    });

    btnSplashOpenVideo.addEventListener('click', async () => {
      const res = await window.WordTapAPI.openVideoFile();
      if (res) {
        playVideoFile(res.fileUrl, res.fileName, res.subContent, res.filePath);
      }
    });

    // Open Subtitle
    btnOpenSub.addEventListener('click', async () => {
      closeAllMenus();
      const res = await window.WordTapAPI.openSubtitleFile();
      if (res && res.content) {
        loadSubtitles(res.content, `Loaded ${res.fileName}`);
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
      const speed = speeds[currentSpeedIndex];
      video.playbackRate = speed;
      if (isAudioTranscoded && compatibleAudio) compatibleAudio.playbackRate = speed;
      btnSpeed.textContent = `${speed.toFixed(speed === 1.0 ? 1 : 2).replace('.00', '.0')}x`;
      showToast(`Speed: ${speed}x`);
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

    // Subtitle Menu Actions
    bindMenuItem('menu-item-add-sub', async () => {
      const res = await window.WordTapAPI.openSubtitleFile();
      if (res && res.content) {
        loadSubtitles(res.content, `Loaded ${res.fileName}`);
      }
    });
    bindMenuItem('menu-item-sub-vlsub', openVLsubModal);
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
    bindMenuItem('menu-item-fs', toggleFullscreen);

    // Help Menu Actions
    bindMenuItem('menu-item-help-shortcuts', () => helpModal.classList.add('open'));
    bindMenuItem('menu-item-help-web', () => window.WordTapAPI.openExternal(WEBSITE_URL));

    // Subtitle Sync
    btnSyncMinus.addEventListener('click', () => adjustSubtitleDelay(-100));
    btnSyncPlus.addEventListener('click', () => adjustSubtitleDelay(100));
    syncDelayText.addEventListener('click', resetSubtitleDelay);

    // Subtitle Size
    btnSubSize.addEventListener('click', cycleSubSize);

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
        // Wait 1 second (1000ms) before closing popover
        popoverHideTimer = setTimeout(() => {
          closePopover(false);
        }, 1000);
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
    btnAccount.addEventListener('click', () => accountModal.classList.add('open'));
    btnCloseAccountModal.addEventListener('click', () => accountModal.classList.remove('open'));
    btnAuthSignin.addEventListener('click', handleSignIn);
    btnAuthSignout.addEventListener('click', handleSignOut);
    btnOpenWeb.addEventListener('click', () => window.WordTapAPI.openExternal(WEBSITE_URL));

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
      audioUnmuteBanner.style.display = 'none';
      if (isAudioTranscoded && compatibleAudio && compatibleAudio.src) {
        if (compatibleAudio.paused) {
          compatibleAudio.play().catch(() => {});
        }
        syncAudioWithVideo();
      }
      resetControlsTimeout();
    });

    video.addEventListener('pause', () => {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      if (isAudioTranscoded && compatibleAudio && !compatibleAudio.paused) {
        compatibleAudio.pause();
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

    // Speed Selector
    btnSpeed.addEventListener('click', () => {
      currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
      const speed = speeds[currentSpeedIndex];
      video.playbackRate = speed;
      if (isAudioTranscoded && compatibleAudio && compatibleAudio.src) compatibleAudio.playbackRate = speed;
      btnSpeed.textContent = `${speed.toFixed(speed === 1.0 ? 1 : 2).replace('.00', '.0')}x`;
      showToast(`Speed: ${speed}x`);
    });

    // Subtitle Toggle (CC)
    btnToggleSub.addEventListener('click', () => {
      subtitlesVisible = !subtitlesVisible;
      btnToggleSub.classList.toggle('active', subtitlesVisible);
      renderSubtitle(currentCue);
      showToast(subtitlesVisible ? 'Subtitles: Enabled' : 'Subtitles: Disabled');
    });

    // Volume & Sound Handling Listeners (uses outer scoped functions)
    btnMute.addEventListener('click', toggleMute);

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
          const reader = new FileReader();
          reader.onload = (re) => {
            loadSubtitles(re.target.result, `Loaded ${file.name}`);
          };
          reader.readAsText(file);
        } else if (['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v', 'ts', 'flv'].includes(ext)) {
          const fileUrl = URL.createObjectURL(file);
          const droppedPath = (window.WordTapAPI && window.WordTapAPI.getPathForFile) ? window.WordTapAPI.getPathForFile(file) : (file.path || '');
          playVideoFile(fileUrl, file.name, null, droppedPath);

          if (droppedPath) {
            const adjacentResult = await window.WordTapAPI.readSubtitleFile(
              droppedPath.replace(/\.[^/.]+$/, '.srt')
            );
            if (adjacentResult && adjacentResult.content) {
              loadSubtitles(adjacentResult.content, 'Auto-loaded adjacent .srt');
            }
          }
        }
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        if (e.code === 'Escape') {
          if (vlsubModal && vlsubModal.classList.contains('open')) {
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

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'Escape') {
        closeAllMenus();
        if (vlsubModal && vlsubModal.classList.contains('open')) {
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
      } else if (e.code === 'KeyS') {
        replayCurrentLine();
      } else if (e.code === 'KeyC') {
        subtitlesVisible = !subtitlesVisible;
        btnToggleSub.classList.toggle('active', subtitlesVisible);
        renderSubtitle(currentCue);
      } else if (e.code === 'KeyA') {
        cycleSubSize();
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
      } else if (e.code === 'BracketLeft') {
        adjustSubtitleDelay(-100);
      } else if (e.code === 'BracketRight') {
        adjustSubtitleDelay(100);
      }
    });
  }

  setupAuthGate();
  init();
})();
