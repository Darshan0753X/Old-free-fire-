export type GameMode = 'br_solo' | 'br_squad' | 'clash_arena' | 'training';

export type MatchPhase =
  | 'lobby'
  | 'loading'
  | 'deployment'
  | 'prep_buy'
  | 'active'
  | 'spectating'
  | 'round_end'
  | 'victory'
  | 'defeat'
  | 'paused';

export type LobbyScreen =
  | 'main'
  | 'character'
  | 'collection'
  | 'achievements'
  | 'history'
  | 'settings';

export type GraphicsPreset = 'LOW' | 'MEDIUM' | 'HIGH';

export type SquadCommand =
  | 'follow'
  | 'hold'
  | 'move_marker'
  | 'regroup'
  | 'assist';

export type CharacterStance =
  | 'standing'
  | 'crouching'
  | 'prone'
  | 'parachuting'
  | 'driving'
  | 'downed';

export type CharacterAnimState =
  | 'idle'
  | 'walking'
  | 'running'
  | 'sprinting'
  | 'jumping'
  | 'landing'
  | 'crouching'
  | 'prone'
  | 'aiming'
  | 'using_equipment'
  | 'taking_hit'
  | 'victory'
  | 'defeat';

export type AIState =
  | 'WaitingForDeployment'
  | 'Parachuting'
  | 'Idle'
  | 'Exploring'
  | 'CollectingSupplies'
  | 'Following'
  | 'MovingToDestination'
  | 'Investigating'
  | 'ApproachingEncounter'
  | 'Retreating'
  | 'Regrouping'
  | 'AssistingTeammate'
  | 'MovingToSafeZone'
  | 'Incapacitated'
  | 'Eliminated';

export type RarityTier = 'common' | 'rare' | 'epic' | 'legendary';

export interface EquipmentConfig {
  id: string;
  name: string;
  shortName: string;
  category: string;
  rarity: RarityTier;
  color: string;
  projectileColor: string;
  effectiveRange: number;
  projectileSpeed: number;
  energyCapacity: number;
  reloadTime: number;
  fireCooldown: number;
  damage: number;
  pellets: number;
  spread: number;
  burstCount: number;
  handlingDifficulty: 'Easy' | 'Medium' | 'Skilled';
  arenaCost: number;
  description: string;
}

export type CollectibleType =
  | 'equipment'
  | 'health_kit'
  | 'shield_cell'
  | 'armor_upgrade'
  | 'energy_ammo'
  | 'cover_gadget'
  | 'cosmetic_token';

export interface WorldCollectible {
  id: string;
  type: CollectibleType;
  equipmentId?: string;
  name: string;
  rarity: RarityTier;
  amount: number;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

export interface MapRegion {
  id: string;
  name: string;
  era: 'V1 Core' | 'V2 Expansion';
  x: number;
  z: number;
  radius: number;
  description: string;
  color: string;
}

export interface OutfitConfig {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  hatStyle: 'visor' | 'cap' | 'headband' | 'helmet';
  backpackColor: string;
  unlockLevel: number;
  unlockAchievementId?: string;
  description: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  unlocked: boolean;
  rewardText: string;
  rewardOutfitId?: string;
}

export interface MatchHistoryRecord {
  id: string;
  mode: GameMode;
  modeLabel: string;
  timestamp: string;
  durationSec: number;
  placement: number;
  totalContestants: number;
  eliminations: number;
  outcome: 'VICTORY' | 'DEFEAT';
  arenaScore?: string;
  xpEarned: number;
}

export type HUDControlId =
  | 'joystick'
  | 'aim'
  | 'fire'
  | 'jump'
  | 'sprint'
  | 'crouch'
  | 'prone'
  | 'reload'
  | 'weapon_switch'
  | 'heal'
  | 'interact'
  | 'inventory'
  | 'minimap'
  | 'cover';

export interface HUDElementConfig {
  id: HUDControlId;
  label: string;
  xPct: number; // 0..100 normalized viewport width percentage
  yPct: number; // 0..100 normalized viewport height percentage
  scale: number; // 0.65..1.65
  opacity: number; // 0.25..1.0
  visible: boolean;
  essential?: boolean;
}

export type CrosshairStyle =
  | 'classic_cross'
  | 'dot_ring'
  | 'chevron'
  | 'precision_box';

export type AIDifficulty = 'EASY' | 'NORMAL' | 'HARD';

export type TacticalRole = 'Assault' | 'Support' | 'Scout' | 'Defender';

export type VehicleType = 'rover' | 'sprinter' | 'moto';

export interface VehicleHUDInfo {
  id: string;
  type: VehicleType;
  name: string;
  x: number;
  z: number;
  health: number;
  maxHealth: number;
  speedKmh: number;
  disabled: boolean;
}

export interface CombatDamagePopup {
  id: string;
  value: number;
  isShield: boolean;
  isCritical: boolean;
  screenX: number; // 0..100vw percentage
  screenY: number; // 0..100vh percentage
  createdAt: number;
}

export interface GameSettings {
  // Graphics
  graphicsPreset: GraphicsPreset;
  shadowsEnabled: boolean;
  renderResolutionScale: number;
  environmentDetail: 'low' | 'medium' | 'high';
  showFps: boolean;
  // Audio
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  muted: boolean;
  // Aiming & Camera Sensitivity
  cameraSensitivity: number;
  aimingSensitivity: number;
  horizontalSensitivity: number;
  verticalSensitivity: number;
  invertY: boolean;
  aimBehavior: 'toggle' | 'hold';
  aimAssist: boolean;
  aimAssistStrength: number;
  crosshairSize: number;
  crosshairOpacity: number;
  crosshairStyle: CrosshairStyle;
  // Controls & HUD
  movementSensitivity: number;
  sprintBehavior: 'joystick_push' | 'button' | 'both';
  hudScale: number;
  hudOpacity: number;
  controlLayout: 'standard' | 'compact' | 'wide';
  hudLayoutVersion: number;
  hudLayout: Record<HUDControlId, HUDElementConfig>;
  // Combat Feedback & Gameplay
  hitMarkersEnabled: boolean;
  damageNumbersEnabled: boolean;
  cameraShake: 'off' | 'low' | 'high';
  combatEffects: 'low' | 'medium' | 'high';
  aiDifficulty: AIDifficulty;
  cameraFov: number;
  autoPickupInteract: boolean;
  showAimDebug: boolean;
  showAiDebug: boolean;
}

export interface PlayerProfileStats {
  totalMatches: number;
  wins: number;
  topPlacements: number;
  totalEliminations: number;
  trainingCompleted: number;
  arenaWins: number;
  suppliesCollected: number;
  safeZoneSurvivals: number;
  regionsVisited: string[];
}

export interface SaveDataSchema {
  version: number;
  playerName: string;
  level: number;
  xp: number;
  ownedOutfits: string[];
  selectedOutfitId: string;
  selectedBackpackStyle: 'standard' | 'tactical' | 'jetpack';
  selectedVictoryPose: 'salute' | 'champion' | 'spin';
  selectedProfileFrame: 'classic_gold' | 'neon_cyan' | 'sunset_flame';
  stats: PlayerProfileStats;
  achievements: AchievementItem[];
  matchHistory: MatchHistoryRecord[];
  settings: GameSettings;
}

export interface SquadMemberHUD {
  id: string;
  name: string;
  role: TacticalRole;
  isLeader: boolean;
  isPlayer: boolean;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  stance: CharacterStance;
  aiStateLabel: string;
  color: string;
  x: number;
  z: number;
  downedTimer: number;
  eliminated: boolean;
}

export interface TrainingTrialState {
  activeTrialIndex: number;
  trials: {
    id: string;
    name: string;
    instruction: string;
    completed: boolean;
    bestTimeSec: number | null;
    progress: number;
    target: number;
  }[];
  currentTimerSec: number;
  isRunning: boolean;
}

export interface interfaceHUDStateSnapshot {
  phase: MatchPhase;
  mode: GameMode;
  matchTimeSec: number;
  aliveCount: number;
  totalContestants: number;
  eliminations: number;
  suppliesCollectedCount: number;
  // Player vitals
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  armorLevel: number;
  stance: CharacterStance;
  isAiming: boolean;
  isSprinting: boolean;
  isReloading: boolean;
  reloadProgress: number;
  inVehicle: boolean;
  nearVehicle: boolean;
  activeVehicle: VehicleHUDInfo | null;
  nearbyVehicleName: string | null;
  // Combat Feedback
  hitMarkerActive: boolean;
  hitMarkerIsElim: boolean;
  takingDamageFlash: boolean;
  damagePopups: CombatDamagePopup[];
  // Equipment & Inventory
  weapons: (EquipmentConfig | null)[];
  activeWeaponSlot: 0 | 1;
  currentClip: [number, number];
  reserveAmmo: number;
  medKits: number;
  shieldCells: number;
  coverGadgets: number;
  coverPlacementPreview: boolean;
  coverPlacementValid: boolean;
  // Nearby interaction
  nearbyLoot: WorldCollectible | null;
  nearbyDownedAllyName: string | null;
  reviveProgress: number;
  // Safe Zone
  zoneStage: number;
  zoneStatusText: string;
  zoneTimerSec: number;
  zoneCenter: { x: number; z: number };
  zoneRadius: number;
  nextZoneCenter: { x: number; z: number };
  nextZoneRadius: number;
  outsideZoneWarning: boolean;
  // Minimap & Player coords
  playerPos: { x: number; y: number; z: number; yaw: number };
  currentRegionName: string;
  minimapActors: {
    id: string;
    x: number;
    z: number;
    isAlly: boolean;
    isDowned: boolean;
  }[];
  vehiclesOnMap: VehicleHUDInfo[];
  vehiclePos: { x: number; z: number } | null;
  squadMarker: { x: number; z: number } | null;
  // Squad
  squadMembers: SquadMemberHUD[];
  activeSquadCommand: SquadCommand;
  squadStatusMessage: string;
  // Clash Arena
  arenaRound: number;
  arenaPlayerScore: number;
  arenaRivalScore: number;
  arenaCredits: number;
  arenaPrepTimerSec: number;
  arenaRoundTimerSec: number;
  arenaBannerText: string;
  // Spectator
  spectatingTargetName: string;
  spectatingTargetHealth: number;
  spectatingIndex: number;
  // Training
  training: TrainingTrialState;
  // AI Debug
  aiDebugEntries: {
    id: string;
    name: string;
    role: TacticalRole;
    state: AIState;
    hp: number;
    dist: number;
    targetLabel: string;
  }[];
  // Performance & feed
  fps: number;
  killFeed: { id: string; text: string; isPlayer: boolean }[];
}

export const RARITY_COLORS: Record<RarityTier, string> = {
  common: '#94A3B8',
  rare: '#38BDF8',
  epic: '#A855F7',
  legendary: '#F59E0B',
};

export const EQUIPMENT_CATALOG: Record<string, EquipmentConfig> = {
  rapid_pulse: {
    id: 'rapid_pulse',
    name: 'Rapid Pulse Emitter',
    shortName: 'Pulse SMG',
    category: 'Rapid Pulse Emitter',
    rarity: 'common',
    color: '#38BDF8',
    projectileColor: '#00E5FF',
    effectiveRange: 65,
    projectileSpeed: 72,
    energyCapacity: 28,
    reloadTime: 1.6,
    fireCooldown: 0.12,
    damage: 14,
    pellets: 1,
    spread: 0.012,
    burstCount: 1,
    handlingDifficulty: 'Easy',
    arenaCost: 400,
    description: 'High-rate plasma pulse emitter built for agile mid-close skirmishes.',
  },
  burst_light: {
    id: 'burst_light',
    name: 'Burst-Light Projector',
    shortName: 'Burst Rifle',
    category: 'Burst-Light Projector',
    rarity: 'rare',
    color: '#10B981',
    projectileColor: '#34D399',
    effectiveRange: 95,
    projectileSpeed: 88,
    energyCapacity: 24,
    reloadTime: 1.9,
    fireCooldown: 0.24,
    damage: 21,
    pellets: 1,
    spread: 0.008,
    burstCount: 3,
    handlingDifficulty: 'Medium',
    arenaCost: 650,
    description: 'Balanced 3-pulse tactical projector with crisp mid-range accuracy.',
  },
  close_scatter: {
    id: 'close_scatter',
    name: 'Close-Range Energy Projector',
    shortName: 'Scatter Blaster',
    category: 'Close-Range Energy Projector',
    rarity: 'rare',
    color: '#F43F5E',
    projectileColor: '#FB7185',
    effectiveRange: 34,
    projectileSpeed: 58,
    energyCapacity: 8,
    reloadTime: 2.1,
    fireCooldown: 0.65,
    damage: 11,
    pellets: 6,
    spread: 0.075,
    burstCount: 1,
    handlingDifficulty: 'Easy',
    arenaCost: 600,
    description: 'Projects a 6-bolt fan of high-impact energy ideal for building interiors.',
  },
  charged_arc: {
    id: 'charged_arc',
    name: 'Charged Arc Crossbow',
    shortName: 'Arc Crossbow',
    category: 'Charged Arc Launcher',
    rarity: 'epic',
    color: '#A855F7',
    projectileColor: '#C084FC',
    effectiveRange: 105,
    projectileSpeed: 74,
    energyCapacity: 12,
    reloadTime: 2.3,
    fireCooldown: 0.48,
    damage: 36,
    pellets: 1,
    spread: 0.003,
    burstCount: 1,
    handlingDifficulty: 'Medium',
    arenaCost: 900,
    description: 'Launches heavy ionized arc bolts that disrupt shields on impact.',
  },
  precision_caster: {
    id: 'precision_caster',
    name: 'Precision Energy Crossbow',
    shortName: 'Energy Crossbow',
    category: 'Precision Energy Caster',
    rarity: 'legendary',
    color: '#F59E0B',
    projectileColor: '#FBBF24',
    effectiveRange: 145,
    projectileSpeed: 125,
    energyCapacity: 8,
    reloadTime: 2.5,
    fireCooldown: 0.82,
    damage: 58,
    pellets: 1,
    spread: 0.0,
    burstCount: 1,
    handlingDifficulty: 'Skilled',
    arenaCost: 1100,
    description: 'Long-range hyper-velocity energy crossbow designed for precision overwatch.',
  },
};

export const SUNSET_ISLAND_REGIONS: MapRegion[] = [
  // V1.0 Core 5 Regions
  {
    id: 'central_estate',
    name: 'Central Estate',
    era: 'V1 Core',
    x: 0,
    z: 0,
    radius: 42,
    description: 'Multi-building central plaza with rooftops, stairs, and rich supply crates.',
    color: '#F59E0B',
  },
  {
    id: 'palm_village',
    name: 'Palm Village',
    era: 'V1 Core',
    x: -95,
    z: -75,
    radius: 38,
    description: 'Classic wooden tropical houses, fences, and narrow dirt roads.',
    color: '#10B981',
  },
  {
    id: 'old_harbor',
    name: 'Old Harbor',
    era: 'V1 Core',
    x: 105,
    z: 85,
    radius: 40,
    description: 'Coastal settlement with wooden piers, shipping containers, and warehouses.',
    color: '#38BDF8',
  },
  {
    id: 'green_ridge',
    name: 'Green Ridge',
    era: 'V1 Core',
    x: -85,
    z: 80,
    radius: 40,
    description: 'Elevated green hills, rocky outcrops, and scenic overwatch points.',
    color: '#84CC16',
  },
  {
    id: 'dustyard',
    name: 'Dustyard',
    era: 'V1 Core',
    x: 95,
    z: -80,
    radius: 38,
    description: 'Open industrial storage ground with cargo sheds and perimeter walls.',
    color: '#F97316',
  },
  // V2.0 Expansion 5 Regions
  {
    id: 'coastal_village',
    name: 'Coastal Village',
    era: 'V2 Expansion',
    x: -135,
    z: 5,
    radius: 34,
    description: 'Beachfront stilt bungalows, palm groves, and sandy supply paths.',
    color: '#06B6D4',
  },
  {
    id: 'forgotten_depot',
    name: 'Forgotten Depot',
    era: 'V2 Expansion',
    x: 10,
    z: -125,
    radius: 36,
    description: 'Abandoned logistics depot with interconnected container lanes.',
    color: '#A855F7',
  },
  {
    id: 'hilltop_observatory',
    name: 'Hilltop Observatory',
    era: 'V2 Expansion',
    x: 5,
    z: 125,
    radius: 36,
    description: 'High-altitude summit featuring the iconic white geodesic radar dome.',
    color: '#EAB308',
  },
  {
    id: 'riverside_market',
    name: 'Riverside Market',
    era: 'V2 Expansion',
    x: -48,
    z: 42,
    radius: 28,
    description: 'Colorful stalls, walkways, and low cover near the central crossroads.',
    color: '#EC4899',
  },
  {
    id: 'research_station',
    name: 'Abandoned Research Station',
    era: 'V2 Expansion',
    x: 132,
    z: -5,
    radius: 35,
    description: 'Modular concrete science facility with interior corridors and energy gear.',
    color: '#6366F1',
  },
];

export const OUTFIT_CATALOG: OutfitConfig[] = [
  {
    id: 'sunset_striker',
    name: 'Sunset Striker',
    primaryColor: '#FF6B1A',
    secondaryColor: '#1E293B',
    accentColor: '#FDE047',
    hatStyle: 'visor',
    backpackColor: '#334155',
    unlockLevel: 1,
    description: 'The iconic 2019 Sunset Island drop jacket with tropical amber trim.',
  },
  {
    id: 'tropic_scout',
    name: 'Tropic Scout',
    primaryColor: '#10B981',
    secondaryColor: '#064E3B',
    accentColor: '#A7F3D0',
    hatStyle: 'cap',
    backpackColor: '#065F46',
    unlockLevel: 1,
    description: 'Lightweight emerald island gear tailored for Palm Village & Green Ridge.',
  },
  {
    id: 'harbor_phantom',
    name: 'Harbor Wave',
    primaryColor: '#0284C7',
    secondaryColor: '#0F172A',
    accentColor: '#38BDF8',
    hatStyle: 'headband',
    backpackColor: '#1E3A8A',
    unlockLevel: 1,
    description: 'Deep-sea tactical windbreaker worn by Old Harbor runners.',
  },
  {
    id: 'crimson_blitz',
    name: 'Crimson Vanguard',
    primaryColor: '#E11D48',
    secondaryColor: '#18181B',
    accentColor: '#FDA4AF',
    hatStyle: 'helmet',
    backpackColor: '#881337',
    unlockLevel: 2,
    unlockAchievementId: 'first_victory',
    description: 'Unlocked by claiming your first victory or reaching Level 2.',
  },
  {
    id: 'cyber_gold',
    name: 'Golden Era 2019',
    primaryColor: '#F59E0B',
    secondaryColor: '#111827',
    accentColor: '#FEF08A',
    hatStyle: 'helmet',
    backpackColor: '#78350F',
    unlockLevel: 4,
    unlockAchievementId: 'arena_champion',
    description: 'Championship gold-trimmed uniform honoring classic mobile legends.',
  },
  {
    id: 'violet_storm',
    name: 'Aegis Specialist',
    primaryColor: '#8B5CF6',
    secondaryColor: '#1E1B4B',
    accentColor: '#C4B5FD',
    hatStyle: 'visor',
    backpackColor: '#4C1D95',
    unlockLevel: 3,
    unlockAchievementId: 'island_explorer',
    description: 'Research Station prototype suit with ionized violet energy piping.',
  },
];
