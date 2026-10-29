import {
  AchievementItem,
  GameSettings,
  HUDControlId,
  HUDElementConfig,
  MatchHistoryRecord,
  OUTFIT_CATALOG,
  SaveDataSchema,
} from '../types/game';

const STORAGE_KEY = 'classic_drop_v2_save_v1';
const CURRENT_HUD_LAYOUT_VERSION = 2;

export const DEFAULT_HUD_LAYOUT: Record<HUDControlId, HUDElementConfig> = {
  minimap: {
    id: 'minimap',
    label: 'Map & Radar',
    xPct: 9,
    yPct: 16,
    scale: 1.0,
    opacity: 0.92,
    visible: true,
    essential: false,
  },
  inventory: {
    id: 'inventory',
    label: 'Backpack / Bag',
    xPct: 86,
    yPct: 8,
    scale: 1.0,
    opacity: 0.92,
    visible: true,
    essential: false,
  },
  joystick: {
    id: 'joystick',
    label: 'Move Joystick',
    xPct: 12,
    yPct: 79,
    scale: 1.0,
    opacity: 0.88,
    visible: true,
    essential: true,
  },
  sprint: {
    id: 'sprint',
    label: 'Sprint Lock',
    xPct: 12,
    yPct: 55,
    scale: 1.0,
    opacity: 0.88,
    visible: true,
    essential: false,
  },
  heal: {
    id: 'heal',
    label: 'Med-Kit & Shield',
    xPct: 25,
    yPct: 82,
    scale: 1.0,
    opacity: 0.92,
    visible: true,
    essential: false,
  },
  weapon_switch: {
    id: 'weapon_switch',
    label: 'Vitals & Weapons',
    xPct: 50,
    yPct: 84,
    scale: 1.0,
    opacity: 0.94,
    visible: true,
    essential: true,
  },
  cover: {
    id: 'cover',
    label: 'Aegis Cover Wall',
    xPct: 68,
    yPct: 84,
    scale: 1.0,
    opacity: 0.92,
    visible: true,
    essential: false,
  },
  interact: {
    id: 'interact',
    label: 'Pickup / Drive',
    xPct: 50,
    yPct: 62,
    scale: 1.0,
    opacity: 0.95,
    visible: true,
    essential: false,
  },
  reload: {
    id: 'reload',
    label: 'Reload',
    xPct: 75,
    yPct: 68,
    scale: 1.0,
    opacity: 0.9,
    visible: true,
    essential: false,
  },
  aim: {
    id: 'aim',
    label: 'Aim / Scope',
    xPct: 75,
    yPct: 83,
    scale: 1.0,
    opacity: 0.92,
    visible: true,
    essential: true,
  },
  fire: {
    id: 'fire',
    label: 'Fire Projector',
    xPct: 85,
    yPct: 79,
    scale: 1.0,
    opacity: 0.95,
    visible: true,
    essential: true,
  },
  jump: {
    id: 'jump',
    label: 'Jump',
    xPct: 94,
    yPct: 64,
    scale: 1.0,
    opacity: 0.92,
    visible: true,
    essential: true,
  },
  crouch: {
    id: 'crouch',
    label: 'Crouch',
    xPct: 94,
    yPct: 76,
    scale: 1.0,
    opacity: 0.9,
    visible: true,
    essential: false,
  },
  prone: {
    id: 'prone',
    label: 'Prone',
    xPct: 94,
    yPct: 88,
    scale: 1.0,
    opacity: 0.9,
    visible: true,
    essential: false,
  },
};

export function cloneDefaultHUDLayout(): Record<HUDControlId, HUDElementConfig> {
  const out = {} as Record<HUDControlId, HUDElementConfig>;
  for (const key of Object.keys(DEFAULT_HUD_LAYOUT) as HUDControlId[]) {
    out[key] = { ...DEFAULT_HUD_LAYOUT[key] };
  }
  return out;
}

export function sanitizeHUDLayout(
  rawLayout?: Partial<Record<HUDControlId, Partial<HUDElementConfig>>>
): Record<HUDControlId, HUDElementConfig> {
  const base = cloneDefaultHUDLayout();
  if (!rawLayout || typeof rawLayout !== 'object') return base;

  for (const key of Object.keys(base) as HUDControlId[]) {
    const def = base[key];
    const incoming = rawLayout[key];
    if (!incoming || typeof incoming !== 'object') continue;

    const xPct = Number(incoming.xPct);
    const yPct = Number(incoming.yPct);
    const scale = Number(incoming.scale);
    const opacity = Number(incoming.opacity);

    base[key] = {
      ...def,
      xPct: Number.isFinite(xPct) ? Math.min(96, Math.max(4, xPct)) : def.xPct,
      yPct: Number.isFinite(yPct) ? Math.min(94, Math.max(5, yPct)) : def.yPct,
      scale: Number.isFinite(scale)
        ? Math.min(1.65, Math.max(0.65, scale))
        : def.scale,
      opacity: Number.isFinite(opacity)
        ? Math.min(1.0, Math.max(0.25, opacity))
        : def.opacity,
      visible: def.essential
        ? true
        : typeof incoming.visible === 'boolean'
        ? incoming.visible
        : def.visible,
    };
  }
  return base;
}

export const DEFAULT_ACHIEVEMENTS: AchievementItem[] = [
  {
    id: 'first_landing',
    title: 'First Landing',
    description: 'Deploy from the sky transport and land on Sunset Island.',
    progress: 0,
    target: 1,
    unlocked: false,
    rewardText: '+100 XP & Classic Gold Frame',
  },
  {
    id: 'first_victory',
    title: 'First Victory',
    description: 'Win a Battle Royale or Clash Arena match.',
    progress: 0,
    target: 1,
    unlocked: false,
    rewardText: 'Crimson Vanguard Outfit',
    rewardOutfitId: 'crimson_blitz',
  },
  {
    id: 'island_explorer',
    title: 'Island Explorer',
    description: 'Visit 5 distinct named regions across Sunset Island.',
    progress: 0,
    target: 5,
    unlocked: false,
    rewardText: 'Aegis Specialist Outfit',
    rewardOutfitId: 'violet_storm',
  },
  {
    id: 'training_graduate',
    title: 'Training Graduate',
    description: 'Complete at least 3 practice trials in Training Grounds.',
    progress: 0,
    target: 3,
    unlocked: false,
    rewardText: '+200 XP & Tactical Backpack',
  },
  {
    id: 'team_player',
    title: 'Team Player',
    description: 'Issue squad commands or assist teammates in 4-Player Squad mode.',
    progress: 0,
    target: 3,
    unlocked: false,
    rewardText: '+150 XP & Neon Cyan Frame',
  },
  {
    id: 'arena_champion',
    title: 'Arena Champion',
    description: 'Win a Best-of-5 match in Clash Arena on Sunset Yard.',
    progress: 0,
    target: 1,
    unlocked: false,
    rewardText: 'Golden Era 2019 Outfit',
    rewardOutfitId: 'cyber_gold',
  },
  {
    id: 'safe_zone_survivor',
    title: 'Safe-Zone Survivor',
    description: 'Survive 3 safe-zone shrink stages across Battle Royale matches.',
    progress: 0,
    target: 3,
    unlocked: false,
    rewardText: '+150 XP & Jetpack Style',
  },
  {
    id: 'collector',
    title: 'Supply Collector',
    description: 'Collect 15 supplies or equipment items across matches.',
    progress: 0,
    target: 15,
    unlocked: false,
    rewardText: '+150 XP & Sunset Flame Frame',
  },
];

export const DEFAULT_SETTINGS: GameSettings = {
  // Graphics
  graphicsPreset: 'MEDIUM',
  shadowsEnabled: true,
  renderResolutionScale: 1.0,
  environmentDetail: 'medium',
  showFps: true,
  // Audio
  masterVolume: 0.9,
  musicVolume: 0.45,
  sfxVolume: 0.75,
  ambientVolume: 0.4,
  muted: false,
  // Aiming & Camera
  cameraSensitivity: 1.0,
  aimingSensitivity: 0.75,
  horizontalSensitivity: 1.0,
  verticalSensitivity: 1.0,
  invertY: false,
  aimBehavior: 'toggle',
  aimAssist: true,
  aimAssistStrength: 0.45,
  crosshairSize: 1.0,
  crosshairOpacity: 0.92,
  crosshairStyle: 'classic_cross',
  // Controls & HUD
  movementSensitivity: 1.0,
  sprintBehavior: 'both',
  hudScale: 1.0,
  hudOpacity: 0.92,
  controlLayout: 'standard',
  hudLayoutVersion: CURRENT_HUD_LAYOUT_VERSION,
  hudLayout: cloneDefaultHUDLayout(),
  // Combat Feedback & Gameplay
  hitMarkersEnabled: true,
  damageNumbersEnabled: true,
  cameraShake: 'low',
  combatEffects: 'medium',
  aiDifficulty: 'NORMAL',
  cameraFov: 62,
  autoPickupInteract: false,
  showAimDebug: false,
  showAiDebug: false,
};

export function getDefaultSaveData(): SaveDataSchema {
  return {
    version: 3,
    playerName: 'SURVIVOR_19',
    level: 1,
    xp: 0,
    ownedOutfits: ['sunset_striker', 'tropic_scout', 'harbor_phantom'],
    selectedOutfitId: 'sunset_striker',
    selectedBackpackStyle: 'standard',
    selectedVictoryPose: 'champion',
    selectedProfileFrame: 'classic_gold',
    stats: {
      totalMatches: 0,
      wins: 0,
      topPlacements: 0,
      totalEliminations: 0,
      trainingCompleted: 0,
      arenaWins: 0,
      suppliesCollected: 0,
      safeZoneSurvivals: 0,
      regionsVisited: [],
    },
    achievements: DEFAULT_ACHIEVEMENTS.map((a) => ({ ...a })),
    matchHistory: [],
    settings: {
      ...DEFAULT_SETTINGS,
      hudLayout: cloneDefaultHUDLayout(),
    },
  };
}

export function loadSaveData(): SaveDataSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSaveData();
    const parsed = JSON.parse(raw) as Partial<SaveDataSchema>;
    const defaults = getDefaultSaveData();

    const mergedAchievements = DEFAULT_ACHIEVEMENTS.map((def) => {
      const existing = parsed.achievements?.find((a) => a.id === def.id);
      return existing
        ? {
            ...def,
            progress: Math.min(def.target, Math.max(0, Number(existing.progress) || 0)),
            unlocked: Boolean(existing.unlocked),
          }
        : { ...def };
    });

    const rawSettings = (parsed.settings || {}) as Partial<GameSettings>;
    const sanitizedHudLayout =
      rawSettings.hudLayoutVersion === CURRENT_HUD_LAYOUT_VERSION
        ? sanitizeHUDLayout(rawSettings.hudLayout)
        : cloneDefaultHUDLayout();

    return {
      version: 3,
      playerName: typeof parsed.playerName === 'string' ? parsed.playerName : defaults.playerName,
      level: Math.max(1, Number(parsed.level) || 1),
      xp: Math.max(0, Number(parsed.xp) || 0),
      ownedOutfits: Array.isArray(parsed.ownedOutfits) && parsed.ownedOutfits.length > 0
        ? Array.from(new Set([...defaults.ownedOutfits, ...parsed.ownedOutfits]))
        : defaults.ownedOutfits,
      selectedOutfitId:
        typeof parsed.selectedOutfitId === 'string' &&
        OUTFIT_CATALOG.some((o) => o.id === parsed.selectedOutfitId)
          ? parsed.selectedOutfitId
          : defaults.selectedOutfitId,
      selectedBackpackStyle: parsed.selectedBackpackStyle || 'standard',
      selectedVictoryPose: parsed.selectedVictoryPose || 'champion',
      selectedProfileFrame: parsed.selectedProfileFrame || 'classic_gold',
      stats: {
        ...defaults.stats,
        ...(parsed.stats || {}),
        regionsVisited: Array.isArray(parsed.stats?.regionsVisited)
          ? parsed.stats!.regionsVisited
          : [],
      },
      achievements: mergedAchievements,
      matchHistory: Array.isArray(parsed.matchHistory)
        ? parsed.matchHistory.slice(0, 25)
        : [],
      settings: {
        ...defaults.settings,
        ...rawSettings,
        hudLayoutVersion: CURRENT_HUD_LAYOUT_VERSION,
        hudLayout: sanitizedHudLayout,
      },
    };
  } catch {
    return getDefaultSaveData();
  }
}

export function saveGameData(data: SaveDataSchema): SaveDataSchema {
  // Recalculate level from XP (every 300 XP = +1 level)
  const calculatedLevel = Math.max(1, Math.floor(data.xp / 300) + 1);
  data.level = calculatedLevel;

  // Unlock level-based outfits
  for (const outfit of OUTFIT_CATALOG) {
    if (data.level >= outfit.unlockLevel && !data.ownedOutfits.includes(outfit.id)) {
      data.ownedOutfits.push(outfit.id);
    }
  }

  // Sync achievements from stats
  const updateAch = (id: string, progressVal: number) => {
    const ach = data.achievements.find((a) => a.id === id);
    if (!ach) return;
    ach.progress = Math.min(ach.target, Math.max(ach.progress, progressVal));
    if (ach.progress >= ach.target && !ach.unlocked) {
      ach.unlocked = true;
      data.xp += 120;
      if (ach.rewardOutfitId && !data.ownedOutfits.includes(ach.rewardOutfitId)) {
        data.ownedOutfits.push(ach.rewardOutfitId);
      }
    }
  };

  updateAch('island_explorer', data.stats.regionsVisited.length);
  updateAch('first_victory', data.stats.wins);
  updateAch('training_graduate', data.stats.trainingCompleted);
  updateAch('arena_champion', data.stats.arenaWins);
  updateAch('safe_zone_survivor', data.stats.safeZoneSurvivals);
  updateAch('collector', data.stats.suppliesCollected);

  data.level = Math.max(1, Math.floor(data.xp / 300) + 1);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
  return { ...data };
}

export function recordMatchResult(
  current: SaveDataSchema,
  record: MatchHistoryRecord,
  extraStats: {
    suppliesCollected: number;
    zonesSurvived: number;
    landed: boolean;
    teamCommandsUsed: number;
    regionsVisited: string[];
  }
): SaveDataSchema {
  // Prevent duplicate history entries by ID
  if (current.matchHistory.some((m) => m.id === record.id)) {
    return current;
  }

  const next: SaveDataSchema = {
    ...current,
    xp: current.xp + record.xpEarned,
    stats: {
      ...current.stats,
      totalMatches: current.stats.totalMatches + 1,
      wins: current.stats.wins + (record.outcome === 'VICTORY' ? 1 : 0),
      topPlacements:
        current.stats.topPlacements + (record.placement <= 5 ? 1 : 0),
      totalEliminations: current.stats.totalEliminations + record.eliminations,
      arenaWins:
        current.stats.arenaWins +
        (record.mode === 'clash_arena' && record.outcome === 'VICTORY' ? 1 : 0),
      suppliesCollected:
        current.stats.suppliesCollected + extraStats.suppliesCollected,
      safeZoneSurvivals:
        current.stats.safeZoneSurvivals + extraStats.zonesSurvived,
      regionsVisited: Array.from(
        new Set([...current.stats.regionsVisited, ...extraStats.regionsVisited])
      ),
    },
    matchHistory: [record, ...current.matchHistory].slice(0, 25),
  };

  if (extraStats.landed) {
    const landingAch = next.achievements.find((a) => a.id === 'first_landing');
    if (landingAch) {
      landingAch.progress = 1;
      if (!landingAch.unlocked) {
        landingAch.unlocked = true;
        next.xp += 100;
      }
    }
  }

  if (extraStats.teamCommandsUsed > 0) {
    const teamAch = next.achievements.find((a) => a.id === 'team_player');
    if (teamAch) {
      teamAch.progress = Math.min(
        teamAch.target,
        teamAch.progress + extraStats.teamCommandsUsed
      );
      if (teamAch.progress >= teamAch.target && !teamAch.unlocked) {
        teamAch.unlocked = true;
        next.xp += 150;
      }
    }
  }

  return saveGameData(next);
}

export function resetAllSaveData(): SaveDataSchema {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  const fresh = getDefaultSaveData();
  saveGameData(fresh);
  return fresh;
}
