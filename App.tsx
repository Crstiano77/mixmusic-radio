
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppTheme, VisualizerSettings } from './types';
import { THEMES, VERSES, STREAM_URL, METADATA_URL, DEFAULT_VISUALIZER_SETTINGS, UI_STRINGS } from './constants';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import Visualizer from './components/Visualizer';
import EqualizerPanel from './components/EqualizerPanel';
import TimerPanel from './components/TimerPanel';
import ThemeSwitcher from './components/ThemeSwitcher';
import VisualizerPanel from './components/VisualizerPanel';
import { WelcomePanel } from './components/WelcomePanel';
import { SharePanel } from './components/SharePanel';
import { TutorialOverlay } from './components/TutorialOverlay';
import { DonationPanel } from './components/DonationPanel';
import { MetadataService, StreamMetadata } from './services/metadataService';

type StreamStatus = 'idle' | 'connecting' | 'live' | 'error' | 'stalled';

const App: React.FC = () => {
  const [theme, setTheme] = useState<AppTheme>(AppTheme.BLACK_RED);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle');
  const [verseIndex, setVerseIndex] = useState(0);
  const [displayedVerse, setDisplayedVerse] = useState(VERSES[0]);
  const [isVerseFading, setIsVerseFading] = useState(false);
  const [showEq, setShowEq] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [showVisSettings, setShowVisSettings] = useState(false);
  const [showVerses, setShowVerses] = useState(false); 
  const [showToolbar, setShowToolbar] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showDonation, setShowDonation] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [visSettings, setVisSettings] = useState<VisualizerSettings>(DEFAULT_VISUALIZER_SETTINGS);
  const [timerEndTime, setTimerEndTime] = useState<number | null>(null);
  const [alarmTime, setAlarmTime] = useState<number | null>(null);
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [quality, setQuality] = useState('128');
  const [isDonationAnimating, setIsDonationAnimating] = useState(false);
  const [metadata, setMetadata] = useState<StreamMetadata>({ 
    artist: 'Mix Music', 
    song: 'Sintonizando...', 
    streamTitle: '', 
    albumCover: 'https://i.postimg.cc/RZB84W4v/LOGO-MIXMUSIC-STREAM-02.png' 
  });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const masterGainRef = useRef<GainNode | null>(null);
  const stallTimeoutRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const metadataServiceRef = useRef<MetadataService | null>(null);
  const reconnectCountRef = useRef(0);

  const currentTheme = THEMES[theme];
  const isLive = isPlaying && streamStatus === 'live';

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', currentTheme.primary);
    root.style.setProperty('--color-primary-rgb', hexToRgb(currentTheme.primary));
    root.style.setProperty('--color-secondary', currentTheme.secondary);
    root.style.setProperty('--color-bg', currentTheme.bg);

    if ((window as any).updateFaviconColor) {
      (window as any).updateFaviconColor(currentTheme.primary);
    }

    setIsThemeTransitioning(true);
    const timer = setTimeout(() => setIsThemeTransitioning(false), 600);
    return () => clearTimeout(timer);
  }, [theme]);

  function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '220, 38, 38';
  }

  const handleNextVerse = useCallback(() => {
    setIsVerseFading(true);
    setTimeout(() => {
      setVerseIndex((prev) => {
        const next = (prev + 1) % VERSES.length;
        setDisplayedVerse(VERSES[next]);
        return next;
      });
      setIsVerseFading(false);
    }, 800);
  }, []);

  useEffect(() => {
    const interval = setInterval(handleNextVerse, 30000);
    
    // Initialize Metadata Service
    metadataServiceRef.current = new MetadataService((data) => {
      setMetadata(data);
    });
    metadataServiceRef.current.connect(METADATA_URL);

    return () => {
      clearInterval(interval);
      if (metadataServiceRef.current) {
        metadataServiceRef.current.disconnect();
      }
    };
  }, [handleNextVerse]);

  const toggleWelcome = () => {
    setShowWelcome(!showWelcome);
    setShowEq(false);
    setShowTimer(false);
    setShowVisSettings(false);
    setShowShare(false);
    setShowDonation(false);
  };

  const handleShareClick = () => {
    if (isShareLoading) return;
    setIsShareLoading(true);
    
    // Subtle delay to simulate processing and provide visual feedback
    setTimeout(() => {
      setShowWelcome(false);
      setShowEq(false);
      setShowTimer(false);
      setShowVisSettings(false);
      setShowDonation(false);
      setShowShare(!showShare);
      setIsShareLoading(false);
    }, 800);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (timerEndTime && now >= timerEndTime) {
        if (isPlaying) handleStop();
        setTimerEndTime(null);
      }
      if (alarmTime && now >= alarmTime) {
        if (!isPlaying) togglePlay();
        setAlarmTime(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timerEndTime, alarmTime, isPlaying]);

  // Donation Button Animation Logic: 3s animation every 15s when live
  useEffect(() => {
    if (!isLive) {
      setIsDonationAnimating(false);
      return;
    }

    const triggerAnimation = () => {
      setIsDonationAnimating(true);
      setTimeout(() => setIsDonationAnimating(false), 3000);
    };

    // Initial trigger after 5 seconds of being live
    const initialTimer = setTimeout(triggerAnimation, 5000);

    const interval = setInterval(triggerAnimation, 18000); // 18s total cycle (3s anim + 15s rest)

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isLive]);

  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    const ctx = new AudioContextClass();
    const analyser = ctx.createAnalyser();
    const masterGain = ctx.createGain();
    
    analyser.fftSize = 1024; 
    analyser.smoothingTimeConstant = 0.8; 

    if (audioRef.current) {
      const source = ctx.createMediaElementSource(audioRef.current);
      const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
      let lastNode: AudioNode = source;
      const filters = frequencies.map((freq) => {
        const filter = ctx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.4;
        filter.gain.value = 0;
        lastNode.connect(filter);
        lastNode = filter;
        return filter;
      });
      lastNode.connect(masterGain);
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);
      masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      eqFiltersRef.current = filters;
      masterGainRef.current = masterGain;
    }
  }, []);

  const playPromiseRef = useRef<Promise<void> | null>(null);

  const handleStop = useCallback(async () => {
    if (stallTimeoutRef.current) {
      clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (!audioRef.current || !masterGainRef.current || !audioCtxRef.current) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      setIsPlaying(false);
      setStreamStatus('idle');
      return;
    }
    const ctx = audioCtxRef.current;
    masterGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
    masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, ctx.currentTime);
    masterGainRef.current.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    
    // Wait for any pending play to finish or fail before stopping
    if (playPromiseRef.current) {
      try { await playPromiseRef.current; } catch (e) { /* ignore */ }
    }

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ""; 
        setIsPlaying(false);
        setStreamStatus('idle');
        playPromiseRef.current = null;
      }
    }, 1250);
  }, []);

  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;
    
    // If already playing or play is pending, and we want to stop
    if (isPlaying) {
      return handleStop();
    }

    // If a play is already in progress, don't start another one
    if (playPromiseRef.current) return playPromiseRef.current;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setErrorCount(0);

    reconnectCountRef.current = 0;
    initAudio();
    if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume();
    setStreamStatus('connecting');
    
    if (masterGainRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const targetVol = Math.max(0.0001, volume);
      masterGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
      masterGainRef.current.gain.setValueAtTime(0.0001, ctx.currentTime);
      masterGainRef.current.gain.exponentialRampToValueAtTime(targetVol, ctx.currentTime + 2.0);
    }

    const finalUrl = quality === '128' ? STREAM_URL : `${STREAM_URL}?quality=${quality}`;
    
    // Only set src and load if it's different or empty
    if (audioRef.current.src !== finalUrl) {
      audioRef.current.src = finalUrl;
      audioRef.current.load();
    }

    const playPromise = audioRef.current.play();
    playPromiseRef.current = playPromise;

    return playPromise.then(() => {
      setIsPlaying(true);
      playPromiseRef.current = null;
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        setStreamStatus('error');
      }
      playPromiseRef.current = null;
      throw err;
    });
  }, [isPlaying, handleStop, initAudio, volume, quality]);

  const hasAttemptedAutoplay = useRef(false);

  // Autoplay on mount with interaction fallback
  useEffect(() => {
    if (hasAttemptedAutoplay.current) return;
    
    const attemptAutoplay = async () => {
      if (!isPlaying && !hasAttemptedAutoplay.current) {
        hasAttemptedAutoplay.current = true;
        try {
          await togglePlay();
          // Autoplay success - keep welcome hidden
        } catch (err) {
          console.warn("Autoplay blocked or failed:", err);
          // Show professional start prompt only if blocked
          setAutoplayBlocked(true);
          hasAttemptedAutoplay.current = false; 
        }
      }
    };

    const timer = setTimeout(attemptAutoplay, 300); 
    
    const handleInteraction = () => {
      if (!isPlaying && !hasAttemptedAutoplay.current) {
        attemptAutoplay();
      }
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [togglePlay, isPlaying]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.song || 'Mix Music Stream',
        artist: metadata.artist || 'Engenharia de Som Professional',
        album: 'Louvor e Adoração',
        artwork: [
          { src: 'https://i.postimg.cc/RZB84W4v/LOGO-MIXMUSIC-STREAM-02.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', handleStop);
      navigator.mediaSession.setActionHandler('stop', handleStop);
    }
  }, [isPlaying, streamStatus, handleStop, togglePlay, metadata]);

  useEffect(() => {
    const brand = UI_STRINGS.brand.main;
    let title = `${brand} | Web Rádio Professional`;
    let description = "Engenharia de som profissional e louvor de alta qualidade.";

    if (streamStatus === 'live') {
      const songInfo = metadata.song !== 'Sintonizando...' ? `${metadata.song} - ${metadata.artist}` : 'Louvor e Adoração';
      title = `🔴 NO AR: ${songInfo} | ${brand}`;
      description = `Ouvindo agora: ${songInfo} na ${brand}. Engenharia de som profissional.`;
    } else if (streamStatus === 'connecting') {
      title = `Sincronizando... | ${brand}`;
    } else if (streamStatus === 'stalled') {
      title = `Otimizando Buffer... | ${brand}`;
    } else if (streamStatus === 'error') {
      title = `Erro de Conexão | ${brand}`;
    }

    document.title = title;

    const updateMeta = (selector: string, attr: string, value: string) => {
      let element = document.querySelector(selector);
      if (!element && selector.startsWith('meta')) {
        element = document.createElement('meta');
        if (selector.includes('name=')) {
          const nameMatch = selector.match(/name="([^"]+)"/);
          if (nameMatch) element.setAttribute('name', nameMatch[1]);
        } else if (selector.includes('property=')) {
          const propMatch = selector.match(/property="([^"]+)"/);
          if (propMatch) element.setAttribute('property', propMatch[1]);
        }
        document.head.appendChild(element);
      }
      if (element) {
        element.setAttribute(attr, value);
      }
    };

    updateMeta('meta[name="description"]', 'content', description);
    updateMeta('meta[property="og:title"]', 'content', title);
    updateMeta('meta[property="og:description"]', 'content', description);
    updateMeta('meta[name="twitter:title"]', 'content', title);
    updateMeta('meta[name="twitter:description"]', 'content', description);
  }, [streamStatus, displayedVerse, metadata]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q && ['128', '64', '32'].includes(q)) {
      setQuality(q);
    }
  }, []);

  const handleStallRecovery = useCallback(() => {
    if (!isPlaying || !audioRef.current) return;
    
    setStreamStatus('stalled');
    
    if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    
    // If stalled for more than 5 seconds, attempt a silent reconnect with cache buster
    stallTimeoutRef.current = window.setTimeout(() => {
      if ((streamStatus === 'stalled' || audioRef.current?.paused) && isPlaying) {
        console.log("Stall detected, attempting silent recovery...");
        
        if (audioRef.current) {
          const finalUrl = quality === '128' ? STREAM_URL : `${STREAM_URL}?quality=${quality}`;
          const cacheBuster = `&cb=${Date.now()}`;
          audioRef.current.src = finalUrl.includes('?') ? `${finalUrl}${cacheBuster}` : `${finalUrl}?${cacheBuster.substring(1)}`;
          audioRef.current.load();
          audioRef.current.play().catch(e => {
            if (e.name !== 'AbortError') console.error("Recovery play failed", e);
          });
        }
      }
    }, 5000);
  }, [isPlaying, streamStatus, quality]);

  const handlePlaying = () => {
    setStreamStatus('live');
    setErrorCount(0);
    setShareFeedback(null);
    if (stallTimeoutRef.current) {
      clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const handleStreamError = useCallback(() => {
    if (!isPlaying || !audioRef.current) return;
    
    setStreamStatus('error');
    const nextErrorCount = errorCount + 1;
    setErrorCount(nextErrorCount);
    
    // Persistent retry strategy: max 10 attempts with exponential backoff, then slower retries
    const maxRetries = 10;
    const delay = nextErrorCount <= maxRetries 
      ? Math.min(30000, 1000 * Math.pow(1.5, nextErrorCount)) // Smoother exponential: 1.5s, 2.25s, 3.3s...
      : 60000; // After 10 attempts, try every minute
      
    const message = nextErrorCount <= maxRetries
      ? `CONEXÃO INSTÁVEL. RECONECTANDO EM ${Math.round(delay/1000)}s... (${nextErrorCount}/${maxRetries})`
      : "SINAL FRACO. TENTANDO RECONECTAR AUTOMATICAMENTE...";
      
    setShareFeedback(message);
    
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    
    reconnectTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying && audioRef.current) {
        console.log(`Attempting reconnection ${nextErrorCount} after ${delay}ms...`);
        const finalUrl = quality === '128' ? STREAM_URL : `${STREAM_URL}?quality=${quality}`;
        
        // Force a fresh connection by appending a timestamp to bypass cache if needed
        const cacheBuster = `&cb=${Date.now()}`;
        audioRef.current.src = finalUrl.includes('?') ? `${finalUrl}${cacheBuster}` : `${finalUrl}?${cacheBuster.substring(1)}`;
        
        audioRef.current.load();
        audioRef.current.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Retry play failed", e);
          }
        });
      }
    }, delay);
  }, [isPlaying, errorCount, quality]);

  // Network Status Listeners
  useEffect(() => {
    const handleOnline = () => {
      if (isPlaying && (streamStatus === 'error' || streamStatus === 'stalled')) {
        setShareFeedback("INTERNET RESTAURADA. SINCRONIZANDO...");
        setErrorCount(0);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        
        if (audioRef.current) {
          const finalUrl = quality === '128' ? STREAM_URL : `${STREAM_URL}?quality=${quality}`;
          audioRef.current.src = finalUrl;
          audioRef.current.load();
          audioRef.current.play().catch(() => {});
        }
      }
    };

    const handleOffline = () => {
      if (isPlaying) {
        setStreamStatus('error');
        setShareFeedback("SEM CONEXÃO COM A INTERNET.");
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isPlaying, streamStatus, quality]);

  const handleVolumeChange = useCallback((newVol: number) => {
    setVolume(newVol);
    if (masterGainRef.current && audioCtxRef.current) {
      // Use setTargetAtTime for smooth volume changes
      masterGainRef.current.gain.setTargetAtTime(newVol, audioCtxRef.current.currentTime, 0.05);
    }
    
    // Always update the audio element volume as a fallback or secondary control
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  }, []);

  const handleEqChange = (index: number, gain: number, freq?: number, q?: number) => {
    const filter = eqFiltersRef.current[index];
    if (filter && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      if (gain !== undefined) filter.gain.setTargetAtTime(gain, ctx.currentTime, 0.1);
      if (freq !== undefined) filter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.1);
      if (q !== undefined) filter.Q.setTargetAtTime(q, ctx.currentTime, 0.1);
    }
  };

  const handleApplyEqPreset = (gains: number[]) => {
    gains.forEach((gain, i) => handleEqChange(i, gain));
  };

  const handleEnterApp = useCallback(() => {
    setAutoplayBlocked(false);
    setShowWelcome(false);
    if (!isPlaying) {
      togglePlay();
    }
  }, [isPlaying, togglePlay]);

  return (
    <div className={`h-screen w-full flex overflow-hidden theme-aware gpu-accelerated ${isThemeTransitioning ? 'theme-transition-active' : ''}`}>
      <Sidebar theme={currentTheme} side="left" />
      
      <main className={`flex-1 flex flex-col items-center relative bg-gradient-to-br ${currentTheme.gradient} px-4 md:px-8 overflow-hidden theme-aware`}>
        {/* Personalized "Push Style" Toast Notification */}
        <div className={`fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[150] transition-all duration-700 transform ${shareFeedback ? 'translate-y-0 opacity-100' : '-translate-y-32 opacity-0 pointer-events-none'}`}>
           <div className="min-w-[280px] md:min-w-[320px] px-4 md:px-5 py-3 md:py-4 rounded-2xl md:rounded-[2rem] bg-black/90 border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] flex items-center gap-3 md:gap-4 backdrop-blur-2xl">
              <div className="relative flex-shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center overflow-hidden shadow-lg">
                 <img 
                    src="https://i.postimg.cc/RZB84W4v/LOGO-MIXMUSIC-STREAM-02.png" 
                    alt="App Logo" 
                    className="w-[85%] h-[85%] object-contain drop-shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.5)]"
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[8px] md:text-[10px] font-black tracking-[0.2em] text-white/40 uppercase">MIX MUSIC</span>
                  <div className="w-1 h-1 rounded-full bg-white/10" />
                  <span className="text-[7px] md:text-[9px] font-medium text-white/20 uppercase tracking-widest">Agora</span>
                </div>
                <span className="text-[10px] md:text-sm font-bold text-white tracking-tight leading-tight">{shareFeedback}</span>
              </div>
              <div className="ml-auto pl-2">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-primary)' }} />
              </div>
           </div>
        </div>

        {/* Tutorial & Notifications - Top Left Edge */}
        <div className="fixed top-2 left-4 z-[110] flex items-center animate-title-reveal" style={{ animationDelay: '500ms' }}>
          <div className="toolbar-glass backdrop-blur-[32px] flex items-center gap-1 md:gap-2 px-1.5 md:px-2 py-1 md:py-1.5 rounded-xl md:rounded-2xl shadow-xl border border-white/5">
            <HeaderButton 
              active={showDonation} 
              animate={isDonationAnimating}
              onClick={() => { setShowWelcome(false); setShowEq(false); setShowTimer(false); setShowVisSettings(false); setShowShare(false); setShowTutorial(false); setShowDonation(!showDonation); }} 
              theme={currentTheme} 
              icon={<HeartIcon />} 
              label="Apoiar" 
            />
            <div className="w-[1px] h-4 bg-white/5 mx-0.5" />
            <HeaderButton 
              active={showTutorial} 
              onClick={() => { setShowWelcome(false); setShowEq(false); setShowTimer(false); setShowVisSettings(false); setShowShare(false); setShowDonation(false); setShowTutorial(true); }} 
              theme={currentTheme} 
              icon={<HelpCircleIcon />} 
              label="Tutorial" 
            />
          </div>
        </div>

        {/* Professional Master Console Controller - Top Right Edge & Always Accessible */}
        <div className={`fixed top-2 right-4 z-[110] transition-all duration-700 opacity-100`}>
          <button 
            onClick={() => setShowToolbar(!showToolbar)}
            className={`
              w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center 
              glass-panel transition-all duration-700 transform 
              hover:scale-110 active:scale-90 group/master 
              ${showToolbar ? 'shadow-[0_0_20px_-5px_rgba(var(--color-primary-rgb),0.4)] border-white/20' : 'opacity-60 hover:opacity-100 border-white/5'}
            `}
            style={showToolbar ? { borderColor: 'rgba(var(--color-primary-rgb),0.4)', color: 'var(--color-primary)' } : { color: 'rgba(255,255,255,0.4)' }}
          >
             <div className={`transition-all duration-700 ${showToolbar ? 'rotate-180 scale-90' : 'rotate-0 scale-105'}`}>
                {showToolbar ? (
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-white/60 group-hover/master:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 15l-6-6-6 6"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
                  </svg>
                )}
             </div>
             {!showToolbar && (
               <div className="absolute inset-0 rounded-xl md:rounded-2xl border border-white/20 animate-ping opacity-10 pointer-events-none" />
             )}
          </button>
        </div>

        {/* Vertical Studio Toolbar - Left Edge Floating */}
        <div className={`fixed top-1/2 -translate-y-1/2 left-0 z-[100] transition-all duration-1000 transform flex flex-col items-center ${showToolbar && isLive ? 'translate-x-0 opacity-100 scale-100' : '-translate-x-24 opacity-0 scale-90 pointer-events-none'}`}>
          <div className="flex flex-col items-center gap-1.5 md:gap-3 px-1 md:px-1.5 py-4 md:py-8 rounded-r-3xl md:rounded-r-[2.5rem] bg-white/[0.005] border-y border-r border-white/[0.02] shadow-2xl backdrop-blur-3xl relative overflow-hidden group/toolbar">
             {/* Dynamic background shimmer & Gradient */}
             <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.005] to-transparent bg-[length:100%_200%] animate-[toolbar-shimmer_4s_infinite_linear] pointer-events-none" />
             
             {/* Subtle Glow Effect */}
             <div className="absolute -inset-1 bg-white/[0.002] blur-xl rounded-full pointer-events-none" />
             
             <div className="flex flex-col items-center scale-75 md:scale-85 mb-1">
                <ThemeSwitcher current={theme} onSelect={setTheme} theme={currentTheme} />
              </div>
              <div className="w-4 md:w-6 h-[1px] bg-white/[0.05] my-1 md:my-1.5" />
              
              <div className="flex flex-col items-center gap-1.5 md:gap-3">
                <HeaderButton 
                  active={showShare} 
                  loading={isShareLoading}
                  onClick={handleShareClick} 
                  theme={currentTheme} 
                  icon={<AntennaIcon />} 
                  label={isShareLoading ? "Processando..." : "Transmitir"} 
                />
                <HeaderButton active={showVerses && isLive} disabled={!isLive} onClick={() => isLive && setShowVerses(!showVerses)} theme={currentTheme} icon={<HolyBibleIcon />} label="Escrituras" />
                
                <div className="w-3 md:w-5 h-[1px] bg-white/[0.03] my-0.5" />
                
                <HeaderButton active={showVisSettings} onClick={() => { setShowWelcome(false); setShowEq(false); setShowTimer(false); setShowShare(false); setShowDonation(false); setShowVisSettings(!showVisSettings); }} theme={currentTheme} icon={<StudioSpectrumIcon />} label="Espectro" />
                <HeaderButton active={showTimer} onClick={() => { setShowWelcome(false); setShowEq(false); setShowVisSettings(false); setShowShare(false); setShowDonation(false); setShowTimer(!showTimer); }} theme={currentTheme} icon={<AutomationTimerIcon />} label="Automação" />
                <HeaderButton active={showEq} onClick={() => { setShowWelcome(false); setShowTimer(false); setShowVisSettings(false); setShowShare(false); setShowDonation(false); setShowEq(!showEq); }} theme={currentTheme} icon={<StudioFadersIcon />} label="Equalizador" />
                
                <div className="w-4 md:w-6 h-[1px] bg-white/[0.05] my-1 md:my-1.5" />
                
                <HeaderButton active={showWelcome} onClick={toggleWelcome} theme={currentTheme} icon={<StudioHubIcon />} label="Mix Music" isSpecial />
              </div>
          </div>
        </div>

        {/* Central Core: Studio Integration & Spatial Organization */}
        <div className="w-full max-w-6xl flex-1 flex flex-col items-center justify-center gap-4 md:gap-8 relative z-10 py-4 md:py-10 min-h-0">
          {/* Logo Section */}
          <div className="relative animate-title-reveal flex flex-col items-center group/logo w-full max-w-[380px] sm:max-w-[460px] md:max-w-5xl lg:max-w-6xl flex-shrink-1 min-h-0 pt-4 md:pt-6">
            <div className={`absolute w-[160%] h-[160%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-[3000ms] blur-[140px] pointer-events-none ${isLive ? 'opacity-40' : 'opacity-0'}`} style={{ backgroundColor: 'var(--color-primary)' }} />
            <img 
               src="https://i.postimg.cc/RZB84W4v/LOGO-MIXMUSIC-STREAM-02.png" 
               alt="Mix Music Stream" 
               className={`w-full h-auto max-h-[40vh] md:max-h-[55vh] lg:max-h-[60vh] object-contain transition-all duration-[1200ms] ease-out relative z-10 ${!isPlaying ? 'opacity-[0.12] grayscale brightness-[0.4] scale-95' : 'opacity-100 scale-100 brightness-100'}`}
            />
          </div>

          {/* Information Block: Status + Title */}
          <div className="flex flex-col items-center gap-4 md:gap-6 w-full flex-shrink-0">
            <div className={`flex items-center gap-3 transition-all duration-700 ${isLive ? 'opacity-60 translate-y-0' : 'opacity-0 translate-y-2'}`}>
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white/60 animate-pulse" />
              <span className="text-[8px] md:text-[10px] font-black tracking-[1em] md:tracking-[1.2em] text-white/50 uppercase select-none font-mono">LIVE MASTER TRANSMITTER</span>
            </div>

            <div className="text-center animate-title-reveal flex-shrink-0" style={{ animationDelay: '150ms' }}>
              <h2 className="flex flex-col items-center uppercase select-none">
                <span className={`block font-black text-[10px] md:text-[16px] tracking-[1.3em] md:tracking-[1.6em] mb-2 md:mb-5 transition-all duration-1000 ${isLive ? 'opacity-80' : 'opacity-10'}`} style={{ color: isLive ? '#fff' : '#444' }}>LOUVOR E</span>
                <span className={`block font-black text-3xl sm:text-4xl md:text-8xl lg:text-9xl tracking-tightest leading-none transition-all duration-1000 ${isLive ? 'opacity-100 scale-100' : 'opacity-20 scale-95'}`} style={{ 
                  backgroundImage: isLive ? `linear-gradient(180deg, #fff 30%, var(--color-primary) 180%)` : `linear-gradient(180deg, #666 0%, #333 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>ADORAÇÃO</span>
              </h2>
            </div>
          </div>

          {/* Verse Section */}
          <div className={`w-full max-w-xl px-6 transition-all duration-[1200ms] flex flex-col items-center justify-center flex-shrink-0 ${ (showVerses && isLive) ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-8 scale-95 pointer-events-none h-0 overflow-hidden' }`}>
            <div className="relative group/verse-container flex flex-col items-center w-full">
              {/* Animated Icon for Verses - Aligned with top border */}
              <div className="mb-[-12px] md:mb-[-16px] relative z-20">
                 <div className="absolute inset-0 bg-white/5 blur-md rounded-full animate-pulse scale-100" />
                 <div className="relative w-6 h-6 md:w-8 md:h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center backdrop-blur-xl shadow-lg">
                    <svg className="w-3 h-3 md:w-4 md:h-4 text-white/20 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                 </div>
              </div>

              <div className="glass-panel w-full px-4 md:px-6 py-3 md:py-4 rounded-[1rem] md:rounded-[1.5rem] border border-white/[0.01] bg-black/5 backdrop-blur-[40px] shadow-[0_10px_20px_-5px_rgba(0,0,0,0.3)] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.002] to-transparent pointer-events-none" />
                <p className={`text-[9px] sm:text-xs md:text-base lg:text-lg font-bold italic transition-all duration-1000 text-center tracking-tight leading-relaxed md:leading-snug ${isVerseFading ? 'opacity-0 blur-md scale-95' : 'opacity-60 blur-0 scale-100'}`} style={{ color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,0.2)' }}>
                  "{displayedVerse}"
                </p>
                <div className="mt-2 md:mt-3 flex items-center justify-center gap-2 opacity-5">
                  <div className="h-[1px] w-4 md:w-8 bg-white" />
                  <span className="text-[5px] md:text-[7px] font-black tracking-[0.3em] uppercase">Palavra de Vida</span>
                  <div className="h-[1px] w-4 md:w-8 bg-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Section: Artist & Song */}
          <div className={`w-full max-w-xl px-6 transition-all duration-[1200ms] flex flex-col items-center justify-center flex-shrink-0 mb-[-2.5rem] md:mb-[-4.5rem] ${ isLive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none h-0 overflow-hidden' }`} 
               style={{ marginTop: (showVerses && isLive) ? '0.5rem' : '0' }}>
            <div className="relative group/metadata-container flex flex-col items-center w-full">
                <div className="glass-panel w-full px-4 py-3 rounded-xl md:rounded-2xl border border-white/[0.03] bg-white/[0.01] backdrop-blur-3xl shadow-2xl flex items-center gap-4 relative overflow-hidden">
                   {/* Subtle Shimmer */}
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full animate-shimmer pointer-events-none" />
                   
                   {/* Album Cover */}
                   <div className="relative flex-shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-lg md:rounded-xl overflow-hidden border border-white/10 shadow-lg z-10">
                      <img 
                        id="albumCover"
                        src={metadata.albumCover || 'https://i.postimg.cc/RZB84W4v/LOGO-MIXMUSIC-STREAM-02.png'} 
                        alt="Album Cover" 
                        className="w-full h-full object-cover transition-all duration-700"
                        referrerPolicy="no-referrer"
                      />
                   </div>

                   <div className="flex flex-col flex-1 min-w-0 relative z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1 h-1 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
                        <span className="text-[6px] md:text-[8px] font-black tracking-[0.3em] text-white/20 uppercase">Sintonizado Agora</span>
                      </div>
                      
                      <div className="flex flex-col">
                        <span className="text-[11px] md:text-base font-black text-white tracking-tightest uppercase truncate drop-shadow-sm">
                          {metadata.song}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[8px] md:text-[11px] font-bold text-white/40 tracking-[0.2em] uppercase truncate">
                            {metadata.artist}
                          </span>
                        </div>
                      </div>
                   </div>
                </div>
            </div>
          </div>

          {/* Player Section */}
          <div className="w-full scale-90 md:scale-100 transform origin-bottom transition-transform duration-1000 flex-shrink-0">
            <Player isPlaying={isPlaying} onToggle={togglePlay} volume={volume} onVolumeChange={handleVolumeChange} theme={currentTheme} analyser={analyserRef.current} streamStatus={streamStatus} quality={quality} />
          </div>
        </div>

        <footer className="fixed bottom-6 md:bottom-8 w-full text-center z-10 px-4 md:px-8">
          <p className="text-[6px] md:text-[8px] font-black tracking-[1em] md:tracking-[1.4em] text-white/5 uppercase select-none border-t border-white/[0.02] pt-2 md:pt-3 inline-block">
            MIX MUSIC STUDIO CORE v2.5 © 2026
          </p>
        </footer>

        {/* Professional Dev Signature Bar - Ultra Thin & Translucent */}
        <div className="fixed bottom-0 left-0 right-0 z-[120] h-3 md:h-5 flex items-center justify-center bg-white/[0.005] border-t border-white/[0.02] backdrop-blur-3xl overflow-hidden group/dev-footer">
          {/* Dynamic background shimmer & Gradient - Matching Toolbar */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.005] to-transparent bg-[length:100%_200%] animate-[toolbar-shimmer_4s_infinite_linear] pointer-events-none" />
          
          <div className="relative z-10 flex items-center gap-2 md:gap-4">
            <div className="w-1 md:w-1.5 h-[1px] bg-white/10" />
            <p className="text-[5px] md:text-[7px] font-black tracking-[0.4em] md:tracking-[0.6em] text-white/15 uppercase select-none transition-all duration-700 group-hover/dev-footer:text-white/40 group-hover/dev-footer:tracking-[0.8em]">
              Dev: Cristiano
            </p>
            <div className="w-1 md:w-1.5 h-[1px] bg-white/10" />
          </div>
        </div>

        <div className="fixed inset-0 pointer-events-none z-0">
          {visSettings.enabled && <Visualizer analyser={analyserRef.current} theme={currentTheme} isPlaying={isPlaying && streamStatus === 'live'} settings={visSettings} />}
        </div>

        {showTutorial && <TutorialOverlay theme={currentTheme} onClose={() => setShowTutorial(false)} />}

        {(showEq || showTimer || showVisSettings || showWelcome || showShare || showDonation || autoplayBlocked) && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-2xl transition-opacity duration-700" onClick={() => { setShowEq(false); setShowTimer(false); setShowVisSettings(false); setShowWelcome(false); setShowShare(false); setShowDonation(false); setAutoplayBlocked(false); }} />
            <div className="relative z-10 w-full max-w-3xl flex items-center justify-center pointer-events-none max-h-full overflow-y-auto no-scrollbar py-6 md:py-10">
              <div className="pointer-events-auto w-full flex justify-center">
                {showEq && (
                  <EqualizerPanel 
                    theme={currentTheme} 
                    onClose={() => setShowEq(false)} 
                    onEqChange={handleEqChange} 
                    onApplyEqPreset={handleApplyEqPreset} 
                    getFilters={() => eqFiltersRef.current.map(f => ({
                      gain: f.gain.value,
                      frequency: f.frequency.value,
                      q: f.Q.value
                    }))} 
                    analyser={analyserRef.current} 
                  />
                )}
                {showTimer && <TimerPanel theme={currentTheme} onClose={() => setShowTimer(false)} activeTimerEndTime={timerEndTime} activeAlarmTime={alarmTime} onSetTimer={(min) => setTimerEndTime(min ? Date.now() + min * 60000 : null)} onSetAlarm={(ts) => setAlarmTime(ts)} />}
                {showVisSettings && <VisualizerPanel theme={currentTheme} settings={visSettings} onChange={setVisSettings} onClose={() => setShowVisSettings(false)} />}
                {(showWelcome || autoplayBlocked) && <WelcomePanel theme={currentTheme} onClose={handleEnterApp} />}
                {showShare && <SharePanel theme={currentTheme} metadata={metadata} onClose={() => setShowShare(false)} onCopySuccess={() => { setShareFeedback("LINK DE CONVITE COPIADO"); setTimeout(() => setShareFeedback(null), 3000); }} />}
                {showDonation && <DonationPanel theme={currentTheme} onClose={() => setShowDonation(false)} />}
              </div>
            </div>
          </div>
        )}
      </main>

      <Sidebar theme={currentTheme} side="right" />
      
      <audio 
        ref={audioRef} 
        crossOrigin="anonymous" 
        preload="auto"
        onPlaying={handlePlaying} 
        onWaiting={handleStallRecovery} 
        onStalled={handleStallRecovery} 
        onCanPlay={() => { if(isPlaying && audioRef.current?.paused) audioRef.current?.play().catch(() => {}) }} 
        onError={handleStreamError} 
        onEnded={() => setStreamStatus('idle')} 
        onPause={() => { if(!isPlaying) setStreamStatus('idle') }} 
      />
    </div>
  );
};

const HeaderButton = ({ active, onClick, icon, disabled, isSpecial, label, loading, animate }: any) => (
  <div className="relative group flex items-center">
    {/* Visual Status Indicator - Vertical Right */}
    <div className={`mr-1.5 w-[2px] rounded-full transition-all duration-700 ease-[cubic-bezier(0.2,0,0,1)] ${active && !loading ? 'h-5 opacity-100' : 'h-0 opacity-0 group-hover:h-2 group-hover:opacity-40'}`} 
         style={{ backgroundColor: 'var(--color-primary)', boxShadow: active && !loading ? `0 0 8px var(--color-primary)` : 'none' }} />

    {/* Refined Tooltip - Positioned Right */}
    <div className="absolute left-[calc(100%+12px)] opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none scale-90 group-hover:scale-100 z-[120] hidden md:block">
      <div className="flex items-center">
        <div className="w-1.5 h-1.5 bg-black/95 border-l border-b border-white/10 rotate-45 -mr-1 z-10" />
        <div className="px-2.5 py-1.5 rounded-lg bg-black/95 border border-white/10 backdrop-blur-3xl shadow-2xl">
          <span className="text-[8px] font-bold tracking-widest text-white/90 uppercase whitespace-nowrap">{label}</span>
        </div>
      </div>
    </div>

    <div className="relative flex items-center justify-center">
      {/* Corpo Pulsante Sincronizado */}
      {animate && (
        <div 
          className="absolute inset-0 rounded-lg md:rounded-xl animate-donation-body pointer-events-none" 
          style={{ backgroundColor: 'rgba(var(--color-primary-rgb), 0.15)' }} 
        />
      )}
      
      <button 
        onClick={onClick} 
        disabled={disabled || loading} 
        className={`
          relative w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center border-0 overflow-hidden transform transition-all duration-700
          ${ (disabled || loading) ? 'opacity-20 cursor-not-allowed scale-90' : active ? 'bg-white/10 scale-105 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)]' : 'bg-transparent hover:bg-white/5 active:scale-95' }
          ${ animate ? 'animate-donation-pulse' : '' }
        `} 
        style={!disabled && !loading && active ? { color: 'var(--color-primary)' } : { color: 'rgba(255,255,255,0.35)' }}
      >
      {/* Dynamic Glow for Active State */}
      {active && !loading && (
        <div 
          className="absolute inset-0 rounded-full blur-xl opacity-15 animate-pulse"
          style={{ backgroundColor: 'var(--color-primary)' }}
        />
      )}
      
      <div className="absolute inset-0 bg-white/[0.01] opacity-0 group-hover:opacity-100 transition-opacity" />

      {loading ? (
        <div className="relative z-10 w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      ) : (
        <div className={`relative z-10 transition-all duration-500 transform ${active ? 'scale-105' : 'group-hover:scale-105 group-hover:text-white'}`}>
          {React.cloneElement(icon as React.ReactElement, { className: 'w-3.5 h-3.5 md:w-4.5 md:h-4.5' })}
        </div>
      )}

      {isSpecial && (
        <div className={`absolute inset-0 bg-gradient-to-tr from-primary/5 via-white/5 to-transparent pointer-events-none ${active ? 'opacity-100' : 'opacity-15'}`} />
      )}
    </button>
  </div>
</div>
);

/* 
  PROFESSIONAL STUDIO ICONS REDESIGN
  Intuitive, bold, and high-visibility
*/

const AntennaIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20v-8M9 15l3-3 3 3M12 12l8-8M12 12L4 4" strokeOpacity="0.4" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.48m3.54-12.02a11 11 0 0 1 0 15.56" />
    <path d="M7.76 16.24a6 6 0 0 1 0-8.48M4.22 19.78a11 11 0 0 1 0-15.56" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const HolyBibleIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M10 8h4M12 6v7" strokeWidth="2" strokeOpacity="0.5" />
  </svg>
);

const StudioSpectrumIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17v-3M7 17V7M11 17V11M15 17V4M19 17v-7M21 17h-18" />
  </svg>
);

const AutomationTimerIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
    <path d="M12 6v6l4 2" />
    <path d="M16 21.12c-1.23.57-2.58.88-4 .88a10 10 0 0 1-10-10c0-1.42.31-2.77.88-4" />
  </svg>
);

const StudioFadersIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" strokeOpacity="0.3" />
    <rect x="2" y="10" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="10" y="8" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="18" y="12" width="4" height="4" rx="1" fill="currentColor" />
  </svg>
);

const StudioHubIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10l9-7z" strokeOpacity="0.2" />
    <path d="M9 21V9l3-2 3 2v12" />
    <circle cx="12" cy="14" r="3" fill="currentColor" className="animate-pulse" />
  </svg>
);

const HelpCircleIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export default App;
