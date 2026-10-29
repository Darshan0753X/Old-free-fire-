import React, { useRef, useState } from 'react';
import {
  AIDifficulty,
  CrosshairStyle,
  EQUIPMENT_CATALOG,
  GameMode,
  GameSettings,
  GraphicsPreset,
  LobbyScreen,
  OUTFIT_CATALOG,
  SaveDataSchema,
  SUNSET_ISLAND_REGIONS,
} from '../types/game';
import { cloneDefaultHUDLayout } from '../services/storage';
import { soundEngine } from '../services/audio';
import {
  Award,
  Clock,
  Compass,
  Crosshair,
  History,
  Move,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Shirt,
  Sliders,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { NostalgiaLobbyBackdrop } from './NostalgiaLobbyBackdrop';
import { AnimatePresence, motion } from 'motion/react';

interface MainMenuLobbyProps {
  saveData: SaveDataSchema;
  selectedMode: GameMode;
  activeScreen: LobbyScreen;
  fps: number;
  onSelectMode: (mode: GameMode) => void;
  onSelectScreen: (screen: LobbyScreen) => void;
  onStartMatch: () => void;
  onRotateCharacter: (deltaYaw: number) => void;
  onUpdateSaveData: (updater: (prev: SaveDataSchema) => SaveDataSchema) => void;
  onUpdateSettings: (nextSettings: GameSettings) => void;
  onResetAllData: () => void;
  onOpenHudEditor: () => void;
}

export const MainMenuLobby: React.FC<MainMenuLobbyProps> = ({
  saveData,
  selectedMode,
  activeScreen,
  fps,
  onSelectMode,
  onSelectScreen,
  onStartMatch,
  onRotateCharacter,
  onUpdateSaveData,
  onUpdateSettings,
  onResetAllData,
  onOpenHudEditor,
}) => {
  const dragXRef = useRef<number | null>(null);
  const [settingsTab, setSettingsTab] = useState<
    'controls' | 'aim' | 'combat' | 'graphics' | 'audio'
  >('controls');

  const xpIntoLevel = saveData.xp % 300;
  const xpPercent = Math.min(100, Math.round((xpIntoLevel / 300) * 100));

  const frameBorderColor =
    saveData.selectedProfileFrame === 'neon_cyan'
      ? 'border-[#00E5FF]'
      : saveData.selectedProfileFrame === 'sunset_flame'
      ? 'border-[#FF6B1A]'
      : 'border-[#F59E0B]';

  const handleTurntablePointerDown = (e: React.PointerEvent) => {
    dragXRef.current = e.clientX;
  };

  const handleTurntablePointerMove = (e: React.PointerEvent) => {
    if (dragXRef.current === null) return;
    const dx = e.clientX - dragXRef.current;
    dragXRef.current = e.clientX;
    onRotateCharacter(dx * 0.012);
  };

  const handleTurntablePointerUp = () => {
    dragXRef.current = null;
  };

  const unlockedAchievementsCount = saveData.achievements.filter(
    (a) => a.unlocked
  ).length;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between safe-viewport-pad w-full h-full max-w-full max-h-full overflow-hidden gap-1.5 sm:gap-2">
      {/* Procedural Golden-Hour Nostalgia Backdrop (low-overhead 2D Canvas + CSS transitions) */}
      <NostalgiaLobbyBackdrop preset={saveData.settings.graphicsPreset} />

      {/* TOP BAR CONTRACT: Brand Emblem — Navigation Links — Profile & Settings */}
      <motion.header
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto flex items-center justify-between gap-1.5 sm:gap-3 bg-[#0B1320]/90 border border-white/15 rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2 shrink-0 w-full min-w-0"
      >
        {/* Zone 1: Original Classic Drop Logo Lockup */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            soundEngine.playClick();
            onSelectScreen('main');
          }}
          className="flex items-center gap-1.5 sm:gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer min-w-0"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0 sm:w-[34px] sm:h-[34px]"
          >
            <rect
              x="2"
              y="2"
              width="32"
              height="32"
              rx="8"
              fill="#FF6B1A"
              stroke="#FEF08A"
              strokeWidth="2"
            />
            <path
              d="M9 14C9 9.5 13 7 18 7C23 7 27 9.5 27 14L22 22H14L9 14Z"
              fill="#0B1320"
            />
            <path
              d="M15 22L18 29L21 22"
              stroke="#00E5FF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="min-w-0">
            <span className="font-display text-sm sm:text-xl font-bold tracking-wider text-white block leading-none truncate">
              CLASSIC DROP
            </span>
            <span className="text-[8px] sm:text-[10px] font-semibold text-[#FDE047] tracking-widest block mt-0.5 truncate">
              V2 NOSTALGIA
            </span>
          </div>
        </motion.button>

        {/* Zone 2: Clean Single-Line Navigation Tabs (Desktop/Tablet) */}
        <nav className="hidden md:flex items-center gap-1.5 min-w-0 overflow-x-auto">
          {(
            [
              { id: 'main', label: 'Lobby', icon: Compass },
              { id: 'character', label: 'Outfits', icon: Shirt },
              { id: 'collection', label: 'Gear & Poses', icon: Sliders },
              {
                id: 'achievements',
                label: `Achievements (${unlockedAchievementsCount}/8)`,
                icon: Award,
              },
              { id: 'history', label: 'Match History', icon: History },
            ] as const
          ).map((tab, idx) => {
            const Icon = tab.icon;
            const active = activeScreen === tab.id;
            return (
              <motion.button
                key={tab.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.05 + idx * 0.04 }}
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  soundEngine.playClick();
                  onSelectScreen(tab.id);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#FF6B1A] text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </motion.button>
            );
          })}
        </nav>

        {/* Zone 3: Player Profile Card, PWA Install / Fullscreen & Settings Trigger */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <PWAInstallButton />

          <div
            onClick={() => {
              soundEngine.playClick();
              onSelectScreen('achievements');
            }}
            className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 border border-white/10 rounded-lg px-1.5 py-1 sm:px-2.5 sm:py-1.5 cursor-pointer hover:border-white/25 shrink-0"
          >
            <div
              className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md bg-slate-800 border-2 ${frameBorderColor} flex items-center justify-center font-display font-bold text-[10px] sm:text-xs text-[#FDE047]`}
            >
              LV.{saveData.level}
            </div>
            <div className="hidden lg:block">
              <div className="text-xs font-bold text-white leading-tight">
                {saveData.playerName}
              </div>
              <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[#00E5FF]"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>
          </div>

          {saveData.settings.showFps && (
            <span className="hidden xl:inline-block font-mono-num text-xs text-emerald-400">
              {fps} FPS
            </span>
          )}

          <button
            onClick={() => {
              soundEngine.playClick();
              onUpdateSettings({
                ...saveData.settings,
                muted: !saveData.settings.muted,
              });
            }}
            aria-label="Toggle Mute"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800/90 border border-white/15 flex items-center justify-center text-slate-200 hover:text-white cursor-pointer shrink-0"
          >
            {saveData.settings.muted ? (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00E5FF]" />
            )}
          </button>

          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              soundEngine.playClick();
              onSelectScreen(activeScreen === 'settings' ? 'main' : 'settings');
            }}
            aria-label="Settings"
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
              activeScreen === 'settings'
                ? 'bg-[#FF6B1A] border-[#FEF08A] text-white'
                : 'bg-slate-800/90 border-white/15 text-slate-200 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </motion.button>
        </div>
      </motion.header>

      {/* Mobile Compact Horizontal Quick-Nav Bar (Fits 100% inside narrow screens) */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto grid grid-cols-5 md:hidden gap-1 bg-[#0B1320]/90 border border-white/15 rounded-xl p-1 shrink-0 w-full"
      >
        {(
          [
            { id: 'main', label: 'Lobby', icon: Compass },
            { id: 'character', label: 'Outfits', icon: Shirt },
            { id: 'collection', label: 'Gear', icon: Sliders },
            { id: 'achievements', label: 'Profile', icon: Award },
            { id: 'history', label: 'History', icon: History },
          ] as const
        ).map((tab, idx) => {
          const Icon = tab.icon;
          const active = activeScreen === tab.id;
          return (
            <motion.button
              key={tab.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.08 + idx * 0.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                soundEngine.playClick();
                onSelectScreen(tab.id);
              }}
              className={`py-1.5 px-1 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer truncate ${
                active
                  ? 'bg-[#FF6B1A] text-white'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* CENTER WORKSPACE: Interactive 3D Character Turntable OR Active Sub-Screen */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative overflow-hidden w-full">
        <AnimatePresence mode="wait">
          {/* Interactive Turntable Drag Zone when on Main Lobby */}
          {activeScreen === 'main' && (
            <motion.div
              key="lobby-main"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              onPointerDown={handleTurntablePointerDown}
              onPointerMove={handleTurntablePointerMove}
              onPointerUp={handleTurntablePointerUp}
              onPointerCancel={handleTurntablePointerUp}
              className="pointer-events-auto flex-1 h-full flex flex-col justify-between items-center py-1 cursor-grab active:cursor-grabbing"
            >
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.08 }}
                className="bg-[#0B1320]/75 border border-white/15 rounded-lg px-2.5 py-1 text-[10px] sm:text-xs text-slate-200 text-center max-w-[95%] truncate"
              >
                Drag horizontally to rotate character · Sunset Island (10 Regions)
              </motion.div>

              {/* Quick Career Summary Strip */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.12 }}
                className="hidden sm:flex items-center gap-4 bg-[#0B1320]/82 border border-white/15 rounded-xl px-4 py-2 text-xs text-slate-300"
              >
                <span>
                  Wins:{' '}
                  <strong className="font-mono-num text-white">
                    {saveData.stats.wins}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Eliminations:{' '}
                  <strong className="font-mono-num text-[#00E5FF]">
                    {saveData.stats.totalEliminations}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Arena Wins:{' '}
                  <strong className="font-mono-num text-[#FDE047]">
                    {saveData.stats.arenaWins}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Island Regions:{' '}
                  <strong className="font-mono-num text-emerald-400">
                    {saveData.stats.regionsVisited.length}/10
                  </strong>
                </span>
              </motion.div>
            </motion.div>
          )}

          {/* SUB-SCREEN 1: CHARACTER OUTFIT CUSTOMIZATION */}
          {activeScreen === 'character' && (
            <motion.div
              key="lobby-character"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex-1 max-w-2xl mx-auto h-full max-h-[420px] bg-[#0B1320]/92 border border-white/15 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto custom-scroll"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Character Outfits
                  </h2>
                  <p className="text-xs text-slate-400">
                    Select an owned classic outfit. All cosmetics are earned
                    through fair gameplay.
                  </p>
                </div>
                <button
                  onClick={() => onSelectScreen('main')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
                >
                  Back to Lobby
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-3 overflow-y-auto custom-scroll pr-1">
                {OUTFIT_CATALOG.map((outfit, idx) => {
                  const owned = saveData.ownedOutfits.includes(outfit.id);
                  const selected = saveData.selectedOutfitId === outfit.id;
                  return (
                    <motion.button
                      key={outfit.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.22, delay: idx * 0.035 }}
                      whileHover={owned ? { scale: 1.015 } : undefined}
                      whileTap={owned ? { scale: 0.98 } : undefined}
                      disabled={!owned}
                      onClick={() => {
                        if (!owned) return;
                        soundEngine.playClick();
                        onUpdateSaveData((prev) => ({
                          ...prev,
                          selectedOutfitId: outfit.id,
                        }));
                      }}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        selected
                          ? 'bg-slate-800/95 border-[#FF6B1A]'
                          : owned
                          ? 'bg-slate-900/80 border-white/10 hover:border-white/25'
                          : 'bg-slate-950/60 border-white/5 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg border border-white/20 shrink-0"
                          style={{ backgroundColor: outfit.primaryColor }}
                        />
                        <div>
                          <div className="text-sm font-bold text-white">
                            {outfit.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {owned
                              ? outfit.description
                              : `Unlocks at Level ${outfit.unlockLevel} or Achievement`}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#FDE047] shrink-0 ml-2">
                        {selected ? 'Equipped' : owned ? 'Equip' : 'Locked'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* SUB-SCREEN 2: COLLECTION (BACKPACKS, VICTORY POSES, FRAMES & WEAPON CODEX) */}
          {activeScreen === 'collection' && (
            <motion.div
              key="lobby-collection"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex-1 max-w-3xl mx-auto h-full max-h-[430px] bg-[#0B1320]/92 border border-white/15 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto custom-scroll"
            >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Collection & Equipment Codex
                </h2>
                <p className="text-xs text-slate-400">
                  Customize backpack style, victory pose, profile frame, and
                  inspect fictional projectors.
                </p>
              </div>
              <button
                onClick={() => onSelectScreen('main')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
              >
                Back to Lobby
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-3">
              {/* Backpack Style */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: 0.03 }}
                className="bg-slate-900/80 border border-white/10 rounded-xl p-3"
              >
                <div className="text-xs font-bold text-slate-300 mb-2">
                  Backpack Style
                </div>
                {(['standard', 'tactical', 'jetpack'] as const).map((style) => (
                  <motion.button
                    key={style}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateSaveData((prev) => ({
                        ...prev,
                        selectedBackpackStyle: style,
                      }));
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold mb-1.5 flex items-center justify-between cursor-pointer ${
                      saveData.selectedBackpackStyle === style
                        ? 'bg-[#FF6B1A] text-white'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="capitalize">{style} Pack</span>
                    {saveData.selectedBackpackStyle === style && (
                      <span>Active</span>
                    )}
                  </motion.button>
                ))}
              </motion.div>

              {/* Victory Pose */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: 0.07 }}
                className="bg-slate-900/80 border border-white/10 rounded-xl p-3"
              >
                <div className="text-xs font-bold text-slate-300 mb-2">
                  Lobby & Victory Pose
                </div>
                {(['champion', 'salute', 'spin'] as const).map((pose) => (
                  <motion.button
                    key={pose}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateSaveData((prev) => ({
                        ...prev,
                        selectedVictoryPose: pose,
                      }));
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold mb-1.5 flex items-center justify-between cursor-pointer ${
                      saveData.selectedVictoryPose === pose
                        ? 'bg-[#00E5FF] text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="capitalize">{pose} Pose</span>
                    {saveData.selectedVictoryPose === pose && (
                      <span>Active</span>
                    )}
                  </motion.button>
                ))}
              </motion.div>

              {/* Profile Frame */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: 0.11 }}
                className="bg-slate-900/80 border border-white/10 rounded-xl p-3"
              >
                <div className="text-xs font-bold text-slate-300 mb-2">
                  Profile Banner Frame
                </div>
                {(
                  [
                    { id: 'classic_gold', label: 'Classic Gold' },
                    { id: 'neon_cyan', label: 'Arcade Cyan' },
                    { id: 'sunset_flame', label: 'Sunset Flame' },
                  ] as const
                ).map((frame) => (
                  <motion.button
                    key={frame.id}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateSaveData((prev) => ({
                        ...prev,
                        selectedProfileFrame: frame.id,
                      }));
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold mb-1.5 flex items-center justify-between cursor-pointer ${
                      saveData.selectedProfileFrame === frame.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>{frame.label}</span>
                    {saveData.selectedProfileFrame === frame.id && (
                      <span>Active</span>
                    )}
                  </motion.button>
                ))}
              </motion.div>
            </div>

            {/* Fictional Equipment Arsenal Overview */}
            <div className="border-t border-white/10 pt-2.5">
              <div className="text-xs font-bold text-slate-300 mb-2">
                Fictional Projectile Equipment Specifications
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Object.values(EQUIPMENT_CATALOG).map((eq, idx) => (
                  <motion.div
                    key={eq.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.14 + idx * 0.03 }}
                    className="bg-slate-900/90 border border-white/10 rounded-lg p-2"
                  >
                    <div
                      className="text-xs font-bold truncate"
                      style={{ color: eq.color }}
                    >
                      {eq.shortName}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono-num">
                      DMG {eq.damage} · RNG {eq.effectiveRange}m
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono-num">
                      CAP {eq.energyCapacity} · {eq.handlingDifficulty}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            </motion.div>
          )}

          {/* SUB-SCREEN 3: PLAYER PROFILE & 8 ACHIEVEMENTS */}
          {activeScreen === 'achievements' && (
            <motion.div
              key="lobby-achievements"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex-1 max-w-3xl mx-auto h-full max-h-[430px] bg-[#0B1320]/92 border border-white/15 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto custom-scroll"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Survivor Profile & Achievements
                  </h2>
                  <p className="text-xs text-slate-400">
                    Level {saveData.level} · {saveData.xp} Total XP ·{' '}
                    {saveData.stats.totalMatches} Matches Played
                  </p>
                </div>
                <button
                  onClick={() => onSelectScreen('main')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
                >
                  Back to Lobby
                </button>
              </div>

              {/* Career Stat Metrics */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 my-2.5">
                {[
                  { label: 'Matches', val: saveData.stats.totalMatches },
                  { label: 'Wins', val: saveData.stats.wins },
                  { label: 'Top 5', val: saveData.stats.topPlacements },
                  { label: 'Eliminations', val: saveData.stats.totalEliminations },
                  { label: 'Arena Wins', val: saveData.stats.arenaWins },
                  { label: 'Trials Done', val: saveData.stats.trainingCompleted },
                ].map((st, idx) => (
                  <motion.div
                    key={st.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    className="bg-slate-900/90 border border-white/10 rounded-lg p-2 text-center"
                  >
                    <div className="font-mono-num text-base font-bold text-white">
                      {st.val}
                    </div>
                    <div className="text-[10px] text-slate-400">{st.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* 8 Achievements Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto custom-scroll pr-1">
                {saveData.achievements.map((ach, idx) => {
                  const pct = Math.min(
                    100,
                    Math.round((ach.progress / ach.target) * 100)
                  );
                  return (
                    <motion.div
                      key={ach.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: 0.06 + idx * 0.03 }}
                      className={`p-2.5 rounded-xl border ${
                        ach.unlocked
                          ? 'bg-slate-800/90 border-[#FDE047]/60'
                          : 'bg-slate-900/75 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          {ach.title}
                        </span>
                        <span className="font-mono-num text-[11px] text-[#00E5FF]">
                          {ach.progress}/{ach.target}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {ach.description}
                      </p>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden mt-1.5">
                        <div
                          className={`h-full ${
                            ach.unlocked ? 'bg-[#FDE047]' : 'bg-[#00E5FF]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-amber-300 mt-1">
                        Reward: {ach.rewardText}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* SUB-SCREEN 4: MATCH HISTORY */}
          {activeScreen === 'history' && (
            <motion.div
              key="lobby-history"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex-1 max-w-3xl mx-auto h-full max-h-[430px] bg-[#0B1320]/92 border border-white/15 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto custom-scroll"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Recent Match History
                  </h2>
                  <p className="text-xs text-slate-400">
                    Stores up to 25 locally verified Battle Royale and Clash Arena
                    records.
                  </p>
                </div>
                <button
                  onClick={() => onSelectScreen('main')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
                >
                  Back to Lobby
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scroll my-3 space-y-2 pr-1">
                {saveData.matchHistory.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                    <Trophy className="w-7 h-7 text-slate-600 mb-2" />
                    No completed matches recorded yet. Tap PLAY to drop into
                    Sunset Island or Sunset Yard!
                  </div>
                ) : (
                  saveData.matchHistory.map((rec, idx) => (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                      className="bg-slate-900/85 border border-white/10 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">
                          {rec.modeLabel}{' '}
                          <span
                            className={
                              rec.outcome === 'VICTORY'
                                ? 'text-[#FDE047]'
                                : 'text-slate-400'
                            }
                          >
                            · {rec.outcome}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-num">
                          {rec.timestamp} · Duration {rec.durationSec}s
                          {rec.arenaScore ? ` · Score ${rec.arenaScore}` : ''}
                        </div>
                      </div>
                      <div className="text-right font-mono-num">
                        <div className="font-bold text-white">
                          #{rec.placement}/{rec.totalContestants} ·{' '}
                          {rec.eliminations} Elims
                        </div>
                        <div className="text-[11px] text-[#00E5FF]">
                          +{rec.xpEarned} XP
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* SUB-SCREEN 5: FULL SETTINGS & HUD CUSTOMIZATION */}
          {activeScreen === 'settings' && (
            <motion.div
              key="lobby-settings"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex-1 max-w-3xl mx-auto h-full max-h-[450px] bg-[#0B1320]/95 border border-white/15 rounded-2xl p-3 sm:p-4 flex flex-col justify-between overflow-hidden"
            >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0 gap-2">
              <div className="min-w-0">
                <h2 className="font-display text-sm sm:text-lg font-bold text-white truncate">
                  Settings, HUD Layout & Tactical Controls
                </h2>
                <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                  Customize button layout, crossbow aiming, AI difficulty,
                  graphics, and audio.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    onOpenHudEditor();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#FF6B1A] hover:bg-[#F97316] text-xs font-bold text-white flex items-center gap-1 cursor-pointer border border-[#FEF08A]"
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>Edit HUD Layout</span>
                </button>
                <button
                  onClick={() => onSelectScreen('main')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>

            {/* Category Tab Strip */}
            <div className="flex items-center gap-1.5 py-2 border-b border-white/10 overflow-x-auto custom-scroll shrink-0">
              {(
                [
                  { id: 'controls', label: 'Controls & HUD' },
                  { id: 'aim', label: 'Aim & Crossbow' },
                  { id: 'combat', label: 'Combat & AI' },
                  { id: 'graphics', label: 'Graphics' },
                  { id: 'audio', label: 'Audio & Data' },
                ] as const
              ).map((t, idx) => (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    soundEngine.playClick();
                    setSettingsTab(t.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                    settingsTab === t.id
                      ? 'bg-[#00E5FF] text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:text-white border border-white/10'
                  }`}
                >
                  {t.label}
                </motion.button>
              ))}
            </div>

            {/* Scrollable Settings Body (Guaranteed vertical touch pan-y scrolling) */}
            <motion.div
              key={settingsTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 overflow-y-auto custom-scroll py-2.5 pr-1 space-y-3 text-xs"
            >
              {settingsTab === 'controls' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2.5 bg-slate-900/80 border border-white/10 rounded-xl p-3">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span>Custom HUD Layout</span>
                      <span className="text-[10px] text-[#00E5FF]">
                        100% On-Screen Clamped
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Drag and drop any button (Fire, Aim, Joystick, Jump,
                      Crouch, Prone, Reload, Heal, Interact), resize, change
                      opacity, or hide optional buttons.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          soundEngine.playClick();
                          onOpenHudEditor();
                        }}
                        className="flex-1 py-2 rounded-lg bg-[#FF6B1A] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Move className="w-3.5 h-3.5" />
                        Customize HUD Buttons
                      </button>
                      <button
                        onClick={() => {
                          soundEngine.playClick();
                          onUpdateSettings({
                            ...saveData.settings,
                            hudLayout: cloneDefaultHUDLayout(),
                          });
                        }}
                        className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                      >
                        Reset HUD
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 bg-slate-900/80 border border-white/10 rounded-xl p-3">
                    <div className="font-bold text-white">
                      Global HUD Scale & Sensitivity
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Global Button Scale</span>
                        <span className="font-mono-num">
                          {Math.round(saveData.settings.hudScale * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.75"
                        max="1.25"
                        step="0.05"
                        value={saveData.settings.hudScale}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            hudScale: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-[#FF6B1A]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Joystick Movement Sensitivity</span>
                        <span className="font-mono-num">
                          {Math.round(
                            saveData.settings.movementSensitivity * 100
                          )}
                          %
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.8"
                        step="0.1"
                        value={saveData.settings.movementSensitivity}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            movementSensitivity: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-[#00E5FF]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'aim' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2.5 bg-slate-900/80 border border-white/10 rounded-xl p-3">
                    <div className="font-bold text-white">
                      Crossbow & Camera Sensitivity
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Free-Look Camera Sensitivity</span>
                        <span className="font-mono-num">
                          {Math.round(
                            saveData.settings.cameraSensitivity * 100
                          )}
                          %
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.4"
                        max="2.0"
                        step="0.1"
                        value={saveData.settings.cameraSensitivity}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            cameraSensitivity: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-[#00E5FF]"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Aim / Crossbow Scope Sensitivity</span>
                        <span className="font-mono-num">
                          {Math.round(saveData.settings.aimingSensitivity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="1.8"
                        step="0.1"
                        value={saveData.settings.aimingSensitivity}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            aimingSensitivity: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-[#FF6B1A]"
                      />
                    </div>

                    <label className="flex items-center justify-between cursor-pointer pt-1">
                      <span className="text-slate-300">
                        Invert Vertical Look (Y-Axis)
                      </span>
                      <input
                        type="checkbox"
                        checked={saveData.settings.invertY}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            invertY: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#00E5FF]"
                      />
                    </label>
                  </div>

                  <div className="space-y-2.5 bg-slate-900/80 border border-white/10 rounded-xl p-3">
                    <div className="font-bold text-white">
                      Crosshair Style & Aim Behavior
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'classic_cross', label: 'Classic Cross' },
                          { id: 'dot_ring', label: 'Dot & Ring' },
                          { id: 'chevron', label: 'Crossbow Chevron' },
                          { id: 'precision_box', label: 'Precision Box' },
                        ] as { id: CrosshairStyle; label: string }[]
                      ).map((ch) => (
                        <button
                          key={ch.id}
                          onClick={() => {
                            soundEngine.playClick();
                            onUpdateSettings({
                              ...saveData.settings,
                              crosshairStyle: ch.id,
                            });
                          }}
                          className={`py-1.5 px-2 rounded-lg font-semibold text-[11px] cursor-pointer ${
                            saveData.settings.crosshairStyle === ch.id
                              ? 'bg-[#FF6B1A] text-white'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {ch.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-300">Aim Button Mode</span>
                      <div className="flex gap-1">
                        {(['toggle', 'hold'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() =>
                              onUpdateSettings({
                                ...saveData.settings,
                                aimBehavior: mode,
                              })
                            }
                            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase cursor-pointer ${
                              saveData.settings.aimBehavior === mode
                                ? 'bg-[#00E5FF] text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-slate-300">
                        Mobile Crossbow Aim Assist
                      </span>
                      <input
                        type="checkbox"
                        checked={saveData.settings.aimAssist}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            aimAssist: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#00E5FF]"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-slate-300">
                        3D Aim Raycast Debug Line
                      </span>
                      <input
                        type="checkbox"
                        checked={saveData.settings.showAimDebug}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            showAimDebug: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#FDE047]"
                      />
                    </label>
                  </div>
                </div>
              )}

              {settingsTab === 'combat' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2.5 bg-slate-900/80 border border-white/10 rounded-xl p-3">
                    <div className="font-bold text-white">
                      Tactical AI Difficulty & Roles
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Adjusts AI reaction speed, crossbow accuracy, cover usage,
                      and squad coordination across Assault, Support, Scout, and
                      Defender bots.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['EASY', 'NORMAL', 'HARD'] as AIDifficulty[]).map(
                        (diff) => (
                          <button
                            key={diff}
                            onClick={() => {
                              soundEngine.playClick();
                              onUpdateSettings({
                                ...saveData.settings,
                                aiDifficulty: diff,
                              });
                            }}
                            className={`py-2 rounded-lg font-bold cursor-pointer ${
                              saveData.settings.aiDifficulty === diff
                                ? 'bg-[#FF6B1A] text-white'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {diff}
                          </button>
                        )
                      )}
                    </div>

                    <label className="flex items-center justify-between cursor-pointer pt-1">
                      <span className="text-slate-300">
                        Show AI Role & State Telemetry
                      </span>
                      <input
                        type="checkbox"
                        checked={saveData.settings.showAiDebug}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            showAiDebug: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#00E5FF]"
                      />
                    </label>
                  </div>

                  <div className="space-y-2.5 bg-slate-900/80 border border-white/10 rounded-xl p-3">
                    <div className="font-bold text-white">
                      Combat Feel & Visual Feedback
                    </div>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-slate-300">
                        Crosshair Hit Markers
                      </span>
                      <input
                        type="checkbox"
                        checked={saveData.settings.hitMarkersEnabled}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            hitMarkersEnabled: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#FF6B1A]"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-slate-300">
                        Floating Damage Numbers
                      </span>
                      <input
                        type="checkbox"
                        checked={saveData.settings.damageNumbersEnabled}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            damageNumbersEnabled: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#FF6B1A]"
                      />
                    </label>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Camera Recoil Shake</span>
                      <div className="flex gap-1">
                        {(['off', 'low', 'high'] as const).map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() =>
                              onUpdateSettings({
                                ...saveData.settings,
                                cameraShake: lvl,
                              })
                            }
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase cursor-pointer ${
                              saveData.settings.cameraShake === lvl
                                ? 'bg-[#00E5FF] text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">3D Impact Effects</span>
                      <div className="flex gap-1">
                        {(['low', 'medium', 'high'] as const).map((fx) => (
                          <button
                            key={fx}
                            onClick={() =>
                              onUpdateSettings({
                                ...saveData.settings,
                                combatEffects: fx,
                              })
                            }
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase cursor-pointer ${
                              saveData.settings.combatEffects === fx
                                ? 'bg-[#FF6B1A] text-white'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {fx}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'graphics' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-3 bg-slate-900/80 border border-white/10 rounded-xl p-3">
                    <div className="font-bold text-white">
                      Graphics Quality Preset
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['LOW', 'MEDIUM', 'HIGH'] as GraphicsPreset[]).map(
                        (p) => (
                          <button
                            key={p}
                            onClick={() => {
                              soundEngine.playClick();
                              onUpdateSettings({
                                ...saveData.settings,
                                graphicsPreset: p,
                              });
                            }}
                            className={`py-2 rounded-lg font-bold cursor-pointer ${
                              saveData.settings.graphicsPreset === p
                                ? 'bg-[#FF6B1A] text-white'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}
                    </div>

                    <label className="flex items-center justify-between pt-1 cursor-pointer">
                      <span className="text-slate-300">Real-Time Shadows</span>
                      <input
                        type="checkbox"
                        checked={saveData.settings.shadowsEnabled}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            shadowsEnabled: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#FF6B1A]"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-slate-300">Show FPS Counter</span>
                      <input
                        type="checkbox"
                        checked={saveData.settings.showFps}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            showFps: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#FF6B1A]"
                      />
                    </label>
                  </div>

                  <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-white">
                        Mobile GPU Optimization
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        LOW preset uses 1.0x pixel ratio for maximum battery and
                        60 FPS stability. HIGH enables up to 1.75x pixel ratio
                        and directional shadows.
                      </p>
                    </div>
                    <div className="text-[11px] font-mono-num text-emerald-400 mt-2">
                      Current Viewport FPS: {fps} FPS
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'audio' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2 bg-slate-900/80 border border-white/10 rounded-xl p-3">
                    <div className="font-bold text-white">
                      Synthesized Audio Channels
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-300">
                        <span>Master Volume</span>
                        <span className="font-mono-num">
                          {Math.round(saveData.settings.masterVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={saveData.settings.masterVolume}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            masterVolume: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-[#00E5FF]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-300">
                        <span>Combat SFX Volume</span>
                        <span className="font-mono-num">
                          {Math.round(saveData.settings.sfxVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={saveData.settings.sfxVolume}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            sfxVolume: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-[#FF6B1A]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-300">
                        <span>Music & Victory Fanfare</span>
                        <span className="font-mono-num">
                          {Math.round(saveData.settings.musicVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={saveData.settings.musicVolume}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            musicVolume: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-[#FF6B1A]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-300">
                        <span>Ambient & Vehicle Engine</span>
                        <span className="font-mono-num">
                          {Math.round(saveData.settings.ambientVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={saveData.settings.ambientVolume}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...saveData.settings,
                            ambientVolume: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-[#00E5FF]"
                      />
                    </div>
                  </div>

                  {/* Data Management */}
                  <div className="space-y-2.5 bg-slate-900/80 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-white">
                        Local Save Management
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Clear match history or reset all progression and custom
                        HUD layouts to factory defaults.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          soundEngine.playClick();
                          onUpdateSaveData((prev) => ({
                            ...prev,
                            matchHistory: [],
                          }));
                        }}
                        className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                      >
                        Clear History
                      </button>
                      <button
                        onClick={() => {
                          soundEngine.playClick();
                          onResetAllData();
                        }}
                        className="flex-1 py-2 rounded-lg bg-rose-950/90 border border-rose-500/40 hover:bg-rose-900 text-rose-200 font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BOTTOM ACTION DOCK: Mode Selector & Prominent PLAY CTA */}
      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-3 bg-[#0B1320]/92 border border-white/15 rounded-xl sm:rounded-2xl p-2 sm:p-3 shrink-0 w-full min-w-0"
      >
        {/* 4 Playable Modes Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 flex-1 min-w-0">
          {(
            [
              {
                id: 'br_solo',
                title: 'BR Solo',
                sub: 'Sunset Island · 20',
                icon: User,
              },
              {
                id: 'br_squad',
                title: 'BR Squad',
                sub: '4-Player AI Team',
                icon: Users,
              },
              {
                id: 'clash_arena',
                title: 'Clash Arena',
                sub: '4v4 Best of 5',
                icon: Shield,
              },
              {
                id: 'training',
                title: 'Training',
                sub: '5 Guided Trials',
                icon: Crosshair,
              },
            ] as const
          ).map((m, idx) => {
            const Icon = m.icon;
            const active = selectedMode === m.id;
            return (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, delay: 0.12 + idx * 0.045 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  soundEngine.playClick();
                  onSelectMode(m.id);
                }}
                className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border text-left transition-all cursor-pointer min-w-0 ${
                  active
                    ? 'bg-slate-800 border-[#FF6B1A]'
                    : 'bg-slate-900/75 border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                  <Icon
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                      active ? 'text-[#FF6B1A]' : 'text-slate-400'
                    }`}
                  />
                  <span className="text-[11px] sm:text-xs font-bold text-white truncate">
                    {m.title}
                  </span>
                </div>
                <div className="hidden sm:block text-[10px] text-slate-400 truncate mt-0.5">
                  {m.sub}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Primary PLAY Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            soundEngine.playClick();
            onStartMatch();
          }}
          className="px-5 py-2 sm:px-7 sm:py-3.5 rounded-xl bg-[#FF6B1A] hover:bg-[#F97316] text-white font-display font-bold text-sm sm:text-lg tracking-wider flex items-center justify-center gap-2 shrink-0 cursor-pointer border-2 border-[#FEF08A]"
        >
          <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
          <span>PLAY</span>
        </motion.button>
      </motion.footer>
    </div>
  );
};
