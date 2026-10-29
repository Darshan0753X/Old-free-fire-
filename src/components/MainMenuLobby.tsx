import React, { useRef } from 'react';
import {
  EQUIPMENT_CATALOG,
  GameMode,
  GameSettings,
  GraphicsPreset,
  LobbyScreen,
  OUTFIT_CATALOG,
  SaveDataSchema,
  SUNSET_ISLAND_REGIONS,
} from '../types/game';
import { soundEngine } from '../services/audio';
import {
  Award,
  Clock,
  Compass,
  Crosshair,
  History,
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
}) => {
  const dragXRef = useRef<number | null>(null);

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
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* TOP BAR CONTRACT: Brand Emblem — Navigation Links — Profile & Settings */}
      <header className="pointer-events-auto flex items-center justify-between gap-4 bg-[#0B1320]/88 border border-white/15 rounded-xl px-4 py-2.5">
        {/* Zone 1: Original Classic Drop Logo Lockup */}
        <button
          onClick={() => {
            soundEngine.playClick();
            onSelectScreen('main');
          }}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer"
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
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
          <div>
            <span className="font-display text-lg sm:text-xl font-bold tracking-wider text-white block leading-none">
              CLASSIC DROP
            </span>
            <span className="text-[10px] font-semibold text-[#FDE047] tracking-widest block mt-0.5">
              V2 NOSTALGIA EDITION
            </span>
          </div>
        </button>

        {/* Zone 2: Clean Single-Line Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-2">
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
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeScreen === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundEngine.playClick();
                  onSelectScreen(tab.id);
                }}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#FF6B1A] text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Player Profile Card, PWA Install / Fullscreen & Settings Trigger */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <PWAInstallButton />

          <div
            onClick={() => {
              soundEngine.playClick();
              onSelectScreen('achievements');
            }}
            className="flex items-center gap-2.5 bg-slate-900/90 border border-white/10 rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-white/25"
          >
            <div
              className={`w-8 h-8 rounded-md bg-slate-800 border-2 ${frameBorderColor} flex items-center justify-center font-display font-bold text-xs text-[#FDE047]`}
            >
              LV.{saveData.level}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-white leading-tight">
                {saveData.playerName}
              </div>
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[#00E5FF]"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>
          </div>

          {saveData.settings.showFps && (
            <span className="hidden lg:inline-block font-mono-num text-xs text-emerald-400">
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
            className="min-w-[40px] min-h-[40px] rounded-lg bg-slate-800/90 border border-white/15 flex items-center justify-center text-slate-200 hover:text-white cursor-pointer"
          >
            {saveData.settings.muted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#00E5FF]" />
            )}
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              onSelectScreen(activeScreen === 'settings' ? 'main' : 'settings');
            }}
            aria-label="Settings"
            className={`min-w-[40px] min-h-[40px] rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
              activeScreen === 'settings'
                ? 'bg-[#FF6B1A] border-[#FEF08A] text-white'
                : 'bg-slate-800/90 border-white/15 text-slate-200 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CENTER WORKSPACE: Interactive 3D Character Turntable OR Active Sub-Screen */}
      <div className="flex-1 flex items-center justify-between relative my-2 overflow-hidden">
        {/* Mobile Left Quick-Nav Rail */}
        <div className="pointer-events-auto flex md:hidden flex-col gap-1.5 bg-[#0B1320]/88 border border-white/15 rounded-xl p-1.5 z-10">
          {(
            [
              { id: 'main', label: 'Lobby', icon: Compass },
              { id: 'character', label: 'Outfits', icon: Shirt },
              { id: 'collection', label: 'Gear', icon: Sliders },
              { id: 'achievements', label: 'Profile', icon: Award },
              { id: 'history', label: 'History', icon: History },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeScreen === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundEngine.playClick();
                  onSelectScreen(tab.id);
                }}
                className={`px-2.5 py-2 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-[#FF6B1A] text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Interactive Turntable Drag Zone when on Main Lobby */}
        {activeScreen === 'main' && (
          <div
            onPointerDown={handleTurntablePointerDown}
            onPointerMove={handleTurntablePointerMove}
            onPointerUp={handleTurntablePointerUp}
            onPointerCancel={handleTurntablePointerUp}
            className="pointer-events-auto flex-1 h-full flex flex-col justify-between items-center py-2 cursor-grab active:cursor-grabbing"
          >
            <div className="bg-[#0B1320]/75 border border-white/15 rounded-lg px-3 py-1 text-xs text-slate-200">
              Drag horizontally to rotate character · Sunset Island (10 Regions)
            </div>

            {/* Quick Career Summary Strip */}
            <div className="hidden sm:flex items-center gap-4 bg-[#0B1320]/82 border border-white/15 rounded-xl px-4 py-2 text-xs text-slate-300">
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
            </div>
          </div>
        )}

        {/* SUB-SCREEN 1: CHARACTER OUTFIT CUSTOMIZATION */}
        {activeScreen === 'character' && (
          <div className="pointer-events-auto flex-1 max-w-2xl mx-auto h-full max-h-[420px] bg-[#0B1320]/92 border border-white/15 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-3 overflow-y-auto pr-1">
              {OUTFIT_CATALOG.map((outfit) => {
                const owned = saveData.ownedOutfits.includes(outfit.id);
                const selected = saveData.selectedOutfitId === outfit.id;
                return (
                  <button
                    key={outfit.id}
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
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SUB-SCREEN 2: COLLECTION (BACKPACKS, VICTORY POSES, FRAMES & WEAPON CODEX) */}
        {activeScreen === 'collection' && (
          <div className="pointer-events-auto flex-1 max-w-3xl mx-auto h-full max-h-[430px] bg-[#0B1320]/92 border border-white/15 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto">
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
              <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3">
                <div className="text-xs font-bold text-slate-300 mb-2">
                  Backpack Style
                </div>
                {(['standard', 'tactical', 'jetpack'] as const).map((style) => (
                  <button
                    key={style}
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
                  </button>
                ))}
              </div>

              {/* Victory Pose */}
              <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3">
                <div className="text-xs font-bold text-slate-300 mb-2">
                  Lobby & Victory Pose
                </div>
                {(['champion', 'salute', 'spin'] as const).map((pose) => (
                  <button
                    key={pose}
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
                  </button>
                ))}
              </div>

              {/* Profile Frame */}
              <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3">
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
                  <button
                    key={frame.id}
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
                  </button>
                ))}
              </div>
            </div>

            {/* Fictional Equipment Arsenal Overview */}
            <div className="border-t border-white/10 pt-2.5">
              <div className="text-xs font-bold text-slate-300 mb-2">
                Fictional Projectile Equipment Specifications
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Object.values(EQUIPMENT_CATALOG).map((eq) => (
                  <div
                    key={eq.id}
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUB-SCREEN 3: PLAYER PROFILE & 8 ACHIEVEMENTS */}
        {activeScreen === 'achievements' && (
          <div className="pointer-events-auto flex-1 max-w-3xl mx-auto h-full max-h-[430px] bg-[#0B1320]/92 border border-white/15 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto">
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
              ].map((st) => (
                <div
                  key={st.label}
                  className="bg-slate-900/90 border border-white/10 rounded-lg p-2 text-center"
                >
                  <div className="font-mono-num text-base font-bold text-white">
                    {st.val}
                  </div>
                  <div className="text-[10px] text-slate-400">{st.label}</div>
                </div>
              ))}
            </div>

            {/* 8 Achievements Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-1">
              {saveData.achievements.map((ach) => {
                const pct = Math.min(
                  100,
                  Math.round((ach.progress / ach.target) * 100)
                );
                return (
                  <div
                    key={ach.id}
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
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUB-SCREEN 4: MATCH HISTORY */}
        {activeScreen === 'history' && (
          <div className="pointer-events-auto flex-1 max-w-3xl mx-auto h-full max-h-[430px] bg-[#0B1320]/92 border border-white/15 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto">
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

            <div className="flex-1 overflow-y-auto my-3 space-y-2 pr-1">
              {saveData.matchHistory.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                  <Trophy className="w-7 h-7 text-slate-600 mb-2" />
                  No completed matches recorded yet. Tap PLAY to drop into
                  Sunset Island or Sunset Yard!
                </div>
              ) : (
                saveData.matchHistory.map((rec) => (
                  <div
                    key={rec.id}
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
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SUB-SCREEN 5: SETTINGS & ACCESSIBILITY */}
        {activeScreen === 'settings' && (
          <div className="pointer-events-auto flex-1 max-w-3xl mx-auto h-full max-h-[430px] bg-[#0B1320]/94 border border-white/15 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Settings & Mobile Optimization
                </h2>
                <p className="text-xs text-slate-400">
                  Configure graphics presets, touch sensitivity, audio channels,
                  and save data.
                </p>
              </div>
              <button
                onClick={() => onSelectScreen('main')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
              >
                Done
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-3 overflow-y-auto pr-1 text-xs">
              {/* Graphics & Performance */}
              <div className="space-y-3 bg-slate-900/80 border border-white/10 rounded-xl p-3">
                <div className="font-bold text-white">
                  Graphics Quality Preset
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH'] as GraphicsPreset[]).map((p) => (
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
                  ))}
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

              {/* Camera & Touch Controls */}
              <div className="space-y-2.5 bg-slate-900/80 border border-white/10 rounded-xl p-3">
                <div className="font-bold text-white">
                  Touch & Camera Controls
                </div>
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Camera Sensitivity</span>
                    <span className="font-mono-num">
                      {Math.round(saveData.settings.cameraSensitivity * 100)}%
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
                    <span>Movement Sensitivity</span>
                    <span className="font-mono-num">
                      {Math.round(saveData.settings.movementSensitivity * 100)}%
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

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Invert Vertical Camera</span>
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

              {/* Audio Volumes */}
              <div className="space-y-2 bg-slate-900/80 border border-white/10 rounded-xl p-3">
                <div className="font-bold text-white">Audio Channels</div>
                <div>
                  <div className="flex justify-between text-slate-300">
                    <span>Effects Volume</span>
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
                    <span>Music Volume</span>
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
              </div>

              {/* Data Management */}
              <div className="space-y-2.5 bg-slate-900/80 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-white">
                    Local Save Management
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Clear match history or reset all progression to factory
                    defaults.
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
          </div>
        )}
      </div>

      {/* BOTTOM ACTION DOCK: Mode Selector & Prominent PLAY CTA */}
      <footer className="pointer-events-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0B1320]/90 border border-white/15 rounded-2xl p-3">
        {/* 4 Playable Modes Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
          {(
            [
              {
                id: 'br_solo',
                title: 'Battle Royale Solo',
                sub: 'Sunset Island · 20 Contestants',
                icon: User,
              },
              {
                id: 'br_squad',
                title: 'Battle Royale Squad',
                sub: '4-Player AI Team & Commands',
                icon: Users,
              },
              {
                id: 'clash_arena',
                title: 'Clash Arena (4v4)',
                sub: 'Sunset Yard · Best of 5 Rounds',
                icon: Shield,
              },
              {
                id: 'training',
                title: 'Training Grounds',
                sub: '5 Guided Practice Trials',
                icon: Crosshair,
              },
            ] as const
          ).map((m) => {
            const Icon = m.icon;
            const active = selectedMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  soundEngine.playClick();
                  onSelectMode(m.id);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  active
                    ? 'bg-slate-800 border-[#FF6B1A]'
                    : 'bg-slate-900/75 border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-[#FF6B1A]' : 'text-slate-400'
                    }`}
                  />
                  <span className="text-xs font-bold text-white truncate">
                    {m.title}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {m.sub}
                </div>
              </button>
            );
          })}
        </div>

        {/* Primary PLAY Button */}
        <button
          onClick={() => {
            soundEngine.playClick();
            onStartMatch();
          }}
          className="px-7 py-3.5 rounded-xl bg-[#FF6B1A] hover:bg-[#F97316] active:scale-[0.98] text-white font-display font-bold text-lg tracking-wider flex items-center justify-center gap-2.5 shrink-0 cursor-pointer border-2 border-[#FEF08A]"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>PLAY</span>
        </button>
      </footer>
    </div>
  );
};
