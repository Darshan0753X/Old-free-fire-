import React, { useEffect, useRef, useState } from 'react';
import {
  EQUIPMENT_CATALOG,
  RARITY_COLORS,
  SquadCommand,
  SUNSET_ISLAND_REGIONS,
  interfaceHUDStateSnapshot,
} from '../types/game';
import { GameSimulationEngine } from '../engine/GameSimulation';
import { soundEngine } from '../services/audio';
import {
  Backpack,
  Car,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Eye,
  Heart,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Shield,
  ShoppingBag,
  Users,
  Zap,
} from 'lucide-react';

interface InGameHUDProps {
  hud: interfaceHUDStateSnapshot;
  engine: GameSimulationEngine | null;
  hudScale: number;
  showFps: boolean;
  onRestartMatch: () => void;
  onReturnToLobby: () => void;
}

export const InGameHUD: React.FC<InGameHUDProps> = ({
  hud,
  engine,
  hudScale,
  showFps,
  onRestartMatch,
  onReturnToLobby,
}) => {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [squadDrawerOpen, setSquadDrawerOpen] = useState(false);
  const [arenaShopOpen, setArenaShopOpen] = useState(false);

  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const joystickContainerRef = useRef<HTMLDivElement | null>(null);

  // Multi-touch identifier refs
  const moveTouchIdRef = useRef<number | null>(null);
  const moveOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joystickKnob, setJoystickKnob] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const lookTouchIdRef = useRef<number | null>(null);
  const lookLastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Draw 2D Canvas Minimap
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background water / arena floor
    ctx.fillStyle = hud.mode === 'clash_arena' ? '#1E293B' : '#0369A1';
    ctx.fillRect(0, 0, w, h);

    const worldSpan = hud.mode === 'clash_arena' ? 110 : 400;
    const toMapX = (wx: number) => w / 2 + (wx / worldSpan) * w;
    const toMapY = (wz: number) => h / 2 + (wz / worldSpan) * h;

    if (hud.mode === 'br_solo' || hud.mode === 'br_squad') {
      // Island Landmass Circle
      ctx.fillStyle = '#3F6212';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, (185 / worldSpan) * w, 0, Math.PI * 2);
      ctx.fill();

      // Named Region Dots
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      for (const reg of SUNSET_ISLAND_REGIONS) {
        const rx = toMapX(reg.x);
        const ry = toMapY(reg.z);
        ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3);
      }

      // Next Safe Zone Ring (White)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(
        toMapX(hud.nextZoneCenter.x),
        toMapY(hud.nextZoneCenter.z),
        (hud.nextZoneRadius / worldSpan) * w,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      // Current Safe Zone Ring (Sunset Orange)
      ctx.strokeStyle = '#FF6B1A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        toMapX(hud.zoneCenter.x),
        toMapY(hud.zoneCenter.z),
        (hud.zoneRadius / worldSpan) * w,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    // Vehicle icon
    if (hud.vehiclePos) {
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(
        toMapX(hud.vehiclePos.x) - 3,
        toMapY(hud.vehiclePos.z) - 3,
        6,
        6
      );
    }

    // Squad Tactical Marker
    if (hud.squadMarker) {
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        toMapX(hud.squadMarker.x),
        toMapY(hud.squadMarker.z),
        5,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    // Teammates & Nearby Indicators
    for (const actor of hud.minimapActors) {
      if (actor.isAlly) {
        ctx.fillStyle = actor.isDowned ? '#EF4444' : '#00E5FF';
        ctx.beginPath();
        ctx.arc(toMapX(actor.x), toMapY(actor.z), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player Position & View Cone
    const px = toMapX(hud.playerPos.x);
    const py = toMapY(hud.playerPos.z);

    ctx.fillStyle = 'rgba(253, 224, 71, 0.25)';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(
      px,
      py,
      18,
      Math.PI / 2 - hud.playerPos.yaw - 0.45,
      Math.PI / 2 - hud.playerPos.yaw + 0.45
    );
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [hud]);

  // Tap minimap to place tactical Squad Marker
  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engine || !minimapCanvasRef.current) return;
    const rect = minimapCanvasRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const nz = (e.clientY - rect.top) / rect.height - 0.5;
    const worldSpan = hud.mode === 'clash_arena' ? 110 : 400;
    engine.issueSquadCommand('move_marker', {
      x: nx * worldSpan,
      z: nz * worldSpan,
    });
  };

  // Left Virtual Joystick Touch Handlers
  const handleJoystickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (moveTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch || !joystickContainerRef.current) return;
    moveTouchIdRef.current = touch.identifier;
    const rect = joystickContainerRef.current.getBoundingClientRect();
    moveOriginRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateJoystickFromPoint(touch.clientX, touch.clientY);
  };

  const handleJoystickTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (moveTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === moveTouchIdRef.current) {
        updateJoystickFromPoint(t.clientX, t.clientY);
        break;
      }
    }
  };

  const handleJoystickTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === moveTouchIdRef.current) {
        moveTouchIdRef.current = null;
        setJoystickKnob({ x: 0, y: 0 });
        if (engine) {
          engine.input.moveX = 0;
          engine.input.moveZ = 0;
          engine.input.sprint = false;
        }
        break;
      }
    }
  };

  const updateJoystickFromPoint = (clientX: number, clientY: number) => {
    if (!engine) return;
    const containerW = joystickContainerRef.current?.clientWidth ?? 96;
    const maxRadius = Math.max(28, containerW * 0.36);
    const dx = clientX - moveOriginRef.current.x;
    const dy = clientY - moveOriginRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(maxRadius, dist);
    const angle = Math.atan2(dy, dx);

    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    setJoystickKnob({ x: kx, y: ky });

    const normX = kx / maxRadius;
    const normZ = -ky / maxRadius;
    engine.input.moveX = normX;
    engine.input.moveZ = normZ;
    engine.input.sprint = dist > maxRadius * 1.15 && normZ > 0.5;
  };

  // Right Touch-Look Camera Handlers
  const handleLookTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    lookTouchIdRef.current = touch.identifier;
    lookLastPosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchIdRef.current === null || !engine) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchIdRef.current) {
        const dx = t.clientX - lookLastPosRef.current.x;
        const dy = t.clientY - lookLastPosRef.current.y;
        lookLastPosRef.current = { x: t.clientX, y: t.clientY };
        engine.rotateCamera(dx * 0.0065, dy * 0.0055);
        break;
      }
    }
  };

  const handleLookTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        break;
      }
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const activeWeapon = hud.weapons[0];

  const renderVitalsAndWeapons = () => (
    <>
      {/* Vitals Bars */}
      <div className="w-full bg-[#0B1320]/88 border border-white/15 rounded-xl p-1.5 sm:p-2 space-y-1">
        <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono-num">
          <span className="text-cyan-300 font-bold truncate">
            SHIELD LV.{hud.armorLevel}: {hud.shield}
          </span>
          <span className="text-white font-bold ml-2 shrink-0">
            HP: {hud.health}/{hud.maxHealth}
          </span>
        </div>
        {/* Shield Bar */}
        <div className="w-full h-1.5 sm:h-2 bg-slate-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00E5FF] transition-all"
            style={{ width: `${(hud.shield / hud.maxShield) * 100}%` }}
          />
        </div>
        {/* Health Bar */}
        <div className="w-full h-2 sm:h-2.5 bg-slate-900 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              hud.health > 35 ? 'bg-emerald-400' : 'bg-rose-500'
            }`}
            style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }}
          />
        </div>
      </div>

      {/* Weapon Slots & Temporary Cover Button */}
      <div className="flex items-center gap-1.5 w-full min-w-0">
        <button
          onClick={() => engine?.switchWeaponSlot(0)}
          className="flex-1 min-w-0 bg-[#0B1320]/90 border-2 border-[#FF6B1A] rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-left cursor-pointer"
        >
          <div className="flex items-center justify-between gap-1 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold text-white truncate">
              {activeWeapon ? activeWeapon.shortName : 'Unarmed'}
            </span>
            <span className="font-mono-num text-[10px] sm:text-xs font-bold text-[#FDE047] shrink-0">
              {hud.isReloading
                ? 'RECHRG'
                : `${hud.currentClip[0]}/${hud.reserveAmmo}`}
            </span>
          </div>
        </button>

        {hud.weapons[1] && (
          <button
            onClick={() => engine?.switchWeaponSlot(1)}
            className="bg-[#0B1320]/82 border border-white/20 rounded-xl px-2 py-1.5 sm:px-2.5 sm:py-2 text-left cursor-pointer shrink-0 max-w-[95px] sm:max-w-[120px]"
          >
            <div className="text-[10px] sm:text-xs font-semibold text-slate-300 truncate">
              {hud.weapons[1].shortName}
            </div>
          </button>
        )}

        {hud.coverGadgets > 0 && (
          <button
            onClick={() => engine?.deployTemporaryCover()}
            className="h-8 sm:h-10 px-2 sm:px-2.5 rounded-xl bg-cyan-950/90 border border-[#00E5FF] text-[10px] sm:text-xs font-bold text-[#00E5FF] flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>{hud.coverGadgets}</span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none overflow-hidden flex flex-col justify-between safe-viewport-pad w-full h-full max-w-full max-h-full">
      {/* RIGHT-HALF TOUCH-LOOK CAMERA REGION (Behind HUD buttons) */}
      <div
        onTouchStart={handleLookTouchStart}
        onTouchMove={handleLookTouchMove}
        onTouchEnd={handleLookTouchEnd}
        onTouchCancel={handleLookTouchEnd}
        className="pointer-events-auto fixed top-0 right-0 w-3/5 h-full z-0"
      />

      {/* CENTER CROSSHAIR RETICLE */}
      {(hud.phase === 'active' || hud.phase === 'prep_buy') &&
        !hud.inVehicle && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="relative w-7 h-7 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
              <div className="absolute top-0 w-0.5 h-2 bg-white/80" />
              <div className="absolute bottom-0 w-0.5 h-2 bg-white/80" />
              <div className="absolute left-0 h-0.5 w-2 bg-white/80" />
              <div className="absolute right-0 h-0.5 w-2 bg-white/80" />
            </div>
          </div>
        )}

      {/* TOP REGION: MINIMAP (TOP-LEFT), MATCH STATUS BAR (TOP-CENTER), SQUAD & PAUSE (TOP-RIGHT) */}
      <div className="relative z-10 flex items-start justify-between gap-1.5 sm:gap-2 w-full min-w-0">
        {/* Top-Left: 2D Minimap + Squad Panel */}
        <div className="flex flex-col sm:flex-row items-start gap-1.5 sm:gap-2 shrink-0">
          <div className="pointer-events-auto bg-[#0B1320]/85 border border-white/20 rounded-xl p-1 sm:p-1.5">
            <canvas
              ref={minimapCanvasRef}
              width={112}
              height={112}
              onClick={handleMinimapClick}
              className="w-[70px] h-[70px] sm:w-[100px] sm:h-[100px] rounded-lg cursor-crosshair block"
            />
            <div className="text-[9px] sm:text-[10px] font-semibold text-center text-slate-200 mt-0.5 truncate max-w-[70px] sm:max-w-[100px]">
              {hud.currentRegionName}
            </div>
          </div>

          {/* Squad Member Status & 5-Command Drawer (Squad BR or Clash Arena) */}
          {(hud.mode === 'br_squad' || hud.mode === 'clash_arena') && (
            <div className="pointer-events-auto bg-[#0B1320]/85 border border-white/15 rounded-xl p-1.5 sm:p-2 min-w-[115px] sm:min-w-[140px] max-w-[135px] sm:max-w-[160px]">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[9px] sm:text-[10px] font-bold text-[#00E5FF] flex items-center gap-1 truncate">
                  <Users className="w-3 h-3 shrink-0" /> SQUAD
                </span>
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setSquadDrawerOpen((v) => !v);
                  }}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] sm:text-[10px] font-bold text-[#FDE047] cursor-pointer shrink-0"
                >
                  {squadDrawerOpen ? 'Hide' : 'Cmds'}
                </button>
              </div>

              <div className="space-y-1">
                {hud.squadMembers.map((m) => (
                  <div key={m.id} className="text-[9px] sm:text-[10px]">
                    <div className="flex items-center justify-between text-slate-200 gap-1">
                      <span className="truncate max-w-[65px] sm:max-w-[85px] font-semibold">
                        {m.isLeader ? '★ ' : ''}
                        {m.name}
                      </span>
                      <span className="text-[8px] sm:text-[9px] text-slate-400 shrink-0">
                        {m.eliminated
                          ? 'OUT'
                          : m.stance === 'downed'
                          ? `DN(${m.downedTimer}s)`
                          : m.aiStateLabel}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                      <div
                        className={`h-full ${
                          m.stance === 'downed'
                            ? 'bg-rose-500'
                            : m.isPlayer
                            ? 'bg-[#FF6B1A]'
                            : 'bg-[#00E5FF]'
                        }`}
                        style={{
                          width: `${
                            m.eliminated ? 0 : (m.health / m.maxHealth) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* 5 Squad Commands Menu */}
              {squadDrawerOpen && (
                <div className="mt-1.5 pt-1.5 border-t border-white/10 grid grid-cols-1 gap-1">
                  {(
                    [
                      { cmd: 'follow', label: '1. Follow Me' },
                      { cmd: 'hold', label: '2. Hold Position' },
                      { cmd: 'move_marker', label: '3. Move to Marker' },
                      { cmd: 'regroup', label: '4. Regroup Now' },
                      { cmd: 'assist', label: '5. Assist Teammate' },
                    ] as { cmd: SquadCommand; label: string }[]
                  ).map((item) => (
                    <button
                      key={item.cmd}
                      onClick={() => {
                        engine?.issueSquadCommand(item.cmd);
                        setSquadDrawerOpen(false);
                      }}
                      className={`text-left px-1.5 py-1 rounded text-[9px] sm:text-[10px] font-semibold cursor-pointer ${
                        hud.activeSquadCommand === item.cmd
                          ? 'bg-[#00E5FF] text-slate-950'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top-Center: Match Timer, Alive Count, Eliminations, Safe-Zone / Round Banner */}
        <div className="flex flex-col items-center gap-1 min-w-0 flex-1 px-1">
          <div className="pointer-events-auto bg-[#0B1320]/88 border border-white/15 rounded-xl px-2 py-1 sm:px-3.5 sm:py-1.5 flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs whitespace-nowrap">
            {hud.mode === 'clash_arena' ? (
              <>
                <span className="font-display font-bold text-[#00E5FF]">
                  TM {hud.arenaPlayerScore}
                </span>
                <span className="font-mono-num font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded">
                  R{hud.arenaRound} · {hud.arenaRoundTimerSec}s
                </span>
                <span className="font-display font-bold text-rose-400">
                  {hud.arenaRivalScore} RVL
                </span>
              </>
            ) : (
              <>
                <span className="font-mono-num text-slate-200">
                  <strong className="text-white">
                    {formatTimer(hud.matchTimeSec)}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-slate-200">
                  ALIVE{' '}
                  <strong className="text-[#FDE047]">
                    {hud.aliveCount}/{hud.totalContestants}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-slate-200">
                  ELIMS{' '}
                  <strong className="text-[#00E5FF]">{hud.eliminations}</strong>
                </span>
              </>
            )}
          </div>

          {/* Safe-Zone Status or Arena Banner */}
          {(hud.mode === 'br_solo' || hud.mode === 'br_squad') && (
            <div
              className={`px-2 py-0.5 rounded-lg text-[9px] sm:text-[11px] font-bold tracking-wide border text-center max-w-full truncate ${
                hud.outsideZoneWarning
                  ? 'bg-rose-950/90 border-rose-400 text-rose-200'
                  : 'bg-[#0B1320]/80 border-white/15 text-[#FDE047]'
              }`}
            >
              {hud.outsideZoneWarning
                ? 'OUTSIDE SAFE ZONE — MOVE TO RING!'
                : `STAGE ${hud.zoneStage} · ${hud.zoneStatusText}`}
            </div>
          )}

          {hud.mode === 'clash_arena' && hud.arenaBannerText && (
            <div className="px-2.5 py-0.5 rounded-lg bg-[#0B1320]/85 border border-[#FF6B1A] text-[10px] sm:text-xs font-display font-bold text-[#FDE047] truncate max-w-full">
              {hud.arenaBannerText}
            </div>
          )}

          {/* Contextual Squad Status Message */}
          {hud.mode === 'br_squad' && (
            <div className="hidden sm:block text-[10px] text-cyan-300 bg-[#0B1320]/75 px-2 py-0.5 rounded truncate max-w-xs">
              {hud.squadStatusMessage}
            </div>
          )}
        </div>

        {/* Top-Right: Kill Feed, Inventory Toggle, Arena Shop & Pause */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="pointer-events-auto flex items-center gap-1 sm:gap-2">
            {showFps && (
              <span className="hidden md:inline-block font-mono-num text-[10px] text-emerald-400 bg-[#0B1320]/80 px-2 py-1 rounded border border-white/10">
                {hud.fps} FPS
              </span>
            )}

            {hud.mode === 'clash_arena' && (
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setArenaShopOpen((v) => !v);
                }}
                className="h-8 sm:h-10 px-2 sm:px-3 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] sm:text-xs flex items-center gap-1 cursor-pointer shrink-0"
              >
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                <span>{hud.arenaCredits} Cr</span>
              </button>
            )}

            <button
              onClick={() => {
                soundEngine.playClick();
                setInventoryOpen((v) => !v);
              }}
              aria-label="Open Backpack"
              className="w-8 h-8 sm:w-auto sm:h-10 sm:px-2.5 rounded-lg bg-[#0B1320]/88 border border-white/20 text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Backpack className="w-4 h-4 text-[#00E5FF] shrink-0" />
              <span className="hidden sm:inline">Bag</span>
            </button>

            <button
              onClick={() => {
                soundEngine.playClick();
                engine?.setPaused(hud.phase !== 'paused');
              }}
              aria-label="Pause Game"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#0B1320]/88 border border-white/20 flex items-center justify-center text-white cursor-pointer shrink-0"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* Kill Feed */}
          <div className="space-y-1 text-right max-w-[140px] sm:max-w-[220px]">
            {hud.killFeed.map((kf) => (
              <div
                key={kf.id}
                className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-[#0B1320]/80 border truncate ${
                  kf.isPlayer
                    ? 'border-[#FF6B1A] text-[#FDE047]'
                    : 'border-white/10 text-slate-300'
                }`}
              >
                {kf.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TRAINING GROUNDS FLOATING TRIAL BAR */}
      {hud.mode === 'training' && (
        <div className="pointer-events-auto self-center bg-[#0B1320]/90 border border-[#00E5FF]/50 rounded-xl p-2 max-w-xl w-[96%] z-10">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-display text-[10px] sm:text-xs font-bold text-[#00E5FF] truncate">
              TRAINING GROUNDS — SELECT TRIAL
            </span>
            <span className="font-mono-num text-[10px] sm:text-xs text-[#FDE047] shrink-0">
              Timer: {hud.training.currentTimerSec}s
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1 mb-1.5">
            {hud.training.trials.map((tr, idx) => (
              <button
                key={tr.id}
                onClick={() => engine?.selectTrainingTrial(idx)}
                className={`px-1.5 py-1 rounded text-[9px] sm:text-[10px] font-bold truncate cursor-pointer ${
                  hud.training.activeTrialIndex === idx
                    ? 'bg-[#FF6B1A] text-white'
                    : tr.completed
                    ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-400/40'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {idx + 1}. {tr.completed ? '✓ ' : ''}
                {tr.name.replace(/^\d+\.\s*/, '')}
              </button>
            ))}
          </div>
          {hud.training.trials[hud.training.activeTrialIndex] && (
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-200 bg-slate-900/90 rounded-lg px-2.5 py-1">
              <span className="truncate">
                {hud.training.trials[hud.training.activeTrialIndex].instruction}
              </span>
              <span className="font-mono-num font-bold text-[#00E5FF] ml-2 shrink-0">
                {hud.training.trials[hud.training.activeTrialIndex].progress}/
                {hud.training.trials[hud.training.activeTrialIndex].target}
              </span>
            </div>
          )}
        </div>
      )}

      {/* CONTEXT-SENSITIVE CENTER PROMPTS (DEPLOYMENT JUMP, LOOT PICKUP, VEHICLE, REVIVE) */}
      <div className="relative z-10 flex flex-col items-center gap-1.5 my-auto pointer-events-none px-2">
        {hud.phase === 'deployment' && (
          <button
            onClick={() => engine?.deployFromAircraft()}
            className="pointer-events-auto px-5 py-3 sm:px-8 sm:py-4 rounded-2xl bg-[#FF6B1A] hover:bg-[#F97316] border-2 border-[#FEF08A] text-white font-display font-bold text-sm sm:text-lg tracking-wider shadow-lg cursor-pointer"
          >
            EJECT & DEPLOY GLIDER
          </button>
        )}

        {hud.stance === 'parachuting' && hud.phase === 'active' && (
          <div className="bg-[#0B1320]/85 border border-[#00E5FF] rounded-xl px-3 py-1.5 text-[11px] sm:text-xs text-white font-semibold text-center">
            Gliding to Sunset Island · Altitude{' '}
            <span className="font-mono-num text-[#FDE047]">
              {Math.round(hud.playerPos.y)}m
            </span>
          </div>
        )}

        {hud.nearbyLoot && hud.phase === 'active' && (
          <button
            onClick={() => engine?.pickUpNearbySupply()}
            className="pointer-events-auto px-4 py-2 sm:px-5 sm:py-3 rounded-xl bg-[#0B1320]/92 border-2 flex items-center gap-2 text-left cursor-pointer"
            style={{ borderColor: RARITY_COLORS[hud.nearbyLoot.rarity] }}
          >
            <div
              className="w-2.5 h-7 rounded-sm shrink-0"
              style={{ backgroundColor: RARITY_COLORS[hud.nearbyLoot.rarity] }}
            />
            <div>
              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-300">
                TAP TO PICK UP (F)
              </div>
              <div className="text-xs sm:text-sm font-bold text-white">
                {hud.nearbyLoot.name}
              </div>
            </div>
          </button>
        )}

        {(hud.nearVehicle || hud.inVehicle) && hud.phase === 'active' && (
          <button
            onClick={() => engine?.toggleVehicleEnterExit()}
            className="pointer-events-auto px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
          >
            <Car className="w-4 h-4 shrink-0" />
            {hud.inVehicle ? 'EXIT ISLAND ROVER' : 'DRIVE ISLAND ROVER'}
          </button>
        )}

        {hud.nearbyDownedAllyName && (
          <div className="bg-emerald-950/90 border border-emerald-400 rounded-xl px-3 py-1.5 text-xs text-emerald-200 font-bold">
            Assisting {hud.nearbyDownedAllyName}...{' '}
            {Math.round(hud.reviveProgress * 100)}%
          </div>
        )}
      </div>

      {/* BOTTOM REGION: RESPONSIVE THUMB CONTROLS & VITALS (100% INSIDE VIEWPORT) */}
      <div className="relative z-10 flex flex-col gap-1.5 w-full min-w-0">
        {/* On Portrait / Narrow Screens (<640px), show Vitals & Weapons above thumb controls so Left + Right buttons never overflow */}
        <div className="pointer-events-auto flex sm:hidden flex-col items-center gap-1 w-full max-w-sm mx-auto">
          {renderVitalsAndWeapons()}
        </div>

        <div className="flex items-end justify-between gap-1.5 sm:gap-2 w-full min-w-0">
          {/* Bottom-Left: Multi-Touch Virtual Joystick + Quick Heal */}
          <div className="flex items-end gap-1.5 sm:gap-2.5 shrink-0">
            <div
              ref={joystickContainerRef}
              onTouchStart={handleJoystickTouchStart}
              onTouchMove={handleJoystickTouchMove}
              onTouchEnd={handleJoystickTouchEnd}
              onTouchCancel={handleJoystickTouchEnd}
              className="pointer-events-auto w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-[#0B1320]/65 border-2 border-white/25 relative flex items-center justify-center touch-none shrink-0"
            >
              <div className="w-2 h-2 rounded-full bg-white/30" />
              <div
                className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-[#FF6B1A]/90 border-2 border-[#FEF08A] pointer-events-none"
                style={{
                  transform: `translate3d(${joystickKnob.x}px, ${joystickKnob.y}px, 0)`,
                }}
              />
            </div>

            {/* Quick Heal & Shield Buttons */}
            <div className="pointer-events-auto flex flex-col gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={() => engine?.useHealingItem('medkit')}
                disabled={hud.medKits <= 0}
                className="min-w-[42px] sm:min-w-[50px] h-8 sm:h-10 px-2 rounded-xl bg-[#0B1320]/88 border border-emerald-400/50 text-[10px] sm:text-xs font-bold text-emerald-300 flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="font-mono-num">{hud.medKits}</span>
              </button>

              <button
                onClick={() => engine?.useHealingItem('shield')}
                disabled={hud.shieldCells <= 0}
                className="min-w-[42px] sm:min-w-[50px] h-8 sm:h-10 px-2 rounded-xl bg-[#0B1320]/88 border border-cyan-400/50 text-[10px] sm:text-xs font-bold text-cyan-300 flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="font-mono-num">{hud.shieldCells}</span>
              </button>
            </div>
          </div>

          {/* Bottom-Center (Landscape >=640px): Health, Shield, Armor Level & Equipped Projectors */}
          <div className="pointer-events-auto hidden sm:flex flex-col items-center gap-1.5 flex-1 min-w-[140px] max-w-[260px] md:max-w-md px-1">
            {renderVitalsAndWeapons()}
          </div>

          {/* Bottom-Right: Thumb Action Cluster (Fire, Aim, Jump, Crouch, Prone, Reload) */}
          <div className="pointer-events-auto flex items-end gap-1 sm:gap-2 shrink-0">
            <div className="flex flex-col gap-1 sm:gap-1.5">
              <button
                onClick={() => engine?.triggerReload()}
                aria-label="Reload"
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#0B1320]/88 border border-white/20 text-[11px] font-bold text-slate-200 flex items-center justify-center cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={() => {
                  if (!engine) return;
                  engine.input.aiming = !engine.input.aiming;
                }}
                aria-label="Aim"
                className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl border text-[11px] font-bold flex items-center justify-center cursor-pointer ${
                  hud.isAiming
                    ? 'bg-[#00E5FF] border-white text-slate-950'
                    : 'bg-[#0B1320]/88 border-white/20 text-slate-200'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Primary Hold-to-Fire Thumb Button */}
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                if (engine) engine.input.firing = true;
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (engine) engine.input.firing = false;
              }}
              onPointerLeave={() => {
                if (engine) engine.input.firing = false;
              }}
              onPointerCancel={() => {
                if (engine) engine.input.firing = false;
              }}
              className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-[#FF6B1A]/90 active:bg-[#EA580C] border-2 border-[#FEF08A] text-white font-display font-bold text-xs sm:text-sm flex items-center justify-center select-none touch-none cursor-pointer shrink-0"
            >
              FIRE
            </button>

            <div className="flex flex-col gap-1 sm:gap-1.5">
              <button
                onClick={() => engine?.triggerJump()}
                className="min-w-[44px] sm:min-w-[52px] h-7 sm:h-10 px-1.5 rounded-lg sm:rounded-xl bg-[#0B1320]/88 border border-white/25 text-[9px] sm:text-[11px] font-bold text-white cursor-pointer"
              >
                JUMP
              </button>
              <button
                onClick={() => engine?.toggleCrouch()}
                className={`min-w-[44px] sm:min-w-[52px] h-7 sm:h-10 px-1.5 rounded-lg sm:rounded-xl border text-[9px] sm:text-[11px] font-bold cursor-pointer ${
                  hud.stance === 'crouching'
                    ? 'bg-amber-500 border-white text-slate-950'
                    : 'bg-[#0B1320]/88 border-white/20 text-slate-200'
                }`}
              >
                CROUCH
              </button>
              <button
                onClick={() => engine?.toggleProne()}
                className={`min-w-[44px] sm:min-w-[52px] h-7 sm:h-10 px-1.5 rounded-lg sm:rounded-xl border text-[9px] sm:text-[11px] font-bold cursor-pointer ${
                  hud.stance === 'prone'
                    ? 'bg-amber-500 border-white text-slate-950'
                    : 'bg-[#0B1320]/88 border-white/20 text-slate-200'
                }`}
              >
                PRONE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: INVENTORY PANEL */}
      {inventoryOpen && (
        <div className="pointer-events-auto fixed inset-0 z-30 bg-[#0B1320]/85 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-white/20 rounded-2xl p-4 max-w-md w-full space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display font-bold text-base text-white">
                Tactical Backpack & Inventory
              </h3>
              <button
                onClick={() => setInventoryOpen(false)}
                className="px-3 py-1 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-900 border border-white/10 rounded-xl p-3">
                <div className="text-slate-400">Primary Equipped Projector</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {hud.weapons[0]?.name || 'None'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Clip {hud.currentClip[0]} · Reserve Energy {hud.reserveAmmo}
                </div>
              </div>

              {hud.weapons[1] && (
                <div className="bg-slate-900 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-slate-400">Secondary Slot</div>
                    <div className="text-sm font-bold text-white">
                      {hud.weapons[1].name}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      engine?.switchWeaponSlot(1);
                      setInventoryOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#FF6B1A] text-white font-bold cursor-pointer"
                  >
                    Equip
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-900 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="font-mono-num text-sm font-bold text-emerald-400">
                    {hud.medKits}
                  </div>
                  <div className="text-[11px] text-slate-400">Med-Kits</div>
                </div>
                <div className="bg-slate-900 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="font-mono-num text-sm font-bold text-cyan-400">
                    Lv.{hud.armorLevel}
                  </div>
                  <div className="text-[11px] text-slate-400">Protection</div>
                </div>
                <div className="bg-slate-900 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="font-mono-num text-sm font-bold text-amber-300">
                    {hud.coverGadgets}
                  </div>
                  <div className="text-[11px] text-slate-400">Cover Walls</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CLASH ARENA ROUND ECONOMY BUY SHOP */}
      {(arenaShopOpen ||
        (hud.mode === 'clash_arena' && hud.phase === 'prep_buy')) && (
        <div className="pointer-events-auto fixed inset-0 z-30 bg-[#0B1320]/80 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border-2 border-[#FF6B1A] rounded-2xl p-4 max-w-xl w-full space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div>
                <h3 className="font-display font-bold text-base text-white">
                  Clash Arena Round {hud.arenaRound} Armory
                </h3>
                <p className="text-xs text-slate-300">
                  Available Budget:{' '}
                  <strong className="font-mono-num text-[#FDE047]">
                    {hud.arenaCredits} Credits
                  </strong>{' '}
                  {hud.phase === 'prep_buy'
                    ? `· Round starts in ${hud.arenaPrepTimerSec}s`
                    : ''}
                </p>
              </div>
              <button
                onClick={() => setArenaShopOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-white cursor-pointer"
              >
                Ready / Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {Object.values(EQUIPMENT_CATALOG).map((eq) => (
                <button
                  key={eq.id}
                  onClick={() => engine?.buyArenaItem(eq.id)}
                  disabled={hud.arenaCredits < eq.arenaCost}
                  className="p-2.5 rounded-xl bg-slate-900 border border-white/10 hover:border-white/30 disabled:opacity-40 flex items-center justify-between text-left cursor-pointer"
                >
                  <div>
                    <div
                      className="text-xs font-bold"
                      style={{ color: eq.color }}
                    >
                      {eq.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono-num">
                      DMG {eq.damage} · RNG {eq.effectiveRange}m
                    </div>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-[#FDE047]">
                    {eq.arenaCost} Cr
                  </span>
                </button>
              ))}

              <button
                onClick={() => engine?.buyArenaItem('shield_full')}
                disabled={hud.arenaCredits < 250}
                className="p-2.5 rounded-xl bg-slate-900 border border-cyan-500/30 flex items-center justify-between text-left cursor-pointer disabled:opacity-40"
              >
                <div>
                  <div className="text-xs font-bold text-[#00E5FF]">
                    Full Ion Shield Recharge
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Restores Shield to 100
                  </div>
                </div>
                <span className="font-mono-num text-xs font-bold text-[#FDE047]">
                  250 Cr
                </span>
              </button>

              <button
                onClick={() => engine?.buyArenaItem('cover_pack')}
                disabled={hud.arenaCredits < 200}
                className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-between text-left cursor-pointer disabled:opacity-40"
              >
                <div>
                  <div className="text-xs font-bold text-amber-300">
                    Aegis Cover Barrier (x2)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Deployable energy cover walls
                  </div>
                </div>
                <span className="font-mono-num text-xs font-bold text-[#FDE047]">
                  200 Cr
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPECTATOR MODE OVERLAY BAR */}
      {hud.phase === 'spectating' && (
        <div className="pointer-events-auto fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-[#0B1320]/94 border-2 border-[#00E5FF] rounded-2xl px-5 py-3 flex items-center gap-4">
          <button
            onClick={() => engine?.cycleSpectatorTarget(-1)}
            className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center min-w-[160px]">
            <div className="text-[10px] font-bold text-[#00E5FF] flex items-center justify-center gap-1">
              <Eye className="w-3.5 h-3.5" /> SPECTATING CONTESTANT
            </div>
            <div className="text-sm font-bold text-white">
              {hud.spectatingTargetName} ({hud.spectatingTargetHealth} HP)
            </div>
            <div className="text-[11px] text-slate-400">
              {hud.aliveCount} Contestants Remaining
            </div>
          </div>

          <button
            onClick={() => engine?.cycleSpectatorTarget(1)}
            className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => engine?.finishSpectatingToResults()}
            className="px-3.5 py-2 rounded-xl bg-[#FF6B1A] text-white font-bold text-xs cursor-pointer"
          >
            Match Results
          </button>
        </div>
      )}

      {/* PAUSE MODAL */}
      {hud.phase === 'paused' && (
        <div className="pointer-events-auto fixed inset-0 z-40 bg-[#0B1320]/88 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-white/20 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
            <h2 className="font-display text-2xl font-bold text-white">
              MATCH PAUSED
            </h2>
            <p className="text-xs text-slate-400">
              Controls: Virtual Touch Joystick + Look Zone, or WASD + Mouse,
              Space Jump, C Crouch, Z Prone, F Pick Up / Drive.
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => engine?.setPaused(false)}
                className="w-full py-3 rounded-xl bg-[#FF6B1A] text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> Resume Match
              </button>
              <button
                onClick={onRestartMatch}
                className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Restart Match
              </button>
              <button
                onClick={onReturnToLobby}
                className="w-full py-3 rounded-xl bg-slate-900 border border-white/15 text-slate-300 font-bold text-sm cursor-pointer"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / DEFEAT MATCH RESULTS SCREEN */}
      {(hud.phase === 'victory' || hud.phase === 'defeat') && (
        <div className="pointer-events-auto fixed inset-0 z-40 bg-[#0B1320]/92 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border-2 border-[#FF6B1A] rounded-2xl p-6 max-w-md w-full text-center space-y-4">
            <div className="text-xs font-bold tracking-widest text-[#00E5FF]">
              {hud.mode === 'clash_arena'
                ? 'SUNSET YARD CLASH ARENA'
                : 'SUNSET ISLAND BATTLE ROYALE'}
            </div>
            <h2
              className={`font-display text-3xl font-bold ${
                hud.phase === 'victory' ? 'text-[#FDE047]' : 'text-rose-400'
              }`}
            >
              {hud.phase === 'victory'
                ? 'WINNER! CLASSIC VICTORY'
                : 'MATCH COMPLETED'}
            </h2>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-slate-900 border border-white/10 rounded-xl p-3">
                <div className="font-mono-num text-lg font-bold text-white">
                  {hud.phase === 'victory' ? '#1' : `#${hud.aliveCount + 1}`}
                </div>
                <div className="text-[11px] text-slate-400">Placement</div>
              </div>
              <div className="bg-slate-900 border border-white/10 rounded-xl p-3">
                <div className="font-mono-num text-lg font-bold text-[#00E5FF]">
                  {hud.eliminations}
                </div>
                <div className="text-[11px] text-slate-400">Eliminations</div>
              </div>
              <div className="bg-slate-900 border border-white/10 rounded-xl p-3">
                <div className="font-mono-num text-lg font-bold text-emerald-400">
                  {formatTimer(hud.matchTimeSec)}
                </div>
                <div className="text-[11px] text-slate-400">Duration</div>
              </div>
            </div>

            <div className="text-xs text-slate-300">
              Supplies Collected: <strong>{hud.suppliesCollectedCount}</strong>{' '}
              · Progression & Match History saved locally.
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onRestartMatch}
                className="flex-1 py-3 rounded-xl bg-[#FF6B1A] hover:bg-[#F97316] text-white font-display font-bold text-sm cursor-pointer"
              >
                PLAY AGAIN
              </button>
              <button
                onClick={onReturnToLobby}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-display font-bold text-sm cursor-pointer"
              >
                RETURN TO LOBBY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
