import React, { useState } from 'react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Maximize2, Smartphone, WifiOff } from 'lucide-react';
import { soundEngine } from '../services/audio';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleAndroidFullscreenLandscape = async () => {
    soundEngine.playClick();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        const scr = window.screen as Screen & {
          orientation?: { lock?: (mode: string) => Promise<void> };
        };
        if (scr.orientation && typeof scr.orientation.lock === 'function') {
          await scr.orientation.lock('landscape').catch(() => {});
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fallback if running inside restricted iframe
    }
  };

  return (
    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
      {/* Android 15 Fullscreen & Landscape Lock Button */}
      <button
        onClick={toggleAndroidFullscreenLandscape}
        title="Fullscreen Landscape Mode"
        className="w-8 h-8 sm:w-auto sm:h-9 sm:px-2.5 rounded-lg bg-slate-800/90 border border-white/15 hover:border-[#00E5FF] text-xs font-semibold text-[#00E5FF] flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
      >
        <Maximize2 className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden lg:inline">
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </span>
      </button>

      {/* Direct Chromium / Android 15 Install Prompt Button */}
      {!isInstalled && isInstallable && (
        <button
          onClick={() => {
            soundEngine.playClick();
            install();
          }}
          className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg bg-[#00E5FF] hover:bg-cyan-300 text-slate-950 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Install</span>
        </button>
      )}

      {/* Android 15 & GitHub Export Guide Trigger */}
      {!isInstalled && !isInstallable && (
        <button
          onClick={() => {
            soundEngine.playClick();
            setShowGuideModal(true);
          }}
          title="Phone & GitHub Guide"
          className="w-8 h-8 sm:w-auto sm:h-9 sm:px-2.5 rounded-lg bg-slate-800/90 border border-[#FF6B1A]/60 hover:border-[#FF6B1A] text-xs font-semibold text-[#FDE047] flex items-center justify-center gap-1 cursor-pointer shrink-0"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{isIOS ? 'iOS' : 'Guide'}</span>
        </button>
      )}

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 pointer-events-auto">
          <div className="w-full max-w-md rounded-2xl bg-[#0F172A] border-2 border-[#FF6B1A] p-5 text-left space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display text-base font-bold text-white">
                Play on Android 15 via GitHub Export
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-2.5 py-1 rounded bg-slate-800 text-xs font-bold text-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-900 border border-white/10 rounded-xl p-3">
                <div className="font-bold text-[#FDE047] mb-1">
                  Step 1: Enable GitHub Pages After Exporting
                </div>
                <p>
                  1. Export this project to your GitHub account.<br />
                  2. Open your repository on <strong>GitHub.com</strong> in
                  Android Chrome.<br />
                  3. Tap <strong>Settings → Pages</strong> and set{' '}
                  <strong>Source</strong> to <strong>GitHub Actions</strong>.<br />
                  4. In ~60 seconds, your live game link (
                  <code>https://&lt;username&gt;.github.io/&lt;repo&gt;/</code>)
                  is ready to play!
                </p>
              </div>

              <div className="bg-slate-900 border border-white/10 rounded-xl p-3">
                <div className="font-bold text-[#00E5FF] mb-1">
                  Step 2: Install to Android 15 Home Screen
                </div>
                <p>
                  1. Open your GitHub Pages game link in{' '}
                  <strong>Chrome on Android 15</strong>.<br />
                  2. Tap the <strong>Install App</strong> button in the top bar
                  (or tap Chrome&apos;s <strong>⋮ menu → Add to Home screen</strong>
                  ).<br />
                  3. Launch <strong>ClassicDrop</strong> from your home screen
                  for fullscreen landscape play and offline mode!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#FF6B1A] text-white font-bold text-xs cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-3 left-3 z-50 flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-lg pointer-events-none">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — Playing from cached local data</span>
    </div>
  );
};
