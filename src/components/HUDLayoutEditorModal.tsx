import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GameSettings,
  HUDControlId,
  HUDElementConfig,
} from '../types/game';
import {
  DEFAULT_HUD_LAYOUT,
  cloneDefaultHUDLayout,
} from '../services/storage';
import { soundEngine } from '../services/audio';
import {
  AlertTriangle,
  Check,
  Crosshair,
  Eye,
  EyeOff,
  Move,
  RotateCcw,
  Sliders,
  X,
} from 'lucide-react';

interface HUDLayoutEditorModalProps {
  settings: GameSettings;
  onSaveSettings: (nextSettings: GameSettings) => void;
  onClose: () => void;
}

export const HUD_CONTROL_META: Record<
  HUDControlId,
  {
    label: string;
    shortLabel: string;
    baseWidth: number;
    baseHeight: number;
    isCore?: boolean;
    shape: 'circle' | 'pill' | 'box';
  }
> = {
  joystick: {
    label: 'Movement Joystick',
    shortLabel: 'MOVE',
    baseWidth: 96,
    baseHeight: 96,
    isCore: true,
    shape: 'circle',
  },
  fire: {
    label: 'Primary Fire / Shoot',
    shortLabel: 'FIRE',
    baseWidth: 74,
    baseHeight: 74,
    isCore: true,
    shape: 'circle',
  },
  aim: {
    label: 'Crossbow Scope / Aim',
    shortLabel: 'AIM',
    baseWidth: 48,
    baseHeight: 48,
    shape: 'circle',
  },
  jump: {
    label: 'Jump / Vault',
    shortLabel: 'JUMP',
    baseWidth: 54,
    baseHeight: 38,
    shape: 'pill',
  },
  sprint: {
    label: 'Sprint Lock',
    shortLabel: 'RUN',
    baseWidth: 50,
    baseHeight: 36,
    shape: 'pill',
  },
  crouch: {
    label: 'Crouch Toggle',
    shortLabel: 'CROUCH',
    baseWidth: 56,
    baseHeight: 36,
    shape: 'pill',
  },
  prone: {
    label: 'Prone Toggle',
    shortLabel: 'PRONE',
    baseWidth: 54,
    baseHeight: 36,
    shape: 'pill',
  },
  reload: {
    label: 'Reload / Recharge',
    shortLabel: 'RELOAD',
    baseWidth: 46,
    baseHeight: 46,
    shape: 'circle',
  },
  weapon_switch: {
    label: 'Weapon Loadout Bar',
    shortLabel: 'WEAPONS / HP',
    baseWidth: 210,
    baseHeight: 68,
    isCore: true,
    shape: 'box',
  },
  heal: {
    label: 'Med-Kit & Shield',
    shortLabel: 'HEAL / SHIELD',
    baseWidth: 54,
    baseHeight: 74,
    shape: 'box',
  },
  interact: {
    label: 'Pickup / Drive / Action',
    shortLabel: 'INTERACT (F)',
    baseWidth: 140,
    baseHeight: 44,
    shape: 'pill',
  },
  inventory: {
    label: 'Backpack / Inventory',
    shortLabel: 'BAG',
    baseWidth: 50,
    baseHeight: 40,
    shape: 'pill',
  },
  minimap: {
    label: 'Radar Minimap',
    shortLabel: 'MINIMAP',
    baseWidth: 92,
    baseHeight: 104,
    shape: 'box',
  },
  cover: {
    label: 'Aegis Cover Gadget',
    shortLabel: 'COVER',
    baseWidth: 56,
    baseHeight: 40,
    shape: 'pill',
  },
};

export function clampControlPixelPosition(
  xPct: number,
  yPct: number,
  widthPx: number,
  heightPx: number,
  viewportW: number,
  viewportH: number
): { left: number; top: number; centerX: number; centerY: number } {
  const safePadX = 8;
  const safePadY = 8;
  const halfW = widthPx / 2;
  const halfH = heightPx / 2;

  const rawCenterX = (xPct / 100) * viewportW;
  const rawCenterY = (yPct / 100) * viewportH;

  const minX = safePadX + halfW;
  const maxX = Math.max(minX, viewportW - safePadX - halfW);
  const minY = safePadY + halfH;
  const maxY = Math.max(minY, viewportH - safePadY - halfH);

  const centerX = Math.max(minX, Math.min(maxX, rawCenterX));
  const centerY = Math.max(minY, Math.min(maxY, rawCenterY));

  return {
    left: centerX - halfW,
    top: centerY - halfH,
    centerX,
    centerY,
  };
}

export const HUDLayoutEditorModal: React.FC<HUDLayoutEditorModalProps> = ({
  settings,
  onSaveSettings,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 800,
    h: typeof window !== 'undefined' ? window.innerHeight : 450,
  });

  const [draftLayout, setDraftLayout] = useState<
    Record<HUDControlId, HUDElementConfig>
  >(() => {
    const clone = cloneDefaultHUDLayout();
    for (const id of Object.keys(clone) as HUDControlId[]) {
      if (settings.hudLayout && settings.hudLayout[id]) {
        clone[id] = { ...settings.hudLayout[id] };
      }
    }
    return clone;
  });

  const [globalScale, setGlobalScale] = useState<number>(
    settings.hudScale || 1.0
  );
  const [globalOpacity, setGlobalOpacity] = useState<number>(
    settings.hudOpacity || 0.92
  );
  const [selectedId, setSelectedId] = useState<HUDControlId>('fire');
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);

  const draggingRef = useRef<{
    id: HUDControlId;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    const updateSize = () => {
      setViewport({
        w: window.innerWidth,
        h: window.innerHeight,
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const responsiveFactor =
    viewport.w < 480 ? 0.78 : viewport.w < 768 ? 0.88 : 1.0;

  // Detect overlapping controls
  const overlappingIds = useMemo(() => {
    const set = new Set<HUDControlId>();
    const ids = (Object.keys(draftLayout) as HUDControlId[]).filter(
      (k) => draftLayout[k].visible
    );
    const boxes = ids.map((id) => {
      const cfg = draftLayout[id];
      const meta = HUD_CONTROL_META[id];
      const totalScale = cfg.scale * globalScale * responsiveFactor;
      const w = meta.baseWidth * totalScale;
      const h = meta.baseHeight * totalScale;
      const pos = clampControlPixelPosition(
        cfg.xPct,
        cfg.yPct,
        w,
        h,
        viewport.w,
        viewport.h
      );
      return {
        id,
        left: pos.left,
        right: pos.left + w,
        top: pos.top,
        bottom: pos.top + h,
      };
    });

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 10 && overlapY > 10) {
          set.add(a.id);
          set.add(b.id);
        }
      }
    }
    return set;
  }, [draftLayout, globalScale, responsiveFactor, viewport]);

  const handleControlPointerDown = (
    id: HUDControlId,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(id);

    const cfg = draftLayout[id];
    const meta = HUD_CONTROL_META[id];
    const totalScale = cfg.scale * globalScale * responsiveFactor;
    const w = meta.baseWidth * totalScale;
    const h = meta.baseHeight * totalScale;
    const pos = clampControlPixelPosition(
      cfg.xPct,
      cfg.yPct,
      w,
      h,
      viewport.w,
      viewport.h
    );

    draggingRef.current = {
      id,
      pointerId: e.pointerId,
      offsetX: e.clientX - pos.centerX,
      offsetY: e.clientY - pos.centerY,
    };
  };

  const handleControlPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();

    const id = drag.id;
    const cfg = draftLayout[id];
    const meta = HUD_CONTROL_META[id];
    const totalScale = cfg.scale * globalScale * responsiveFactor;
    const w = meta.baseWidth * totalScale;
    const h = meta.baseHeight * totalScale;

    const targetCenterX = e.clientX - drag.offsetX;
    const targetCenterY = e.clientY - drag.offsetY;

    const rawXPct = (targetCenterX / Math.max(1, viewport.w)) * 100;
    const rawYPct = (targetCenterY / Math.max(1, viewport.h)) * 100;

    const clamped = clampControlPixelPosition(
      rawXPct,
      rawYPct,
      w,
      h,
      viewport.w,
      viewport.h
    );

    const finalXPct = Number(
      ((clamped.centerX / Math.max(1, viewport.w)) * 100).toFixed(2)
    );
    const finalYPct = Number(
      ((clamped.centerY / Math.max(1, viewport.h)) * 100).toFixed(2)
    );

    setDraftLayout((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        xPct: finalXPct,
        yPct: finalYPct,
      },
    }));
  };

  const handleControlPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current && draggingRef.current.pointerId === e.pointerId) {
      draggingRef.current = null;
    }
  };

  const selectedConfig = draftLayout[selectedId];
  const selectedMeta = HUD_CONTROL_META[selectedId];

  const handleResetSingle = () => {
    soundEngine.playClick();
    const def = DEFAULT_HUD_LAYOUT[selectedId];
    setDraftLayout((prev) => ({
      ...prev,
      [selectedId]: { ...def },
    }));
  };

  const handleRestoreDefaults = () => {
    soundEngine.playClick();
    setDraftLayout(cloneDefaultHUDLayout());
    setGlobalScale(1.0);
    setGlobalOpacity(0.92);
  };

  const handleSave = () => {
    soundEngine.playClick();
    onSaveSettings({
      ...settings,
      hudScale: globalScale,
      hudOpacity: globalOpacity,
      hudLayout: draftLayout,
    });
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#070C15]/92 pointer-events-auto select-none overflow-hidden gameplay-touch-none"
    >
      {/* Subtle Screen Safe-Zone Grid & Center Crosshair Reference */}
      <div className="fixed inset-2 border border-dashed border-cyan-400/30 rounded-xl pointer-events-none" />
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-8 h-8 rounded-full border border-white/25 flex items-center justify-center">
          <Crosshair className="w-4 h-4 text-[#00E5FF]/70" />
        </div>
      </div>

      {/* Render All 14 Draggable HUD Elements */}
      {(Object.keys(draftLayout) as HUDControlId[]).map((id) => {
        const cfg = draftLayout[id];
        const meta = HUD_CONTROL_META[id];
        const totalScale = cfg.scale * globalScale * responsiveFactor;
        const w = Math.round(meta.baseWidth * totalScale);
        const h = Math.round(meta.baseHeight * totalScale);

        const pos = clampControlPixelPosition(
          cfg.xPct,
          cfg.yPct,
          w,
          h,
          viewport.w,
          viewport.h
        );

        const isSelected = selectedId === id;
        const isOverlapping = overlappingIds.has(id);

        return (
          <div
            key={id}
            onPointerDown={(e) => handleControlPointerDown(id, e)}
            onPointerMove={handleControlPointerMove}
            onPointerUp={handleControlPointerUp}
            onPointerCancel={handleControlPointerUp}
            style={{
              left: `${pos.left}px`,
              top: `${pos.top}px`,
              width: `${w}px`,
              height: `${h}px`,
              opacity: cfg.visible
                ? Math.max(0.25, cfg.opacity * globalOpacity)
                : 0.28,
            }}
            className={`fixed flex flex-col items-center justify-center text-center cursor-move transition-shadow ${
              meta.shape === 'circle'
                ? 'rounded-full'
                : meta.shape === 'pill'
                ? 'rounded-xl'
                : 'rounded-2xl'
            } ${
              isSelected
                ? 'bg-[#FF6B1A]/35 border-2 border-[#FEF08A] ring-2 ring-[#00E5FF]'
                : isOverlapping
                ? 'bg-rose-950/75 border-2 border-rose-400'
                : cfg.visible
                ? 'bg-slate-900/85 border-2 border-cyan-400/60'
                : 'bg-slate-950/60 border border-dashed border-slate-500'
            }`}
          >
            <span className="font-display font-bold text-[10px] sm:text-xs text-white leading-tight px-1 truncate max-w-full">
              {meta.shortLabel}
            </span>
            <span className="font-mono-num text-[8px] sm:text-[9px] text-cyan-300">
              {Math.round(cfg.scale * 100)}%
              {!cfg.visible ? ' · HIDDEN' : ''}
            </span>
          </div>
        );
      })}

      {/* Floating Inspector Panel (Top Center, Compact & Collapsible for Mobile) */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-lg bg-[#0B1320]/96 border border-white/20 rounded-2xl p-2.5 sm:p-3.5 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Move className="w-4 h-4 text-[#FF6B1A] shrink-0" />
            <div className="min-w-0">
              <div className="font-display font-bold text-xs sm:text-sm text-white truncate">
                EDIT HUD LAYOUT — {selectedMeta.label.toUpperCase()}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                Drag any button to reposition · Clamped 100% inside screen
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setInspectorCollapsed((v) => !v)}
              className="px-2 py-1 rounded-lg bg-slate-800 text-[10px] font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <Sliders className="w-3 h-3" />
              {inspectorCollapsed ? 'Expand' : 'Minimize'}
            </button>
            <button
              onClick={handleSave}
              className="px-2.5 py-1 rounded-lg bg-[#FF6B1A] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Cancel HUD Edit"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {overlappingIds.size > 0 && (
          <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-rose-950/90 border border-rose-500/50 text-[10px] text-rose-200 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>
              Overlap detected on {overlappingIds.size} controls. Drag them
              apart for cleaner thumb accuracy.
            </span>
          </div>
        )}

        {!inspectorCollapsed && (
          <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2.5 text-[11px]">
            {/* Selected Control Size & Opacity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-2">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Button Size ({selectedMeta.shortLabel})</span>
                  <span className="font-mono-num text-[#00E5FF]">
                    {Math.round(selectedConfig.scale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.5"
                  step="0.05"
                  value={selectedConfig.scale}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setDraftLayout((prev) => ({
                      ...prev,
                      [selectedId]: {
                        ...prev[selectedId],
                        scale: val,
                      },
                    }));
                  }}
                  className="w-full accent-[#00E5FF]"
                />
              </div>

              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-2">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Button Opacity</span>
                  <span className="font-mono-num text-[#FDE047]">
                    {Math.round(selectedConfig.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="1.0"
                  step="0.05"
                  value={selectedConfig.opacity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setDraftLayout((prev) => ({
                      ...prev,
                      [selectedId]: {
                        ...prev[selectedId],
                        opacity: val,
                      },
                    }));
                  }}
                  className="w-full accent-[#FF6B1A]"
                />
              </div>
            </div>

            {/* Global Scale & Action Row */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                {!selectedMeta.isCore && (
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      setDraftLayout((prev) => ({
                        ...prev,
                        [selectedId]: {
                          ...prev[selectedId],
                          visible: !prev[selectedId].visible,
                        },
                      }));
                    }}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer ${
                      selectedConfig.visible
                        ? 'bg-emerald-950/90 border border-emerald-400/50 text-emerald-200'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {selectedConfig.visible ? (
                      <>
                        <Eye className="w-3.5 h-3.5" /> Visible
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" /> Hidden
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={handleResetSingle}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                >
                  Reset Button
                </button>
              </div>

              <button
                onClick={handleRestoreDefaults}
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/80 border border-rose-400/40 text-rose-200 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Default Layout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
