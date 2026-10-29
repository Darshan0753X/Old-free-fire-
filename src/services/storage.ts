import {
  AchievementItem,
  GameSettings,
  MatchHistoryRecord,
  OUTFIT_CATALOG,
  SaveDataSchema,
} from '../types/game';

const STORAGE_KEY = 'classic_drop_v2_save_v1';

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
  graphicsPreset: 'MEDIUM',
  shadowsEnabled: true,
  musicVolume: 0.45,
  sfxVolume: 0.75,
  ambientVolume: 0.4,
  muted: false,
  cameraSensitivity: 1.0,
  movementSensitivity: 1.0,
  invertY: false,
  hudScale: 1.0,
  controlLayout: 'standard',
  showFps: true,
};

export function getDefaultSaveData(): SaveDataSchema {
  return {
    version: 2,
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
    settings: { ...DEFAULT_SETTINGS },
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

    return {
      version: 2,
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
        ...(parsed.settings || {}),
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
