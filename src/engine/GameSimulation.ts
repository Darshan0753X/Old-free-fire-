import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AIState,
  CharacterAnimState,
  CharacterStance,
  CombatDamagePopup,
  EQUIPMENT_CATALOG,
  EquipmentConfig,
  GameMode,
  GameSettings,
  MatchHistoryRecord,
  MatchPhase,
  OUTFIT_CATALOG,
  SaveDataSchema,
  SquadCommand,
  SquadMemberHUD,
  SUNSET_ISLAND_REGIONS,
  TacticalRole,
  TrainingTrialState,
  VehicleHUDInfo,
  VehicleType,
  WorldCollectible,
  interfaceHUDStateSnapshot,
} from '../types/game';
import {
  ArticulatedCharacterRig,
  createArticulatedCharacter,
  createCoverBarrierMesh,
  createSupplyCrateMesh,
  createVehicleMeshByType,
  updateCharacterAnimation,
} from './CharacterRig';
import {
  BuiltWorldData,
  buildGameWorld,
  castSegmentAgainstColliders,
  getSupportHeightAt,
  groundHeightAt,
  resolveHorizontalCollision,
} from './WorldBuilder';
import { soundEngine } from '../services/audio';

interface ContestantActor {
  id: string;
  name: string;
  role: TacticalRole;
  isPlayer: boolean;
  teamId: number; // 1 = Player team, 2..N = Rival teams
  isSquadAlly: boolean;
  rig: ArticulatedCharacterRig;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  stance: CharacterStance;
  animState: CharacterAnimState;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  armorLevel: number;
  eliminated: boolean;
  downedTimer: number;
  reviveCount: number;
  // Equipment
  weapon: EquipmentConfig;
  secondaryWeapon: EquipmentConfig | null;
  clipAmmo: number;
  secondaryClipAmmo: number;
  reserveAmmo: number;
  fireCooldownTimer: number;
  reloadTimer: number;
  medKits: number;
  shieldCells: number;
  coverGadgets: number;
  // AI fields
  aiState: AIState;
  aiTargetPos: { x: number; z: number };
  aiThinkTimer: number;
  aiStuckTimer: number;
  aiLastCheckPos: { x: number; z: number };
  aiReactionTimer: number;
  aiLastSeenEnemyPos: { x: number; z: number; time: number } | null;
  aiTargetLabel: string;
  aiAggression: number;
  aiAccuracy: number;
  eliminations: number;
}

interface ActiveProjectile {
  mesh: THREE.Group;
  ownerId: string;
  teamId: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  remainingRange: number;
}

interface ActiveCoverBarrier {
  id: string;
  mesh: THREE.Group;
  colliderId: string;
  expiresAt: number;
}

interface ActiveImpactEffect {
  mesh: THREE.Mesh;
  expiresAt: number;
  maxDuration: number;
}

interface ActiveVehicle {
  id: string;
  type: VehicleType;
  name: string;
  mesh: { root: THREE.Group; wheels: THREE.Mesh[] };
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  maxSpeed: number;
  turnRate: number;
  health: number;
  maxHealth: number;
  disabled: boolean;
  driverId: string | null;
}

const TACTICAL_ROLES: TacticalRole[] = [
  'Assault',
  'Support',
  'Scout',
  'Defender',
];

const BOT_NAMES = [
  'KAI_99',
  'NOVA_X',
  'TROPIC_7',
  'BLAZE_18',
  'VIPER_20',
  'ZARA_K',
  'REX_DROP',
  'MANGO_JR',
  'SHADOW_8',
  'LYRA_V2',
  'COBRA_01',
  'SUNSET_Z',
  'FALCON_5',
  'STORM_19',
  'ECHO_BR',
  'ORION_77',
  'PULSE_X',
  'DRIFT_9',
  'TITAN_04',
];

export class GameSimulationEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;

  // Lighting
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  // Lobby showcase objects
  private lobbyGroup: THREE.Group;
  private lobbyCharRig: ArticulatedCharacterRig | null = null;
  private lobbyTurntableYaw = 0;

  // Active Match World
  private worldData: BuiltWorldData | null = null;
  private actorsGroup: THREE.Group;
  private lootGroup: THREE.Group;
  private projectilesGroup: THREE.Group;
  private effectsGroup: THREE.Group;
  private zoneRingMesh: THREE.Mesh;
  private nextZoneRingMesh: THREE.Mesh;
  private transportMesh: THREE.Group;
  private coverPreviewMesh: THREE.Group;
  private squadMarkerMesh: THREE.Group;

  // World-Space Aiming Raycaster & Development Debug Visualizer
  private aimRaycaster = new THREE.Raycaster();
  private centerNdc = new THREE.Vector2(0, 0);
  private aimDebugGroup: THREE.Group;
  private aimDebugCamLine: THREE.Line;
  private aimDebugMuzzleLine: THREE.Line;
  private aimDebugMuzzleDot: THREE.Mesh;
  private aimDebugTargetDot: THREE.Mesh;
  private currentAimOrigin = new THREE.Vector3();
  private currentAimTarget = new THREE.Vector3();
  private currentAimDir = new THREE.Vector3(0, 0, 1);

  // Vehicles Fleet (Island Rover, Dune Sprinter, Tropic Moto)
  private vehicles: ActiveVehicle[] = [];
  private activeDriverVehicleId: string | null = null;

  // Combat Feedback & Shared Particle Pool
  private impactEffects: ActiveImpactEffect[] = [];
  private sharedImpactGeo = new THREE.SphereGeometry(0.18, 8, 8);
  private hitMarkerTimer = 0;
  private hitMarkerIsElim = false;
  private takingDamageFlashTimer = 0;
  private cameraShakeTimer = 0;
  private cameraShakeIntensity = 0;
  private damagePopups: CombatDamagePopup[] = [];
  private lastCombatSoundPos: { x: number; z: number; time: number } | null =
    null;

  // Match State
  private phase: MatchPhase = 'lobby';
  private mode: GameMode = 'br_solo';
  private matchId = '';
  private matchTimeSec = 0;
  private actors: ContestantActor[] = [];
  private lootItems: Map<string, { data: WorldCollectible; mesh: THREE.Group }> =
    new Map();
  private projectiles: ActiveProjectile[] = [];
  private activeBarriers: ActiveCoverBarrier[] = [];
  private killFeed: { id: string; text: string; isPlayer: boolean }[] = [];

  // Safe Zone
  private zoneStage = 0;
  private zoneTimerSec = 35;
  private zoneShrinking = false;
  private zoneCenter = { x: 0, z: 0 };
  private zoneRadius = 195;
  private nextZoneCenter = { x: 0, z: 0 };
  private nextZoneRadius = 125;
  private zoneTickTimer = 0;

  // Squad & Commands
  private activeSquadCommand: SquadCommand = 'follow';
  private squadStatusMessage = 'Squad ready for deployment.';
  private squadMarker: { x: number; z: number } | null = null;
  private teamCommandsUsedCount = 0;
  private reviveHoldTimer = 0;

  // Clash Arena State
  private arenaRound = 1;
  private arenaPlayerScore = 0;
  private arenaRivalScore = 0;
  private arenaCredits = 800;
  private arenaPrepTimerSec = 7;
  private arenaRoundTimerSec = 75;
  private arenaBannerText = '';

  // Spectator
  private spectatingIndex = 0;

  // Training Grounds State
  private trainingState: TrainingTrialState = {
    activeTrialIndex: 0,
    trials: [
      {
        id: 'movement_trial',
        name: '1. Movement Course',
        instruction: 'Sprint and jump over the 4 orange hurdles on the west lane.',
        completed: false,
        bestTimeSec: null,
        progress: 0,
        target: 4,
      },
      {
        id: 'navigation_trial',
        name: '2. Navigation Trial',
        instruction: 'Reach the 3 marked navigation beacons around the facility.',
        completed: false,
        bestTimeSec: null,
        progress: 0,
        target: 3,
      },
      {
        id: 'camera_trial',
        name: '3. Camera Tracking',
        instruction: 'Rotate your camera view to center on 3 glowing sky drones.',
        completed: false,
        bestTimeSec: null,
        progress: 0,
        target: 3,
      },
      {
        id: 'equipment_trial',
        name: '4. Equipment & Targets',
        instruction: 'Pick up a projector from the bench and hit 5 cyan targets.',
        completed: false,
        bestTimeSec: null,
        progress: 0,
        target: 5,
      },
      {
        id: 'survival_trial',
        name: '5. Safe-Zone Survival',
        instruction: 'Move inside the marked green safe ring before the timer ends.',
        completed: false,
        bestTimeSec: null,
        progress: 0,
        target: 1,
      },
    ],
    currentTimerSec: 0,
    isRunning: true,
  };

  // Player Input State
  public input = {
    moveX: 0, // -1 left .. +1 right
    moveZ: 0, // +1 forward .. -1 backward
    sprint: false,
    firing: false,
    aiming: false,
    braking: false,
    coverPreview: false,
  };

  private cameraYaw = 0;
  private cameraPitch = 0.25;
  private settings: GameSettings;
  private saveData: SaveDataSchema;
  private onHUDUpdate: (snapshot: interfaceHUDStateSnapshot) => void;
  private onMatchComplete: (
    record: MatchHistoryRecord,
    extra: {
      suppliesCollected: number;
      zonesSurvived: number;
      landed: boolean;
      teamCommandsUsed: number;
      regionsVisited: string[];
    }
  ) => void;
  private onTrainingComplete: () => void;

  private suppliesCollectedInMatch = 0;
  private landedInMatch = false;
  private regionsVisitedInMatch: Set<string> = new Set();
  private matchRecorded = false;

  // Performance tracking
  private lastFrameTime = performance.now();
  private fpsSmooth = 60;
  private hudEmitTimer = 0;

  constructor(
    container: HTMLElement,
    saveData: SaveDataSchema,
    onHUDUpdate: (snapshot: interfaceHUDStateSnapshot) => void,
    onMatchComplete: (
      record: MatchHistoryRecord,
      extra: {
        suppliesCollected: number;
        zonesSurvived: number;
        landed: boolean;
        teamCommandsUsed: number;
        regionsVisited: string[];
      }
    ) => void,
    onTrainingComplete: () => void
  ) {
    this.container = container;
    this.saveData = saveData;
    this.settings = saveData.settings;
    this.onHUDUpdate = onHUDUpdate;
    this.onMatchComplete = onMatchComplete;
    this.onTrainingComplete = onTrainingComplete;

    // 1. Software WebGL detection per threejs skill
    this.isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && this.settings.graphicsPreset !== 'LOW',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setSize(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight
    );
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#58B8F0');
    this.scene.fog = new THREE.FogExp2('#93C5FD', 0.0038);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(
      62,
      (this.container.clientWidth || window.innerWidth) /
        (this.container.clientHeight || window.innerHeight),
      0.15,
      550
    );

    // Studio Warm/Cool Lighting Rig
    this.hemiLight = new THREE.HemisphereLight('#E0F2FE', '#3F6212', 0.75);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight('#FFFBEB', 1.85);
    this.dirLight.position.set(65, 95, 55);
    this.dirLight.shadow.camera.left = -90;
    this.dirLight.shadow.camera.right = 90;
    this.dirLight.shadow.camera.top = 90;
    this.dirLight.shadow.camera.bottom = -90;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 240;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);

    this.applyGraphicsSettings(this.settings);

    // Scene Groups
    this.lobbyGroup = new THREE.Group();
    this.actorsGroup = new THREE.Group();
    this.lootGroup = new THREE.Group();
    this.projectilesGroup = new THREE.Group();
    this.effectsGroup = new THREE.Group();
    this.scene.add(
      this.lobbyGroup,
      this.actorsGroup,
      this.lootGroup,
      this.projectilesGroup,
      this.effectsGroup
    );

    // Safe Zone Cylinder Ring
    const zoneGeo = new THREE.CylinderGeometry(1, 1, 28, 48, 1, true);
    const zoneMat = new THREE.MeshBasicMaterial({
      color: '#FF6B1A',
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.zoneRingMesh = new THREE.Mesh(zoneGeo, zoneMat);
    this.zoneRingMesh.visible = false;
    this.scene.add(this.zoneRingMesh);

    const nextZoneGeo = new THREE.RingGeometry(0.98, 1.0, 48);
    nextZoneGeo.rotateX(-Math.PI / 2);
    this.nextZoneRingMesh = new THREE.Mesh(
      nextZoneGeo,
      new THREE.MeshBasicMaterial({
        color: '#FFFFFF',
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      })
    );
    this.nextZoneRingMesh.position.y = 0.35;
    this.nextZoneRingMesh.visible = false;
    this.scene.add(this.nextZoneRingMesh);

    // Transport Aircraft Mesh (for Deployment Phase)
    this.transportMesh = this.createTransportAircraftMesh();
    this.transportMesh.visible = false;
    this.scene.add(this.transportMesh);

    // Cover Placement Preview Mesh
    this.coverPreviewMesh = createCoverBarrierMesh(true, true);
    this.coverPreviewMesh.visible = false;
    this.scene.add(this.coverPreviewMesh);

    // Squad Tactical Marker Beam
    this.squadMarkerMesh = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 18, 12),
      new THREE.MeshBasicMaterial({
        color: '#00E5FF',
        transparent: true,
        opacity: 0.55,
      })
    );
    beam.position.y = 9;
    this.squadMarkerMesh.add(beam);
    this.squadMarkerMesh.visible = false;
    this.scene.add(this.squadMarkerMesh);

    // 3D Aiming Debug Visualization (Camera Ray, Muzzle Origin, Target Point, Projectile Direction)
    this.aimDebugGroup = new THREE.Group();
    this.aimDebugGroup.visible = false;

    const camLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, 10),
    ]);
    this.aimDebugCamLine = new THREE.Line(
      camLineGeo,
      new THREE.LineBasicMaterial({ color: '#00E5FF' })
    );

    const muzLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, 10),
    ]);
    this.aimDebugMuzzleLine = new THREE.Line(
      muzLineGeo,
      new THREE.LineBasicMaterial({ color: '#FF6B1A' })
    );

    this.aimDebugMuzzleDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#10B981' })
    );
    this.aimDebugTargetDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#FDE047' })
    );
    this.aimDebugGroup.add(
      this.aimDebugCamLine,
      this.aimDebugMuzzleLine,
      this.aimDebugMuzzleDot,
      this.aimDebugTargetDot
    );
    this.scene.add(this.aimDebugGroup);

    this.buildLobbyScene();

    window.addEventListener('resize', this.handleResize);
    this.startLoop();
  }

  private createTransportAircraftMesh(): THREE.Group {
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
      color: '#E2E8F0',
      roughness: 0.35,
      metalness: 0.5,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: '#FF6B1A',
      roughness: 0.45,
      metalness: 0.3,
    });
    const fuselage = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 2.8, 16),
      hullMat
    );
    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.35, 3.4),
      wingMat
    );
    wings.position.set(0, 0.6, 0.5);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 3.2, 2.6),
      wingMat
    );
    tail.position.set(0, 2.2, -6.5);
    g.add(fuselage, wings, tail);
    return g;
  }

  public applyGraphicsSettings(settings: GameSettings) {
    this.settings = settings;
    soundEngine.applySettings(settings);

    const presetCap =
      settings.graphicsPreset === 'LOW'
        ? 1.0
        : settings.graphicsPreset === 'MEDIUM'
        ? 1.5
        : 2.0;
    const resScale = THREE.MathUtils.clamp(
      settings.renderResolutionScale ?? 1.0,
      0.6,
      1.5
    );
    this.renderer.setPixelRatio(
      this.isSoftwareGl
        ? 1
        : Math.min((window.devicePixelRatio || 1) * resScale, presetCap)
    );

    const enableShadows =
      !this.isSoftwareGl &&
      settings.shadowsEnabled &&
      settings.graphicsPreset !== 'LOW';
    this.renderer.shadowMap.enabled = enableShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.dirLight.castShadow = enableShadows;
    const shadowRes =
      settings.graphicsPreset === 'HIGH' &&
      settings.environmentDetail !== 'low'
        ? 1024
        : 512;
    this.dirLight.shadow.mapSize.set(shadowRes, shadowRes);

    if (this.scene && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density =
        settings.environmentDetail === 'low'
          ? 0.0052
          : settings.environmentDetail === 'high'
          ? 0.003
          : 0.0038;
    }

    if (this.camera) {
      const fov = THREE.MathUtils.clamp(settings.cameraFov ?? 62, 55, 80);
      if (this.camera.fov !== fov) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    }
  }

  public updateLobbyCharacter(saveData: SaveDataSchema) {
    this.saveData = saveData;
    if (this.lobbyCharRig) {
      this.lobbyGroup.remove(this.lobbyCharRig.root);
    }
    this.lobbyCharRig = createArticulatedCharacter(
      saveData.selectedOutfitId,
      saveData.selectedBackpackStyle
    );
    this.lobbyCharRig.root.position.set(0, 0.25, 0);
    this.lobbyCharRig.root.rotation.y = this.lobbyTurntableYaw;
    this.lobbyGroup.add(this.lobbyCharRig.root);
  }

  public rotateLobbyCharacter(deltaYaw: number) {
    this.lobbyTurntableYaw += deltaYaw;
    if (this.lobbyCharRig) {
      this.lobbyCharRig.root.rotation.y = this.lobbyTurntableYaw;
    }
  }

  private buildLobbyScene() {
    this.lobbyGroup.clear();

    // Tropical Pedestal & Beach Backdrop
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.8, 0.25, 24),
      new THREE.MeshStandardMaterial({
        color: '#1E293B',
        roughness: 0.4,
        metalness: 0.6,
      })
    );
    pedestal.position.set(0, 0.125, 0);
    pedestal.receiveShadow = true;
    this.lobbyGroup.add(pedestal);

    const ringGlow = new THREE.Mesh(
      new THREE.RingGeometry(1.42, 1.54, 32),
      new THREE.MeshBasicMaterial({
        color: '#FF6B1A',
        side: THREE.DoubleSide,
      })
    );
    ringGlow.rotation.x = -Math.PI / 2;
    ringGlow.position.set(0, 0.26, 0);
    this.lobbyGroup.add(ringGlow);

    const sandIsle = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 10, 0.4, 24),
      new THREE.MeshStandardMaterial({ color: '#FACC15', roughness: 0.9 })
    );
    sandIsle.position.set(0, -0.2, -2);
    this.lobbyGroup.add(sandIsle);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({
        color: '#0284C7',
        roughness: 0.25,
        metalness: 0.2,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.35;
    this.lobbyGroup.add(water);

    // Decorative Palm Trees behind character
    for (const [px, pz] of [
      [-3.5, -3.2],
      [3.8, -2.8],
    ]) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.28, 3.8, 8),
        new THREE.MeshStandardMaterial({ color: '#78350F', roughness: 0.9 })
      );
      trunk.position.set(px, 1.9, pz);
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(1.8, 1.6, 7),
        new THREE.MeshStandardMaterial({ color: '#15803D', roughness: 0.75 })
      );
      leaves.position.set(px, 4.0, pz);
      this.lobbyGroup.add(trunk, leaves);
    }

    this.updateLobbyCharacter(this.saveData);
  }

  public startMatch(mode: GameMode) {
    this.cleanupMatchEntities();
    this.mode = mode;
    this.matchId = `match_${Date.now()}`;
    this.matchTimeSec = 0;
    this.suppliesCollectedInMatch = 0;
    this.landedInMatch = mode !== 'br_solo' && mode !== 'br_squad';
    this.regionsVisitedInMatch.clear();
    this.teamCommandsUsedCount = 0;
    this.matchRecorded = false;
    this.killFeed = [];
    this.spectatingIndex = 0;
    this.squadMarker = null;
    this.squadMarkerMesh.visible = false;

    this.lobbyGroup.visible = false;
    soundEngine.stopMenuMusic();

    // Build 3D World
    this.worldData = buildGameWorld(mode, this.settings.graphicsPreset);
    this.scene.add(this.worldData.worldGroup);

    // Spawn Loot Meshes
    for (const item of this.worldData.initialLoot) {
      const mesh = createSupplyCrateMesh(item.rarity);
      mesh.position.set(item.x, item.y, item.z);
      this.lootGroup.add(mesh);
      this.lootItems.set(item.id, { data: { ...item }, mesh });
    }

    if (mode === 'br_solo' || mode === 'br_squad') {
      // Spawn 3 Drivable Vehicles at safe open road locations across Sunset Island
      const vehicleSpawns: {
        id: string;
        type: VehicleType;
        name: string;
        x: number;
        z: number;
        yaw: number;
        maxSpeed: number;
        turnRate: number;
        maxHealth: number;
      }[] = [
        {
          id: 'veh_rover',
          type: 'rover',
          name: 'Island Rover 4x4',
          x: 16,
          z: 12,
          yaw: 0.4,
          maxSpeed: 22,
          turnRate: 1.9,
          maxHealth: 240,
        },
        {
          id: 'veh_sprinter',
          type: 'sprinter',
          name: 'Dune Sprinter Buggy',
          x: 84,
          z: 68,
          yaw: -0.6,
          maxSpeed: 27,
          turnRate: 2.3,
          maxHealth: 170,
        },
        {
          id: 'veh_moto',
          type: 'moto',
          name: 'Tropic Moto',
          x: -76,
          z: -56,
          yaw: 0.8,
          maxSpeed: 30,
          turnRate: 2.7,
          maxHealth: 120,
        },
        {
          id: 'veh_depot_rover',
          type: 'rover',
          name: 'Patrol Rover 4x4',
          x: 64,
          z: -48,
          yaw: -1.1,
          maxSpeed: 23,
          turnRate: 1.95,
          maxHealth: 240,
        },
      ];

      for (const vs of vehicleSpawns) {
        const vMesh = createVehicleMeshByType(vs.type);
        const rawY = groundHeightAt(vs.x, vs.z, mode);
        // Ensure vehicle never spawns overlapping any building or obstacle collider
        const safePos = resolveHorizontalCollision(
          vs.x,
          rawY,
          vs.z,
          2.0,
          2.2,
          this.worldData.colliders
        );
        const vy = groundHeightAt(safePos.x, safePos.z, mode);
        vMesh.root.position.set(safePos.x, vy, safePos.z);
        vMesh.root.rotation.y = vs.yaw;
        this.actorsGroup.add(vMesh.root);
        this.vehicles.push({
          id: vs.id,
          type: vs.type,
          name: vs.name,
          mesh: vMesh,
          x: safePos.x,
          y: vy,
          z: safePos.z,
          yaw: vs.yaw,
          speed: 0,
          maxSpeed: vs.maxSpeed,
          turnRate: vs.turnRate,
          health: vs.maxHealth,
          maxHealth: vs.maxHealth,
          disabled: false,
          driverId: null,
        });
      }

      this.setupBattleRoyaleRoster(mode === 'br_squad');
      this.phase = 'deployment';
      this.zoneStage = 1;
      this.zoneTimerSec = 40;
      this.zoneShrinking = false;
      this.zoneCenter = { x: 0, z: 0 };
      this.zoneRadius = 185;
      this.nextZoneCenter = {
        x: (Math.random() - 0.5) * 50,
        z: (Math.random() - 0.5) * 50,
      };
      this.nextZoneRadius = 115;
      this.zoneRingMesh.visible = true;
      this.nextZoneRingMesh.visible = true;
      this.transportMesh.visible = true;
      this.transportMesh.position.set(-140, 68, -110);
      this.transportMesh.rotation.y = Math.PI / 4;
    } else if (mode === 'clash_arena') {
      this.arenaRound = 1;
      this.arenaPlayerScore = 0;
      this.arenaRivalScore = 0;
      this.arenaCredits = 1000;
      this.setupClashArenaRoster();
      this.startClashArenaRound();
    } else if (mode === 'training') {
      this.setupTrainingRoster();
      this.phase = 'active';
      this.trainingState.activeTrialIndex = 0;
      this.trainingState.currentTimerSec = 0;
      this.trainingState.isRunning = true;
    }

    this.emitHUDSnapshot();
  }

  private setupBattleRoyaleRoster(isSquad: boolean) {
    // 20 total contestants (1 human + 19 AI)
    const playerRig = createArticulatedCharacter(
      this.saveData.selectedOutfitId,
      this.saveData.selectedBackpackStyle
    );
    this.actorsGroup.add(playerRig.root);

    const playerActor: ContestantActor = {
      id: 'player',
      name: this.saveData.playerName,
      role: 'Assault',
      isPlayer: true,
      teamId: 1,
      isSquadAlly: true,
      rig: playerRig,
      x: -120,
      y: 66,
      z: -95,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.PI / 4,
      pitch: 0,
      stance: 'parachuting',
      animState: 'idle',
      health: 100,
      maxHealth: 100,
      shield: 25,
      maxShield: 100,
      armorLevel: 1,
      eliminated: false,
      downedTimer: 0,
      reviveCount: 0,
      weapon: EQUIPMENT_CATALOG.rapid_pulse,
      secondaryWeapon: null,
      clipAmmo: EQUIPMENT_CATALOG.rapid_pulse.energyCapacity,
      secondaryClipAmmo: 0,
      reserveAmmo: 84,
      fireCooldownTimer: 0,
      reloadTimer: 0,
      medKits: 1,
      shieldCells: 1,
      coverGadgets: 2,
      aiState: 'Idle',
      aiTargetPos: { x: 0, z: 0 },
      aiThinkTimer: 0,
      aiStuckTimer: 0,
      aiLastCheckPos: { x: 0, z: 0 },
      aiReactionTimer: 0,
      aiLastSeenEnemyPos: null,
      aiTargetLabel: 'None',
      aiAggression: 0.5,
      aiAccuracy: 0.5,
      eliminations: 0,
    };
    this.actors.push(playerActor);

    const equipList = Object.values(EQUIPMENT_CATALOG);
    for (let i = 0; i < 19; i++) {
      const isAlly = isSquad && i < 3;
      const teamId = isAlly ? 1 : Math.floor(i / (isSquad ? 4 : 1)) + 2;
      const role = TACTICAL_ROLES[(i + 1) % TACTICAL_ROLES.length];
      const outfit = OUTFIT_CATALOG[(i + 1) % OUTFIT_CATALOG.length];
      const rig = createArticulatedCharacter(
        outfit.id,
        i % 2 === 0 ? 'tactical' : 'standard',
        isAlly ? '#00E5FF' : undefined
      );
      this.actorsGroup.add(rig.root);

      const reg =
        SUNSET_ISLAND_REGIONS[i % SUNSET_ISLAND_REGIONS.length];
      const spawnX = isAlly
        ? -85 + (i + 1) * 7
        : reg.x + (Math.random() - 0.5) * 32;
      const spawnZ = isAlly
        ? -65 + (i + 1) * 7
        : reg.z + (Math.random() - 0.5) * 32;
      const spawnY = groundHeightAt(spawnX, spawnZ, this.mode);

      // Assign role-appropriate preferred weapon
      let botWeapon = equipList[i % equipList.length];
      if (role === 'Scout') botWeapon = EQUIPMENT_CATALOG.precision_caster;
      else if (role === 'Assault') botWeapon = EQUIPMENT_CATALOG.rapid_pulse;
      else if (role === 'Defender') botWeapon = EQUIPMENT_CATALOG.close_scatter;
      else if (role === 'Support') botWeapon = EQUIPMENT_CATALOG.burst_light;

      const bot: ContestantActor = {
        id: `bot_${i}`,
        name: isAlly ? `ALLY_${BOT_NAMES[i]}` : BOT_NAMES[i],
        role,
        isPlayer: false,
        teamId,
        isSquadAlly: isAlly,
        rig,
        x: spawnX,
        y: spawnY,
        z: spawnZ,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: Math.random() * Math.PI * 2,
        pitch: 0,
        stance: 'standing',
        animState: 'idle',
        health: 100,
        maxHealth: 100,
        shield: isAlly ? 50 : 25,
        maxShield: 100,
        armorLevel: 1,
        eliminated: false,
        downedTimer: 0,
        reviveCount: 0,
        weapon: botWeapon,
        secondaryWeapon: null,
        clipAmmo: botWeapon.energyCapacity,
        secondaryClipAmmo: 0,
        reserveAmmo: 120,
        fireCooldownTimer: 0,
        reloadTimer: 0,
        medKits: role === 'Support' ? 2 : 1,
        shieldCells: 1,
        coverGadgets: 1,
        aiState: isAlly ? 'Following' : 'Exploring',
        aiTargetPos: { x: reg.x, z: reg.z },
        aiThinkTimer: (i % 5) * 0.14,
        aiStuckTimer: 0,
        aiLastCheckPos: { x: spawnX, z: spawnZ },
        aiReactionTimer: 0,
        aiLastSeenEnemyPos: null,
        aiTargetLabel: reg.name,
        aiAggression:
          role === 'Assault' ? 0.78 : role === 'Defender' ? 0.45 : 0.6,
        aiAccuracy: 0.45 + (i % 4) * 0.1,
        eliminations: 0,
      };
      rig.root.position.set(bot.x, bot.y, bot.z);
      this.actors.push(bot);
    }
  }

  private setupClashArenaRoster() {
    // 4v4 Clash Arena on Sunset Yard
    const playerRig = createArticulatedCharacter(
      this.saveData.selectedOutfitId,
      this.saveData.selectedBackpackStyle,
      '#00E5FF'
    );
    this.actorsGroup.add(playerRig.root);

    const playerActor: ContestantActor = {
      id: 'player',
      name: this.saveData.playerName,
      role: 'Assault',
      isPlayer: true,
      teamId: 1,
      isSquadAlly: true,
      rig: playerRig,
      x: -9,
      y: 0,
      z: 38,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.PI,
      pitch: 0,
      stance: 'standing',
      animState: 'idle',
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 100,
      armorLevel: 2,
      eliminated: false,
      downedTimer: 0,
      reviveCount: 0,
      weapon: EQUIPMENT_CATALOG.rapid_pulse,
      secondaryWeapon: EQUIPMENT_CATALOG.close_scatter,
      clipAmmo: EQUIPMENT_CATALOG.rapid_pulse.energyCapacity,
      secondaryClipAmmo: EQUIPMENT_CATALOG.close_scatter.energyCapacity,
      reserveAmmo: 120,
      fireCooldownTimer: 0,
      reloadTimer: 0,
      medKits: 1,
      shieldCells: 1,
      coverGadgets: 2,
      aiState: 'Idle',
      aiTargetPos: { x: 0, z: 0 },
      aiThinkTimer: 0,
      aiStuckTimer: 0,
      aiLastCheckPos: { x: -9, z: 38 },
      aiReactionTimer: 0,
      aiLastSeenEnemyPos: null,
      aiTargetLabel: 'Sunset Yard',
      aiAggression: 0.7,
      aiAccuracy: 0.65,
      eliminations: 0,
    };
    this.actors.push(playerActor);

    const equipList = Object.values(EQUIPMENT_CATALOG);
    // 3 Player Team Allies + 4 Rival Team Opponents
    for (let i = 0; i < 7; i++) {
      const isAlly = i < 3;
      const teamId = isAlly ? 1 : 2;
      const role = TACTICAL_ROLES[(i + 1) % TACTICAL_ROLES.length];
      const rig = createArticulatedCharacter(
        OUTFIT_CATALOG[(i + 1) % OUTFIT_CATALOG.length].id,
        'tactical',
        isAlly ? '#00E5FF' : '#F43F5E'
      );
      this.actorsGroup.add(rig.root);

      const w = equipList[(i + 1) % equipList.length];
      const bot: ContestantActor = {
        id: `arena_bot_${i}`,
        name: isAlly ? `ALLY_${BOT_NAMES[i]}` : `RIVAL_${BOT_NAMES[i + 4]}`,
        role,
        isPlayer: false,
        teamId,
        isSquadAlly: isAlly,
        rig,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: isAlly ? Math.PI : 0,
        pitch: 0,
        stance: 'standing',
        animState: 'idle',
        health: 100,
        maxHealth: 100,
        shield: 50,
        maxShield: 100,
        armorLevel: 2,
        eliminated: false,
        downedTimer: 0,
        reviveCount: 0,
        weapon: w,
        secondaryWeapon: null,
        clipAmmo: w.energyCapacity,
        secondaryClipAmmo: 0,
        reserveAmmo: 120,
        fireCooldownTimer: 0,
        reloadTimer: 0,
        medKits: 1,
        shieldCells: 1,
        coverGadgets: 1,
        aiState: 'ApproachingEncounter',
        aiTargetPos: { x: 0, z: 0 },
        aiThinkTimer: i * 0.1,
        aiStuckTimer: 0,
        aiLastCheckPos: { x: 0, z: 0 },
        aiReactionTimer: 0,
        aiLastSeenEnemyPos: null,
        aiTargetLabel: 'Center Hub',
        aiAggression: 0.65,
        aiAccuracy: 0.55,
        eliminations: 0,
      };
      this.actors.push(bot);
    }
  }

  private startClashArenaRound() {
    this.phase = 'prep_buy';
    this.arenaPrepTimerSec = 6;
    this.arenaRoundTimerSec = 70;
    this.arenaBannerText = `ROUND ${this.arenaRound} — PREPARE EQUIPMENT`;

    // Clear active barriers & projectiles from previous round
    for (const b of this.activeBarriers) {
      this.effectsGroup.remove(b.mesh);
      if (this.worldData) {
        this.worldData.colliders = this.worldData.colliders.filter(
          (c) => c.id !== b.colliderId
        );
      }
    }
    this.activeBarriers = [];
    for (const p of this.projectiles) {
      this.projectilesGroup.remove(p.mesh);
    }
    this.projectiles = [];

    let allyIdx = 0;
    let rivalIdx = 0;
    for (const actor of this.actors) {
      actor.eliminated = false;
      actor.downedTimer = 0;
      actor.health = 100;
      actor.shield = Math.max(actor.shield, 50);
      actor.stance = 'standing';
      actor.animState = 'idle';
      actor.clipAmmo = actor.weapon.energyCapacity;
      actor.reserveAmmo = 120;
      actor.rig.root.visible = true;

      if (actor.teamId === 1) {
        actor.x = -12 + allyIdx * 8;
        actor.y = 0;
        actor.z = 38;
        actor.yaw = Math.PI;
        allyIdx++;
      } else {
        actor.x = -12 + rivalIdx * 8;
        actor.y = 0;
        actor.z = -38;
        actor.yaw = 0;
        rivalIdx++;
      }
      actor.rig.root.position.set(actor.x, actor.y, actor.z);
      actor.rig.root.rotation.y = actor.yaw;
      actor.aiState = 'ApproachingEncounter';
      actor.aiTargetPos = {
        x: (Math.random() - 0.5) * 28,
        z: (Math.random() - 0.5) * 16,
      };
    }

    this.cameraYaw = Math.PI;
  }

  private setupTrainingRoster() {
    const playerRig = createArticulatedCharacter(
      this.saveData.selectedOutfitId,
      this.saveData.selectedBackpackStyle
    );
    this.actorsGroup.add(playerRig.root);

    const playerActor: ContestantActor = {
      id: 'player',
      name: this.saveData.playerName,
      role: 'Assault',
      isPlayer: true,
      teamId: 1,
      isSquadAlly: true,
      rig: playerRig,
      x: 0,
      y: 0,
      z: 5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.PI,
      pitch: 0,
      stance: 'standing',
      animState: 'idle',
      health: 100,
      maxHealth: 100,
      shield: 100,
      maxShield: 100,
      armorLevel: 3,
      eliminated: false,
      downedTimer: 0,
      reviveCount: 0,
      weapon: EQUIPMENT_CATALOG.burst_light,
      secondaryWeapon: EQUIPMENT_CATALOG.precision_caster,
      clipAmmo: EQUIPMENT_CATALOG.burst_light.energyCapacity,
      secondaryClipAmmo: EQUIPMENT_CATALOG.precision_caster.energyCapacity,
      reserveAmmo: 999,
      fireCooldownTimer: 0,
      reloadTimer: 0,
      medKits: 5,
      shieldCells: 5,
      coverGadgets: 5,
      aiState: 'Idle',
      aiTargetPos: { x: 0, z: 0 },
      aiThinkTimer: 0,
      aiStuckTimer: 0,
      aiLastCheckPos: { x: 0, z: 5 },
      aiReactionTimer: 0,
      aiLastSeenEnemyPos: null,
      aiTargetLabel: 'Training Range',
      aiAggression: 0.5,
      aiAccuracy: 0.5,
      eliminations: 0,
    };
    this.actors.push(playerActor);
    this.cameraYaw = Math.PI;
  }

  // Player Action Methods
  public deployFromAircraft() {
    if (this.phase !== 'deployment') return;
    const player = this.getPlayer();
    if (!player) return;
    this.phase = 'active';
    this.transportMesh.visible = false;
    player.stance = 'parachuting';
    player.y = Math.max(player.y, 48);
    soundEngine.playClick();
  }

  public rotateCamera(deltaYaw: number, deltaPitch: number) {
    const baseSens = this.settings.cameraSensitivity ?? 1.0;
    const aimMult = this.input.aiming
      ? this.settings.aimingSensitivity ?? 0.75
      : 1.0;
    const horizSens = this.settings.horizontalSensitivity ?? 1.0;
    const vertSens = this.settings.verticalSensitivity ?? 1.0;

    this.cameraYaw -= deltaYaw * baseSens * aimMult * horizSens;
    const pitchDir = this.settings.invertY ? -1 : 1;
    this.cameraPitch = THREE.MathUtils.clamp(
      this.cameraPitch + deltaPitch * baseSens * aimMult * vertSens * pitchDir,
      -0.68,
      1.05
    );
  }

  public triggerJump() {
    const player = this.getPlayer();
    if (!player || player.eliminated || this.phase !== 'active') return;
    if (player.stance === 'parachuting') {
      // Accelerate dive slightly
      player.vy = -18;
      return;
    }
    if (player.stance === 'crouching' || player.stance === 'prone') {
      player.stance = 'standing';
      return;
    }
    const groundY = getSupportHeightAt(
      player.x,
      player.z,
      player.y,
      this.mode,
      this.worldData?.walkableSurfaces || []
    );
    if (Math.abs(player.y - groundY) < 0.25) {
      player.vy = 8.4;
      player.animState = 'jumping';
      soundEngine.playJump();
    }
  }

  public toggleCrouch() {
    const player = this.getPlayer();
    if (!player || player.eliminated || player.stance === 'parachuting') return;
    player.stance = player.stance === 'crouching' ? 'standing' : 'crouching';
    soundEngine.playClick();
  }

  public toggleProne() {
    const player = this.getPlayer();
    if (!player || player.eliminated || player.stance === 'parachuting') return;
    player.stance = player.stance === 'prone' ? 'standing' : 'prone';
    soundEngine.playClick();
  }

  public triggerReload() {
    const player = this.getPlayer();
    if (!player || player.eliminated || player.reloadTimer > 0) return;
    if (
      player.clipAmmo < player.weapon.energyCapacity &&
      player.reserveAmmo > 0
    ) {
      player.reloadTimer = player.weapon.reloadTime;
      player.rig.reloadAnimTimer = player.weapon.reloadTime;
      soundEngine.playReload();
    }
  }

  public switchWeaponSlot(slotIndex?: 0 | 1) {
    const player = this.getPlayer();
    if (!player || !player.secondaryWeapon) return;
    if (slotIndex === 0) return;
    const tempW = player.weapon;
    const tempClip = player.clipAmmo;
    player.weapon = player.secondaryWeapon;
    player.clipAmmo = player.secondaryClipAmmo;
    player.secondaryWeapon = tempW;
    player.secondaryClipAmmo = tempClip;
    player.reloadTimer = 0;
    soundEngine.playClick();
  }

  public useHealingItem(type: 'medkit' | 'shield') {
    const player = this.getPlayer();
    if (!player || player.eliminated) return;
    if (type === 'medkit' && player.medKits > 0 && player.health < 100) {
      player.medKits--;
      player.health = Math.min(100, player.health + 50);
      soundEngine.playPickup();
    } else if (
      type === 'shield' &&
      player.shieldCells > 0 &&
      player.shield < player.maxShield
    ) {
      player.shieldCells--;
      player.shield = Math.min(player.maxShield, player.shield + 50);
      soundEngine.playPickup();
    }
  }

  public toggleCoverPreview() {
    const player = this.getPlayer();
    if (!player || player.coverGadgets <= 0) return;
    this.input.coverPreview = !this.input.coverPreview;
    if (!this.input.coverPreview) {
      this.coverPreviewMesh.visible = false;
    }
  }

  public deployTemporaryCover() {
    const player = this.getPlayer();
    if (!player || player.eliminated || player.coverGadgets <= 0) return;
    if (this.activeBarriers.length >= 4) {
      const oldest = this.activeBarriers.shift()!;
      this.effectsGroup.remove(oldest.mesh);
      if (this.worldData) {
        this.worldData.colliders = this.worldData.colliders.filter(
          (c) => c.id !== oldest.colliderId
        );
      }
    }

    const forwardX = Math.sin(this.cameraYaw);
    const forwardZ = Math.cos(this.cameraYaw);
    const bx = player.x + forwardX * 3.2;
    const bz = player.z + forwardZ * 3.2;
    const by = getSupportHeightAt(
      bx,
      bz,
      player.y,
      this.mode,
      this.worldData?.walkableSurfaces || []
    );

    // Validate not inside wall
    const check = resolveHorizontalCollision(
      bx,
      by,
      bz,
      0.8,
      1.8,
      this.worldData?.colliders || []
    );
    if (check.hitWall) return;

    player.coverGadgets--;
    this.input.coverPreview = false;
    this.coverPreviewMesh.visible = false;

    const mesh = createCoverBarrierMesh(false, true);
    mesh.position.set(bx, by, bz);
    mesh.rotation.y = this.cameraYaw;
    this.effectsGroup.add(mesh);

    const colliderId = `cover_${Date.now()}`;
    const halfSpan = 1.5;
    this.worldData?.colliders.push({
      id: colliderId,
      minX: bx - halfSpan,
      maxX: bx + halfSpan,
      minY: by,
      maxY: by + 2.1,
      minZ: bz - halfSpan,
      maxZ: bz + halfSpan,
      blocksProjectiles: true,
      isTemporaryCover: true,
    });

    this.activeBarriers.push({
      id: colliderId,
      mesh,
      colliderId,
      expiresAt: this.matchTimeSec + 18,
    });

    soundEngine.playCoverDeploy();
    if (
      this.mode === 'training' &&
      this.trainingState.activeTrialIndex === 3
    ) {
      this.advanceTrainingTrial(3, 1);
    }
  }

  public pickUpNearbySupply() {
    const player = this.getPlayer();
    if (!player || player.eliminated) return;
    const nearest = this.findNearestLoot(player.x, player.z, 3.6);
    if (!nearest) return;

    this.applyLootToActor(player, nearest.data);
    nearest.data.collected = true;
    nearest.mesh.visible = false;
    this.suppliesCollectedInMatch++;
    soundEngine.playPickup();
  }

  public toggleVehicleEnterExit() {
    const player = this.getPlayer();
    if (!player || player.eliminated) return;

    if (this.activeDriverVehicleId) {
      const veh = this.vehicles.find((v) => v.id === this.activeDriverVehicleId);
      this.activeDriverVehicleId = null;
      if (veh) {
        veh.driverId = null;
        veh.speed = 0;
        // Safe exit check: try left side, right side, rear so player never gets trapped in a wall
        const exitOffsets = [
          [Math.cos(veh.yaw) * 2.4, -Math.sin(veh.yaw) * 2.4],
          [-Math.cos(veh.yaw) * 2.4, Math.sin(veh.yaw) * 2.4],
          [-Math.sin(veh.yaw) * 2.8, -Math.cos(veh.yaw) * 2.8],
        ];
        let exitX = veh.x;
        let exitZ = veh.z;
        for (const [ox, oz] of exitOffsets) {
          const tx = veh.x + ox;
          const tz = veh.z + oz;
          const ty = groundHeightAt(tx, tz, this.mode);
          const col = resolveHorizontalCollision(
            tx,
            ty,
            tz,
            0.45,
            1.75,
            this.worldData?.colliders || []
          );
          if (!col.hitWall) {
            exitX = col.x;
            exitZ = col.z;
            break;
          }
        }
        player.x = exitX;
        player.z = exitZ;
        player.y = groundHeightAt(player.x, player.z, this.mode);
      }
      player.stance = 'standing';
      player.rig.root.visible = true;
      soundEngine.playClick();
    } else {
      const nearestVeh = this.findNearestVehicle(player.x, player.z, 4.8);
      if (nearestVeh && !nearestVeh.disabled) {
        this.activeDriverVehicleId = nearestVeh.id;
        nearestVeh.driverId = 'player';
        player.stance = 'driving';
        player.rig.root.visible = false;
        soundEngine.playClick();
      }
    }
  }

  private findNearestVehicle(
    x: number,
    z: number,
    maxDist: number
  ): ActiveVehicle | null {
    let best: ActiveVehicle | null = null;
    let bestD = maxDist;
    for (const v of this.vehicles) {
      if (v.disabled) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  public issueSquadCommand(cmd: SquadCommand, markerPos?: { x: number; z: number }) {
    this.activeSquadCommand = cmd;
    this.teamCommandsUsedCount++;
    soundEngine.playClick();

    if (cmd === 'move_marker') {
      const player = this.getPlayer();
      const target = markerPos || {
        x: (player?.x || 0) + Math.sin(this.cameraYaw) * 24,
        z: (player?.z || 0) + Math.cos(this.cameraYaw) * 24,
      };
      this.squadMarker = target;
      const my = groundHeightAt(target.x, target.z, this.mode);
      this.squadMarkerMesh.position.set(target.x, my, target.z);
      this.squadMarkerMesh.visible = true;
      this.squadStatusMessage = 'Squad: Moving to marked coordinates.';
    } else if (cmd === 'follow') {
      this.squadStatusMessage = 'Squad: Following your lead.';
    } else if (cmd === 'hold') {
      this.squadStatusMessage = 'Squad: Holding current position.';
    } else if (cmd === 'regroup') {
      this.squadStatusMessage = 'Squad: Regrouping on squad leader!';
    } else if (cmd === 'assist') {
      this.squadStatusMessage = 'Squad: Prioritizing teammate assistance!';
    }

    for (const ally of this.actors) {
      if (!ally.isPlayer && ally.isSquadAlly && !ally.eliminated) {
        if (cmd === 'follow' || cmd === 'regroup') {
          ally.aiState = 'Following';
        } else if (cmd === 'hold') {
          ally.aiState = 'Idle';
        } else if (cmd === 'move_marker' && this.squadMarker) {
          ally.aiState = 'MovingToDestination';
          ally.aiTargetPos = { ...this.squadMarker };
        } else if (cmd === 'assist') {
          ally.aiState = 'AssistingTeammate';
        }
      }
    }
  }

  public buyArenaItem(itemId: string) {
    if (this.mode !== 'clash_arena') return;
    const player = this.getPlayer();
    if (!player) return;

    if (itemId === 'shield_full') {
      if (this.arenaCredits >= 250 && player.shield < 100) {
        this.arenaCredits -= 250;
        player.shield = 100;
        soundEngine.playPickup();
      }
      return;
    }
    if (itemId === 'cover_pack') {
      if (this.arenaCredits >= 200) {
        this.arenaCredits -= 200;
        player.coverGadgets += 2;
        soundEngine.playPickup();
      }
      return;
    }

    const eq = EQUIPMENT_CATALOG[itemId];
    if (eq && this.arenaCredits >= eq.arenaCost) {
      this.arenaCredits -= eq.arenaCost;
      player.secondaryWeapon = player.weapon;
      player.secondaryClipAmmo = player.clipAmmo;
      player.weapon = eq;
      player.clipAmmo = eq.energyCapacity;
      soundEngine.playPickup();
    }
  }

  public selectTrainingTrial(index: number) {
    if (this.mode !== 'training') return;
    this.trainingState.activeTrialIndex = index;
    this.trainingState.currentTimerSec = 0;
    this.trainingState.isRunning = true;
    const trial = this.trainingState.trials[index];
    if (trial) {
      trial.progress = 0;
    }
    if (this.worldData) {
      for (const t of this.worldData.trainingTargets) {
        t.hit = false;
        t.mesh.visible = true;
      }
    }
    soundEngine.playClick();
  }

  public cycleSpectatorTarget(delta: number) {
    const alive = this.actors.filter((a) => !a.eliminated && !a.isPlayer);
    if (alive.length === 0) return;
    this.spectatingIndex =
      (this.spectatingIndex + delta + alive.length) % alive.length;
    soundEngine.playClick();
  }

  public enterSpectatorMode() {
    const alive = this.actors.filter((a) => !a.eliminated && !a.isPlayer);
    if (alive.length === 0) {
      this.phase = 'defeat';
      return;
    }
    this.phase = 'spectating';
    this.spectatingIndex = 0;
    this.emitHUDSnapshot();
  }

  public finishSpectatingToResults() {
    this.phase = 'defeat';
    this.emitHUDSnapshot();
  }

  public setPaused(paused: boolean) {
    if (paused && (this.phase === 'active' || this.phase === 'deployment')) {
      this.phase = 'paused';
    } else if (!paused && this.phase === 'paused') {
      this.phase = 'active';
    }
    this.emitHUDSnapshot();
  }

  public returnToLobby() {
    this.cleanupMatchEntities();
    this.phase = 'lobby';
    this.lobbyGroup.visible = true;
    soundEngine.startMenuMusic();
    this.emitHUDSnapshot();
  }

  private cleanupMatchEntities() {
    if (this.worldData) {
      this.scene.remove(this.worldData.worldGroup);
      this.worldData.dispose();
      this.worldData = null;
    }
    this.actorsGroup.clear();
    this.lootGroup.clear();
    this.projectilesGroup.clear();
    this.effectsGroup.clear();
    this.actors = [];
    this.lootItems.clear();
    this.projectiles = [];
    this.activeBarriers = [];
    this.vehicles = [];
    this.activeDriverVehicleId = null;
    this.impactEffects = [];
    this.damagePopups = [];
    this.hitMarkerTimer = 0;
    this.takingDamageFlashTimer = 0;
    this.cameraShakeTimer = 0;
    this.zoneRingMesh.visible = false;
    this.nextZoneRingMesh.visible = false;
    this.transportMesh.visible = false;
    this.coverPreviewMesh.visible = false;
    this.squadMarkerMesh.visible = false;
  }

  private getPlayer(): ContestantActor | undefined {
    return this.actors.find((a) => a.isPlayer);
  }

  private findNearestLoot(
    x: number,
    z: number,
    maxDist: number
  ): { data: WorldCollectible; mesh: THREE.Group } | null {
    let best: { data: WorldCollectible; mesh: THREE.Group } | null = null;
    let bestD = maxDist;
    for (const entry of this.lootItems.values()) {
      if (entry.data.collected) continue;
      const d = Math.hypot(entry.data.x - x, entry.data.z - z);
      if (d < bestD) {
        bestD = d;
        best = entry;
      }
    }
    return best;
  }

  private applyLootToActor(actor: ContestantActor, loot: WorldCollectible) {
    if (loot.type === 'equipment' && loot.equipmentId) {
      const eq = EQUIPMENT_CATALOG[loot.equipmentId];
      if (eq) {
        if (!actor.secondaryWeapon && actor.weapon.id !== eq.id) {
          actor.secondaryWeapon = actor.weapon;
          actor.secondaryClipAmmo = actor.clipAmmo;
        }
        actor.weapon = eq;
        actor.clipAmmo = eq.energyCapacity;
        actor.reserveAmmo += eq.energyCapacity * 2;
      }
    } else if (loot.type === 'health_kit') {
      actor.medKits += loot.amount;
    } else if (loot.type === 'armor_upgrade') {
      actor.armorLevel = Math.min(3, actor.armorLevel + 1);
      actor.shield = Math.min(actor.maxShield, actor.shield + loot.amount);
    } else if (loot.type === 'cover_gadget') {
      actor.coverGadgets += loot.amount;
    } else if (loot.type === 'energy_ammo') {
      actor.reserveAmmo += loot.amount;
    }
  }

  // Main Simulation Tick
  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const dt = Math.min(rawDt, 0.05);
    const elapsed = now / 1000;

    if (rawDt > 0) {
      this.fpsSmooth = THREE.MathUtils.lerp(this.fpsSmooth, 1 / rawDt, 0.08);
    }

    if (this.phase === 'lobby') {
      this.updateLobbyTick(dt, elapsed);
    } else if (this.phase !== 'paused') {
      this.updateActiveSimulation(dt, elapsed);
    }

    this.renderer.render(this.scene, this.camera);

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.08) {
      this.hudEmitTimer = 0;
      this.emitHUDSnapshot();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop() {
    this.lastFrameTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  private updateLobbyTick(dt: number, elapsed: number) {
    this.camera.position.set(0, 1.55, 3.85);
    this.camera.lookAt(0, 1.15, 0);
    if (this.lobbyCharRig) {
      const anim: CharacterAnimState =
        this.saveData.selectedVictoryPose === 'champion' ? 'victory' : 'idle';
      updateCharacterAnimation(
        this.lobbyCharRig,
        anim,
        'standing',
        elapsed,
        dt
      );
    }
  }

  private updateActiveSimulation(dt: number, elapsed: number) {
    this.matchTimeSec += dt;

    // 1. Deployment Phase (Transport Aircraft Flyover)
    if (this.phase === 'deployment') {
      this.transportMesh.position.x += 22 * dt;
      this.transportMesh.position.z += 18 * dt;
      const player = this.getPlayer();
      if (player) {
        player.x = this.transportMesh.position.x;
        player.y = this.transportMesh.position.y - 2;
        player.z = this.transportMesh.position.z;
        player.rig.root.position.set(player.x, player.y, player.z);
      }
      this.camera.position.set(
        this.transportMesh.position.x - 18,
        this.transportMesh.position.y + 10,
        this.transportMesh.position.z - 18
      );
      this.camera.lookAt(this.transportMesh.position);

      if (this.matchTimeSec > 9.5) {
        this.deployFromAircraft();
      }
      return;
    }

    // 2. Clash Arena Prep & Round Timers
    if (this.mode === 'clash_arena') {
      if (this.phase === 'prep_buy') {
        this.arenaPrepTimerSec -= dt;
        if (this.arenaPrepTimerSec <= 0) {
          this.phase = 'active';
          this.arenaBannerText = `ROUND ${this.arenaRound} — FIGHT!`;
        }
      } else if (this.phase === 'active') {
        this.arenaRoundTimerSec -= dt;
        if (this.arenaRoundTimerSec <= 0) {
          this.resolveClashArenaTiebreaker();
        }
      }
    }

    // 3. Safe-Zone Update (Battle Royale Solo & Squad)
    if (
      (this.mode === 'br_solo' || this.mode === 'br_squad') &&
      (this.phase === 'active' || this.phase === 'spectating')
    ) {
      this.updateSafeZone(dt);
    }

    // 4. Update Temporary Cover Barriers & Combat Feedback Timers
    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
    }
    if (this.takingDamageFlashTimer > 0) {
      this.takingDamageFlashTimer = Math.max(0, this.takingDamageFlashTimer - dt);
    }
    if (this.cameraShakeTimer > 0) {
      this.cameraShakeTimer = Math.max(0, this.cameraShakeTimer - dt);
    }

    // Expire floating damage numbers after 0.85s
    if (this.damagePopups.length > 0) {
      this.damagePopups = this.damagePopups.filter(
        (dp) => this.matchTimeSec - dp.createdAt < 0.85
      );
    }

    // Update & clean up 3D surface impact bursts
    for (let i = this.impactEffects.length - 1; i >= 0; i--) {
      const fx = this.impactEffects[i];
      const rem = fx.expiresAt - this.matchTimeSec;
      if (rem <= 0) {
        this.effectsGroup.remove(fx.mesh);
        (fx.mesh.material as THREE.Material).dispose();
        this.impactEffects.splice(i, 1);
      } else {
        const progress = 1 - rem / fx.maxDuration;
        const s = 1 + progress * 1.9;
        fx.mesh.scale.set(s, s, s);
        const mat = fx.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, (1 - progress) * 0.85);
      }
    }

    for (let i = this.activeBarriers.length - 1; i >= 0; i--) {
      const b = this.activeBarriers[i];
      if (this.matchTimeSec >= b.expiresAt) {
        this.effectsGroup.remove(b.mesh);
        if (this.worldData) {
          this.worldData.colliders = this.worldData.colliders.filter(
            (c) => c.id !== b.colliderId
          );
        }
        this.activeBarriers.splice(i, 1);
      }
    }

    // 5. Update Player & Vehicle Movement
    const player = this.getPlayer();
    if (player && !player.eliminated && this.phase === 'active') {
      if (this.activeDriverVehicleId) {
        this.updateVehiclePhysics(player, dt);
      } else {
        this.updatePlayerController(player, dt);
      }
    }

    // 6. Update AI Teammates & Opponents
    for (const actor of this.actors) {
      if (actor.isPlayer || actor.eliminated) continue;
      this.updateAIActor(actor, dt, elapsed);
    }

    // 7. Update Character Visual Rigs & World Matrices
    for (const actor of this.actors) {
      if (actor.eliminated) continue;
      actor.rig.root.position.set(actor.x, actor.y, actor.z);
      actor.rig.root.rotation.y = actor.yaw;
      updateCharacterAnimation(
        actor.rig,
        actor.animState,
        actor.stance,
        elapsed,
        dt
      );
      actor.rig.root.updateMatrixWorld(true);
    }

    // 8. Update Camera FIRST so World-Space Reticle Raycast matches rendered view 100%
    this.updateCameraFollow(dt);
    this.camera.updateMatrixWorld(true);

    // 9. Compute Exact World-Space Crossbow Aiming, Orient Weapon Muzzle, & Fire
    if (
      player &&
      !player.eliminated &&
      this.phase === 'active' &&
      !this.activeDriverVehicleId &&
      player.stance !== 'parachuting' &&
      player.stance !== 'downed'
    ) {
      this.updatePlayerAimAndCombat(player);
    } else {
      this.aimDebugGroup.visible = false;
    }

    // 10. Update Projectiles & Hit Detection
    this.updateProjectiles(dt);

    // 11. Update Training Grounds Trials
    if (this.mode === 'training' && player) {
      this.updateTrainingTrials(player, dt);
    }

    // 12. Check Match / Round Win Conditions
    this.evaluateMatchOutcome();
  }

  private updateSafeZone(dt: number) {
    this.zoneTimerSec -= dt;
    if (this.zoneTimerSec <= 0) {
      if (!this.zoneShrinking) {
        this.zoneShrinking = true;
        this.zoneTimerSec = 22;
        soundEngine.playZoneWarning();
      } else {
        this.zoneShrinking = false;
        this.zoneStage++;
        this.zoneCenter = { ...this.nextZoneCenter };
        this.zoneRadius = this.nextZoneRadius;
        this.nextZoneRadius = Math.max(16, this.zoneRadius * 0.58);
        this.nextZoneCenter = {
          x: this.zoneCenter.x + (Math.random() - 0.5) * 28,
          z: this.zoneCenter.z + (Math.random() - 0.5) * 28,
        };
        this.zoneTimerSec = 30;
      }
    }

    if (this.zoneShrinking) {
      this.zoneCenter.x = THREE.MathUtils.damp(
        this.zoneCenter.x,
        this.nextZoneCenter.x,
        0.15,
        dt
      );
      this.zoneCenter.z = THREE.MathUtils.damp(
        this.zoneCenter.z,
        this.nextZoneCenter.z,
        0.15,
        dt
      );
      this.zoneRadius = THREE.MathUtils.damp(
        this.zoneRadius,
        this.nextZoneRadius,
        0.15,
        dt
      );
    }

    this.zoneRingMesh.position.set(this.zoneCenter.x, 12, this.zoneCenter.z);
    this.zoneRingMesh.scale.set(this.zoneRadius, 1, this.zoneRadius);

    this.nextZoneRingMesh.position.set(
      this.nextZoneCenter.x,
      0.4,
      this.nextZoneCenter.z
    );
    this.nextZoneRingMesh.scale.set(
      this.nextZoneRadius,
      this.nextZoneRadius,
      1
    );

    // Apply zone energy penalty every 1.0s
    this.zoneTickTimer += dt;
    if (this.zoneTickTimer >= 1.0) {
      this.zoneTickTimer = 0;
      const zoneDamage = 3 + this.zoneStage * 2;
      for (const actor of this.actors) {
        if (actor.eliminated || actor.stance === 'parachuting') continue;
        const d = Math.hypot(
          actor.x - this.zoneCenter.x,
          actor.z - this.zoneCenter.z
        );
        if (d > this.zoneRadius) {
          this.applyDamage(actor, zoneDamage, null, 'Safe Zone');
        }
      }
    }
  }

  private updateVehiclePhysics(player: ContestantActor, dt: number) {
    const veh = this.vehicles.find((v) => v.id === this.activeDriverVehicleId);
    if (!veh || veh.disabled) {
      this.toggleVehicleEnterExit();
      return;
    }

    const accelInput = this.input.braking ? 0 : this.input.moveZ;
    const steerInput = -this.input.moveX;

    const targetSpeed = accelInput * veh.maxSpeed;
    const dampRate = this.input.braking ? 11.0 : 4.8;
    veh.speed = THREE.MathUtils.damp(veh.speed, targetSpeed, dampRate, dt);

    if (Math.abs(veh.speed) > 0.35) {
      const turnDir = veh.speed >= 0 ? 1 : -1;
      veh.yaw += steerInput * veh.turnRate * turnDir * dt;
      soundEngine.playVehicleEnginePulse(Math.abs(veh.speed) / veh.maxSpeed);
    }

    const nextX = veh.x + Math.sin(veh.yaw) * veh.speed * dt;
    const nextZ = veh.z + Math.cos(veh.yaw) * veh.speed * dt;
    const nextY = groundHeightAt(nextX, nextZ, this.mode);

    const col = resolveHorizontalCollision(
      nextX,
      nextY,
      nextZ,
      veh.type === 'moto' ? 0.9 : 1.5,
      1.9,
      this.worldData?.colliders || []
    );
    if (col.hitWall) {
      if (Math.abs(veh.speed) > 10) {
        veh.health = Math.max(0, veh.health - Math.abs(veh.speed) * 0.8);
        this.triggerCameraShake(0.18, 0.15);
        soundEngine.playSurfaceImpact('wall');
      }
      veh.speed *= 0.25;
      if (veh.health <= 0) {
        veh.disabled = true;
        this.spawnImpactBurst(veh.x, veh.y + 0.8, veh.z, '#FF6B1A', 0.45);
        this.toggleVehicleEnterExit();
        return;
      }
    }

    veh.x = THREE.MathUtils.clamp(col.x, -180, 180);
    veh.z = THREE.MathUtils.clamp(col.z, -180, 180);
    veh.y = groundHeightAt(veh.x, veh.z, this.mode);

    veh.mesh.root.position.set(veh.x, veh.y, veh.z);
    veh.mesh.root.rotation.y = veh.yaw;

    for (const w of veh.mesh.wheels) {
      w.rotation.x += veh.speed * dt * 1.9;
    }

    player.x = veh.x;
    player.y = veh.y;
    player.z = veh.z;
    player.yaw = veh.yaw;

    // Gently align camera behind vehicle heading while driving forward
    if (Math.abs(veh.speed) > 1.8) {
      let angleDiff = veh.yaw - this.cameraYaw;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.cameraYaw += angleDiff * Math.min(1, dt * 2.6);
    }
  }

  private updatePlayerController(player: ContestantActor, dt: number) {
    // Handle downed state
    if (player.stance === 'downed') {
      player.downedTimer -= dt;
      if (player.downedTimer <= 0) {
        this.finalizeElimination(player, null, 'Bled out');
      }
      return;
    }

    // Track visited Sunset Island regions
    if (this.mode === 'br_solo' || this.mode === 'br_squad') {
      for (const reg of SUNSET_ISLAND_REGIONS) {
        if (
          Math.hypot(player.x - reg.x, player.z - reg.z) <= reg.radius
        ) {
          this.regionsVisitedInMatch.add(reg.id);
        }
      }
    }

    // Parachute descent
    if (player.stance === 'parachuting') {
      const forwardX = Math.sin(this.cameraYaw);
      const forwardZ = Math.cos(this.cameraYaw);
      const rightX = Math.cos(this.cameraYaw);
      const rightZ = -Math.sin(this.cameraYaw);

      const glideSpeed = 16;
      const moveX =
        (forwardX * Math.max(0.25, this.input.moveZ) -
          rightX * this.input.moveX) *
        glideSpeed;
      const moveZ =
        (forwardZ * Math.max(0.25, this.input.moveZ) -
          rightZ * this.input.moveX) *
        glideSpeed;

      player.x = THREE.MathUtils.clamp(player.x + moveX * dt, -175, 175);
      player.z = THREE.MathUtils.clamp(player.z + moveZ * dt, -175, 175);
      player.vy = THREE.MathUtils.damp(player.vy, -8.5, 4, dt);
      player.y += player.vy * dt;
      player.yaw = this.cameraYaw;

      const supportY = getSupportHeightAt(
        player.x,
        player.z,
        player.y,
        this.mode,
        this.worldData?.walkableSurfaces || []
      );
      if (player.y <= supportY + 0.15) {
        player.y = supportY;
        player.vy = 0;
        player.stance = 'standing';
        player.animState = 'landing';
        this.landedInMatch = true;
        soundEngine.playLand();
      }
      return;
    }

    // Ground / Rooftop Movement
    const sens = this.settings.movementSensitivity ?? 1.0;
    const rawMag = Math.hypot(this.input.moveX, this.input.moveZ);
    const moveMag = Math.min(1, rawMag * sens);

    let baseSpeed = 6.8;
    if (this.input.sprint && player.stance === 'standing' && !this.input.aiming) {
      baseSpeed = 9.8;
    } else if (player.stance === 'crouching') {
      baseSpeed = 4.2;
    } else if (player.stance === 'prone') {
      baseSpeed = 2.4;
    } else if (this.input.aiming) {
      baseSpeed = 4.5;
    }

    const forwardX = Math.sin(this.cameraYaw);
    const forwardZ = Math.cos(this.cameraYaw);
    const rightX = Math.cos(this.cameraYaw);
    const rightZ = -Math.sin(this.cameraYaw);

    let targetVx = 0;
    let targetVz = 0;
    if (moveMag > 0.04) {
      const normX = this.input.moveX / (rawMag || 1);
      const normZ = this.input.moveZ / (rawMag || 1);
      const dirX = forwardX * normZ - rightX * normX;
      const dirZ = forwardZ * normZ - rightZ * normX;
      targetVx = dirX * baseSpeed * moveMag;
      targetVz = dirZ * baseSpeed * moveMag;

      if (!this.input.aiming && !this.input.firing) {
        player.yaw = Math.atan2(dirX, dirZ);
      }
      soundEngine.playFootstep(baseSpeed > 8);
    }

    if (this.input.aiming || this.input.firing) {
      player.yaw = this.cameraYaw;
    }

    player.vx = THREE.MathUtils.damp(player.vx, targetVx, 14, dt);
    player.vz = THREE.MathUtils.damp(player.vz, targetVz, 14, dt);

    const nextX = player.x + player.vx * dt;
    const nextZ = player.z + player.vz * dt;

    const boundLimit = this.mode === 'clash_arena' ? 37.5 : 182;
    const clampedX = THREE.MathUtils.clamp(nextX, -boundLimit, boundLimit);
    const clampedZ = THREE.MathUtils.clamp(nextZ, -boundLimit, boundLimit);

    const resolved = resolveHorizontalCollision(
      clampedX,
      player.y,
      clampedZ,
      0.42,
      player.stance === 'prone' ? 0.6 : player.stance === 'crouching' ? 1.2 : 1.75,
      this.worldData?.colliders || []
    );
    player.x = resolved.x;
    player.z = resolved.z;

    // Gravity & Floor/Stair Support
    const supportY = getSupportHeightAt(
      player.x,
      player.z,
      player.y,
      this.mode,
      this.worldData?.walkableSurfaces || []
    );
    if (player.y > supportY + 0.05 || player.vy > 0) {
      const prevVy = player.vy;
      player.vy -= 22 * dt;
      player.y += player.vy * dt;
      if (player.y <= supportY) {
        player.y = supportY;
        player.vy = 0;
        if (prevVy < -4.5) {
          soundEngine.playLand();
        }
      }
    } else {
      player.y = THREE.MathUtils.damp(player.y, supportY, 18, dt);
      player.vy = 0;
    }

    // Optional Auto-Pickup for consumables / ammo
    if (this.settings.autoPickupInteract) {
      const autoItem = this.findNearestLoot(player.x, player.z, 2.2);
      if (autoItem && autoItem.data.type !== 'equipment') {
        this.applyLootToActor(player, autoItem.data);
        autoItem.data.collected = true;
        autoItem.mesh.visible = false;
        this.suppliesCollectedInMatch++;
        soundEngine.playPickup();
      }
    }

    // Animation state determination
    if (player.y > supportY + 0.25) {
      player.animState = 'jumping';
    } else if (this.input.firing || this.input.aiming) {
      player.animState = 'aiming';
    } else if (moveMag > 0.1) {
      if (baseSpeed > 8.5) player.animState = 'sprinting';
      else if (player.stance === 'crouching') player.animState = 'crouching';
      else if (player.stance === 'prone') player.animState = 'prone';
      else player.animState = 'running';
    } else {
      player.animState = 'idle';
    }

    // Cover Placement Preview update
    if (this.input.coverPreview && player.coverGadgets > 0) {
      const bx = player.x + Math.sin(this.cameraYaw) * 3.2;
      const bz = player.z + Math.cos(this.cameraYaw) * 3.2;
      const by = getSupportHeightAt(
        bx,
        bz,
        player.y,
        this.mode,
        this.worldData?.walkableSurfaces || []
      );
      this.coverPreviewMesh.visible = true;
      this.coverPreviewMesh.position.set(bx, by, bz);
      this.coverPreviewMesh.rotation.y = this.cameraYaw;
    } else {
      this.coverPreviewMesh.visible = false;
    }

    // Weapon Cooldown & Reloading timers
    if (player.fireCooldownTimer > 0) {
      player.fireCooldownTimer = Math.max(0, player.fireCooldownTimer - dt);
    }
    if (player.reloadTimer > 0) {
      player.reloadTimer -= dt;
      if (player.reloadTimer <= 0) {
        player.reloadTimer = 0;
        const needed = player.weapon.energyCapacity - player.clipAmmo;
        const take = Math.min(needed, player.reserveAmmo);
        player.clipAmmo += take;
        player.reserveAmmo -= take;
      }
    }

    // Assist nearby downed squadmate automatically when standing close
    const downedAlly = this.findNearbyDownedAlly(player);
    if (downedAlly) {
      this.reviveHoldTimer += dt;
      if (this.reviveHoldTimer >= 2.5) {
        this.reviveHoldTimer = 0;
        downedAlly.stance = 'standing';
        downedAlly.health = 50;
        downedAlly.downedTimer = 0;
        this.teamCommandsUsedCount++;
        soundEngine.playPickup();
      }
    } else {
      this.reviveHoldTimer = 0;
    }
  }

  /**
   * 10-Step World-Space Aiming Architecture:
   * 1. Identifies active PerspectiveCamera and its world-space position.
   * 2. Uses exact center-screen reticle NDC (0, 0).
   * 3. Casts a world-space ray from camera through (0, 0).
   * 4. Raycasts against colliders, enemies, training targets, and terrain.
   * 5. Uses fallback point along ray if nothing is hit.
   * 6. Orients crossbow model toward target and reads exact world-space muzzleNode origin.
   * 7. Computes normalized direction vector from muzzle origin to intended target.
   * 8-10. Spawns oriented projectile at crossbow muzzle traveling along that exact direction.
   */
  private updatePlayerAimAndCombat(player: ContestantActor) {
    // Steps 1-3: Cast ray from camera through center reticle (0, 0)
    this.aimRaycaster.setFromCamera(this.centerNdc, this.camera);
    const camPos = this.aimRaycaster.ray.origin;
    const rayDir = this.aimRaycaster.ray.direction;

    const playerChestY =
      player.y + (player.stance === 'crouching' ? 0.95 : 1.35);
    const camToPlayerDist = Math.hypot(
      player.x - camPos.x,
      playerChestY - camPos.y,
      player.z - camPos.z
    );
    // Start environment ray slightly ahead of player body so camera shoulder offset never hits walls behind player
    const minRayT = Math.max(1.2, camToPlayerDist + 0.25);
    const maxRayT = 160;
    let bestT = maxRayT;

    const rayStart = camPos.clone().addScaledVector(rayDir, minRayT);
    const rayEnd = camPos.clone().addScaledVector(rayDir, maxRayT);
    const colliders = this.worldData?.colliders || [];

    // Step 4A: Check world & cover barrier colliders
    const wallHit = castSegmentAgainstColliders(
      rayStart.x,
      rayStart.y,
      rayStart.z,
      rayEnd.x,
      rayEnd.y,
      rayEnd.z,
      colliders
    );
    if (wallHit.hit) {
      const hitDist = Math.hypot(
        wallHit.hitX - camPos.x,
        wallHit.hitY - camPos.y,
        wallHit.hitZ - camPos.z
      );
      if (hitDist >= minRayT && hitDist < bestT) {
        bestT = hitDist;
      }
    }

    // Step 4B: Check Training Grounds targets
    if (this.mode === 'training' && this.worldData) {
      for (const t of this.worldData.trainingTargets) {
        if (t.hit) continue;
        const toTargetX = t.x - camPos.x;
        const toTargetY = t.y - camPos.y;
        const toTargetZ = t.z - camPos.z;
        const projT =
          toTargetX * rayDir.x + toTargetY * rayDir.y + toTargetZ * rayDir.z;
        if (projT >= minRayT && projT < bestT) {
          const px = camPos.x + rayDir.x * projT - t.x;
          const py = camPos.y + rayDir.y * projT - t.y;
          const pz = camPos.z + rayDir.z * projT - t.z;
          const perpDist = Math.hypot(px, py, pz);
          if (perpDist <= 0.95) {
            bestT = projT;
          }
        }
      }
    }

    // Step 4C: Check Enemy Contestants + Optional Subtle Aim Assist
    let assistTargetPoint: THREE.Vector3 | null = null;
    let bestAssistAngle =
      0.042 * THREE.MathUtils.clamp(this.settings.aimAssistStrength ?? 0.45, 0.1, 1.0);

    for (const actor of this.actors) {
      if (
        actor.eliminated ||
        actor.id === player.id ||
        actor.teamId === player.teamId
      ) {
        continue;
      }
      const actorCenterY =
        actor.y + (actor.stance === 'crouching' ? 0.65 : 0.98);
      const dx = actor.x - camPos.x;
      const dy = actorCenterY - camPos.y;
      const dz = actor.z - camPos.z;
      const projT = dx * rayDir.x + dy * rayDir.y + dz * rayDir.z;
      if (projT < minRayT || projT > bestT) continue;

      const perpX = camPos.x + rayDir.x * projT - actor.x;
      const perpY = camPos.y + rayDir.y * projT - actorCenterY;
      const perpZ = camPos.z + rayDir.z * projT - actor.z;
      const perpDist = Math.hypot(perpX, perpY, perpZ);

      if (perpDist <= 0.62) {
        bestT = projT;
        assistTargetPoint = new THREE.Vector3(actor.x, actorCenterY, actor.z);
      } else if (
        this.settings.aimAssist &&
        projT <= player.weapon.effectiveRange
      ) {
        const angle = Math.atan2(perpDist, projT);
        if (angle < bestAssistAngle) {
          const los = castSegmentAgainstColliders(
            camPos.x,
            camPos.y,
            camPos.z,
            actor.x,
            actorCenterY,
            actor.z,
            colliders
          );
          if (!los.hit) {
            bestAssistAngle = angle;
            const rawRayPoint = camPos.clone().addScaledVector(rayDir, projT);
            const enemyChest = new THREE.Vector3(actor.x, actorCenterY, actor.z);
            assistTargetPoint = rawRayPoint.lerp(enemyChest, 0.55);
          }
        }
      }
    }

    // Step 4D: Check Ground Terrain intersection when looking downward
    if (rayDir.y < -0.02) {
      for (let t = minRayT; t < bestT; t += 2.0) {
        const gx = camPos.x + rayDir.x * t;
        const gy = camPos.y + rayDir.y * t;
        const gz = camPos.z + rayDir.z * t;
        const terrainY = groundHeightAt(gx, gz, this.mode);
        if (gy <= terrainY) {
          bestT = Math.max(minRayT, t - 0.5);
          break;
        }
      }
    }

    // Step 5: Determine Intended 3D World Target Point
    const intendedTarget =
      assistTargetPoint || camPos.clone().addScaledVector(rayDir, bestT);

    // Step 6: Orient Crossbow Model toward Intended Target & Read Muzzle World Origin
    if (this.input.aiming || this.input.firing) {
      player.rig.weaponMesh.lookAt(intendedTarget);
      player.rig.weaponMesh.updateMatrixWorld(true);
    }

    const muzzleOrigin = new THREE.Vector3();
    player.rig.muzzleNode.getWorldPosition(muzzleOrigin);

    // Prevent muzzle origin from clipping through a wall if player stands flush against one
    const chestCheck = castSegmentAgainstColliders(
      player.x,
      playerChestY,
      player.z,
      muzzleOrigin.x,
      muzzleOrigin.y,
      muzzleOrigin.z,
      colliders
    );
    if (chestCheck.hit) {
      muzzleOrigin.set(
        THREE.MathUtils.lerp(player.x, chestCheck.hitX, 0.7),
        THREE.MathUtils.lerp(playerChestY, chestCheck.hitY, 0.7),
        THREE.MathUtils.lerp(player.z, chestCheck.hitZ, 0.7)
      );
    }

    // Step 7: Calculate Normalized Firing Direction from Muzzle Origin -> Intended Target
    const fireDir = intendedTarget.clone().sub(muzzleOrigin);
    if (fireDir.lengthSq() < 0.25 || fireDir.dot(rayDir) < 0.15) {
      fireDir.copy(rayDir).normalize();
    } else {
      fireDir.normalize();
    }

    this.currentAimOrigin.copy(muzzleOrigin);
    this.currentAimTarget.copy(intendedTarget);
    this.currentAimDir.copy(fireDir);

    // Update optional 3D Aim Debug Visualizer
    if (this.settings.showAimDebug) {
      this.aimDebugGroup.visible = true;
      this.aimDebugMuzzleDot.position.copy(muzzleOrigin);
      this.aimDebugTargetDot.position.copy(intendedTarget);
      this.aimDebugCamLine.geometry.setFromPoints([
        camPos.clone().add(new THREE.Vector3(0, -0.08, 0)),
        intendedTarget,
      ]);
      this.aimDebugMuzzleLine.geometry.setFromPoints([
        muzzleOrigin,
        intendedTarget,
      ]);
    } else {
      this.aimDebugGroup.visible = false;
    }

    // Step 8-9: Fire Weapon if Trigger Held
    if (
      this.input.firing &&
      player.reloadTimer <= 0 &&
      player.fireCooldownTimer <= 0
    ) {
      if (player.clipAmmo > 0) {
        this.fireProjectileFromOrigin(
          player,
          this.currentAimOrigin,
          this.currentAimDir
        );
      } else if (player.reserveAmmo > 0) {
        this.triggerReload();
      }
    }
  }

  private findNearbyDownedAlly(actor: ContestantActor): ContestantActor | null {
    for (const other of this.actors) {
      if (
        other.id !== actor.id &&
        other.teamId === actor.teamId &&
        !other.eliminated &&
        other.stance === 'downed'
      ) {
        if (Math.hypot(other.x - actor.x, other.z - actor.z) <= 3.4) {
          return other;
        }
      }
    }
    return null;
  }

  private fireActorWeapon(actor: ContestantActor, aimPitch: number) {
    const muzzleOrigin = new THREE.Vector3();
    actor.rig.root.updateMatrixWorld(true);
    actor.rig.muzzleNode.getWorldPosition(muzzleOrigin);

    const forwardX = Math.sin(actor.yaw) * Math.cos(aimPitch);
    const forwardY = Math.sin(aimPitch);
    const forwardZ = Math.cos(actor.yaw) * Math.cos(aimPitch);
    const baseDir = new THREE.Vector3(forwardX, forwardY, forwardZ).normalize();

    this.fireProjectileFromOrigin(actor, muzzleOrigin, baseDir);
  }

  private spawnImpactBurst(
    x: number,
    y: number,
    z: number,
    colorHex: string,
    duration = 0.22
  ) {
    if (this.settings.combatEffects === 'low' && this.impactEffects.length >= 4) {
      return;
    }
    const maxCap =
      this.settings.combatEffects === 'high'
        ? 16
        : this.settings.combatEffects === 'medium'
        ? 10
        : 5;
    if (this.impactEffects.length >= maxCap) {
      const oldest = this.impactEffects.shift()!;
      this.effectsGroup.remove(oldest.mesh);
      (oldest.mesh.material as THREE.Material).dispose();
    }

    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(this.sharedImpactGeo, mat);
    mesh.position.set(x, y, z);
    this.effectsGroup.add(mesh);
    this.impactEffects.push({
      mesh,
      expiresAt: this.matchTimeSec + duration,
      maxDuration: duration,
    });
  }

  private triggerCameraShake(duration: number, baseIntensity: number) {
    if (this.settings.cameraShake === 'off') return;
    const mult = this.settings.cameraShake === 'high' ? 1.35 : 0.65;
    this.cameraShakeTimer = Math.max(this.cameraShakeTimer, duration);
    this.cameraShakeIntensity = baseIntensity * mult;
  }

  private spawnDamagePopup(
    worldX: number,
    worldY: number,
    worldZ: number,
    amount: number,
    isShield: boolean
  ) {
    if (!this.settings.damageNumbersEnabled) return;
    const v = new THREE.Vector3(worldX, worldY, worldZ);
    v.project(this.camera);
    if (v.z > 1) return; // behind camera

    const screenX = THREE.MathUtils.clamp((v.x * 0.5 + 0.5) * 100, 12, 88);
    const screenY = THREE.MathUtils.clamp((-v.y * 0.5 + 0.5) * 100, 14, 84);

    const popup: CombatDamagePopup = {
      id: `dmg_${Date.now()}_${Math.random()}`,
      value: Math.max(1, Math.round(amount)),
      isShield,
      isCritical: amount >= 35,
      screenX: screenX + (Math.random() - 0.5) * 3,
      screenY: screenY + (Math.random() - 0.5) * 2,
      createdAt: this.matchTimeSec,
    };

    this.damagePopups = [...this.damagePopups.slice(-7), popup];
  }

  private fireProjectileFromOrigin(
    actor: ContestantActor,
    muzzleOrigin: THREE.Vector3,
    baseDir: THREE.Vector3
  ) {
    actor.clipAmmo = Math.max(0, actor.clipAmmo - 1);
    actor.fireCooldownTimer = actor.weapon.fireCooldown;
    actor.rig.recoilTimer = 0.14;

    // Broadcast combat sound position for AI awareness
    this.lastCombatSoundPos = {
      x: actor.x,
      z: actor.z,
      time: this.matchTimeSec,
    };

    if (actor.isPlayer) {
      soundEngine.playWeaponFire(actor.weapon.id);
      this.triggerCameraShake(0.08, 0.045);
    }

    // Muzzle flash pulse
    this.spawnImpactBurst(
      muzzleOrigin.x,
      muzzleOrigin.y,
      muzzleOrigin.z,
      actor.weapon.projectileColor,
      0.09
    );

    const pellets = actor.weapon.pellets || 1;
    let effectiveSpread = actor.weapon.spread;
    if (actor.isPlayer && this.input.aiming) {
      effectiveSpread *= 0.35;
    } else if (!actor.isPlayer) {
      // Scale AI spread by selected AI difficulty and movement
      const diff = this.settings.aiDifficulty || 'NORMAL';
      const diffSpreadMult =
        diff === 'EASY' ? 2.4 : diff === 'HARD' ? 0.75 : 1.35;
      effectiveSpread = Math.max(0.014, effectiveSpread) * diffSpreadMult;
    }

    for (let p = 0; p < pellets; p++) {
      const dir = baseDir.clone();
      if (effectiveSpread > 0) {
        const spreadX = (Math.random() - 0.5) * effectiveSpread * 2;
        const spreadY = (Math.random() - 0.5) * effectiveSpread * 1.5;
        const spreadZ = (Math.random() - 0.5) * effectiveSpread * 2;
        dir.add(new THREE.Vector3(spreadX, spreadY, spreadZ)).normalize();
      }

      // Oriented 3D Energy Crossbow Bolt / Projectile Mesh (faces +Z)
      const boltGroup = new THREE.Group();
      const shaftGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.58, 6);
      shaftGeo.rotateX(Math.PI / 2);
      const shaftMat = new THREE.MeshBasicMaterial({
        color: actor.weapon.projectileColor,
      });
      const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);

      const tipGeo = new THREE.ConeGeometry(0.072, 0.2, 6);
      tipGeo.rotateX(Math.PI / 2);
      const tipMesh = new THREE.Mesh(tipGeo, shaftMat);
      tipMesh.position.z = 0.3;

      boltGroup.add(shaftMesh, tipMesh);
      boltGroup.position.copy(muzzleOrigin);
      boltGroup.lookAt(
        muzzleOrigin.x + dir.x,
        muzzleOrigin.y + dir.y,
        muzzleOrigin.z + dir.z
      );
      this.projectilesGroup.add(boltGroup);

      this.projectiles.push({
        mesh: boltGroup,
        ownerId: actor.id,
        teamId: actor.teamId,
        x: muzzleOrigin.x,
        y: muzzleOrigin.y,
        z: muzzleOrigin.z,
        vx: dir.x * actor.weapon.projectileSpeed,
        vy: dir.y * actor.weapon.projectileSpeed,
        vz: dir.z * actor.weapon.projectileSpeed,
        damage: actor.weapon.damage,
        remainingRange: actor.weapon.effectiveRange,
      });
    }
  }

  private updateProjectiles(dt: number) {
    const colliders = this.worldData?.colliders || [];

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const nextX = p.x + p.vx * dt;
      const nextY = p.y + p.vy * dt;
      const nextZ = p.z + p.vz * dt;
      const stepDist = Math.hypot(nextX - p.x, nextY - p.y, nextZ - p.z);

      // 1. Check wall / cover barrier collision
      const wallHit = castSegmentAgainstColliders(
        p.x,
        p.y,
        p.z,
        nextX,
        nextY,
        nextZ,
        colliders
      );
      if (wallHit.hit) {
        this.spawnImpactBurst(
          wallHit.hitX,
          wallHit.hitY,
          wallHit.hitZ,
          '#FDE047',
          0.18
        );
        if (p.ownerId === 'player') {
          soundEngine.playSurfaceImpact('wall');
        }
        this.removeProjectileAt(i);
        continue;
      }

      // 2. Check Training Targets in Training Grounds
      if (this.mode === 'training' && this.worldData) {
        let hitTarget = false;
        for (const t of this.worldData.trainingTargets) {
          if (t.hit) continue;
          const segDx = nextX - p.x;
          const segDy = nextY - p.y;
          const segDz = nextZ - p.z;
          const segLenSq = segDx * segDx + segDy * segDy + segDz * segDz || 1;
          const u = THREE.MathUtils.clamp(
            ((t.x - p.x) * segDx + (t.y - p.y) * segDy + (t.z - p.z) * segDz) /
              segLenSq,
            0,
            1
          );
          const cx = p.x + u * segDx;
          const cy = p.y + u * segDy;
          const cz = p.z + u * segDz;
          const d = Math.hypot(cx - t.x, cy - t.y, cz - t.z);
          if (d < 0.98) {
            t.hit = true;
            t.mesh.visible = false;
            hitTarget = true;
            this.spawnImpactBurst(t.x, t.y, t.z, '#00E5FF', 0.3);
            this.spawnDamagePopup(t.x, t.y + 0.4, t.z, p.damage, false);
            if (this.settings.hitMarkersEnabled) {
              this.hitMarkerTimer = 0.22;
              this.hitMarkerIsElim = true;
            }
            soundEngine.playHitMarker(true);
            this.advanceTrainingTrial(3, 1);
            break;
          }
        }
        if (hitTarget) {
          this.removeProjectileAt(i);
          continue;
        }
      }

      // 3. Check Actor Hit Detection (Continuous segment check)
      let hitActor = false;
      for (const actor of this.actors) {
        if (
          actor.eliminated ||
          actor.id === p.ownerId ||
          actor.teamId === p.teamId
        ) {
          continue;
        }
        const actorCenterY =
          actor.y + (actor.stance === 'crouching' ? 0.65 : 0.95);
        const segDx = nextX - p.x;
        const segDy = nextY - p.y;
        const segDz = nextZ - p.z;
        const segLenSq = segDx * segDx + segDy * segDy + segDz * segDz || 1;
        const u = THREE.MathUtils.clamp(
          ((actor.x - p.x) * segDx +
            (actorCenterY - p.y) * segDy +
            (actor.z - p.z) * segDz) /
            segLenSq,
          0,
          1
        );
        const cx = p.x + u * segDx;
        const cy = p.y + u * segDy;
        const cz = p.z + u * segDz;

        const horizDist = Math.hypot(cx - actor.x, cz - actor.z);
        const vertDist = Math.abs(cy - actorCenterY);

        if (horizDist < 0.62 && vertDist < 0.98) {
          const attacker =
            this.actors.find((a) => a.id === p.ownerId) || null;
          const hadShield = actor.shield > 0;
          this.spawnImpactBurst(
            cx,
            cy,
            cz,
            hadShield ? '#00E5FF' : '#FF6B1A',
            0.24
          );
          this.applyDamage(
            actor,
            p.damage,
            attacker,
            attacker?.weapon.shortName || 'Crossbow'
          );
          hitActor = true;
          break;
        }
      }

      if (hitActor) {
        this.removeProjectileAt(i);
        continue;
      }

      // 4. Check Vehicle Hit Detection (Projectiles can damage & disable vehicles)
      let hitVehicle = false;
      for (const veh of this.vehicles) {
        if (veh.disabled || veh.driverId === p.ownerId) continue;
        const vDist = Math.hypot(nextX - veh.x, nextZ - veh.z);
        if (vDist < 1.8 && Math.abs(nextY - (veh.y + 0.9)) < 1.2) {
          veh.health = Math.max(0, veh.health - p.damage);
          this.spawnImpactBurst(nextX, nextY, nextZ, '#FACC15', 0.25);
          soundEngine.playSurfaceImpact('wall');
          if (veh.health <= 0 && !veh.disabled) {
            veh.disabled = true;
            this.spawnImpactBurst(veh.x, veh.y + 1.0, veh.z, '#FF6B1A', 0.45);
            if (this.activeDriverVehicleId === veh.id) {
              this.toggleVehicleEnterExit();
            }
          }
          hitVehicle = true;
          break;
        }
      }
      if (hitVehicle) {
        this.removeProjectileAt(i);
        continue;
      }

      p.x = nextX;
      p.y = nextY;
      p.z = nextZ;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      p.remainingRange -= stepDist;

      if (p.remainingRange <= 0 || p.y < -2) {
        this.removeProjectileAt(i);
      }
    }
  }

  private removeProjectileAt(index: number) {
    const p = this.projectiles[index];
    this.projectilesGroup.remove(p.mesh);
    p.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.projectiles.splice(index, 1);
  }

  private applyDamage(
    victim: ContestantActor,
    amount: number,
    attacker: ContestantActor | null,
    weaponLabel: string
  ) {
    if (victim.eliminated) return;

    victim.rig.hitFlashTimer = 0.16;
    const hadShield = victim.shield > 0;
    let remaining = amount;

    if (victim.shield > 0) {
      const absorbed = Math.min(victim.shield, remaining * 0.75);
      victim.shield = Math.max(0, victim.shield - absorbed);
      remaining -= absorbed;
    }

    victim.health = Math.max(0, victim.health - remaining);

    // Alert AI victim to attacker's position so it reacts
    if (!victim.isPlayer && attacker) {
      victim.aiLastSeenEnemyPos = {
        x: attacker.x,
        z: attacker.z,
        time: this.matchTimeSec,
      };
    }

    if (victim.isPlayer) {
      this.takingDamageFlashTimer = 0.25;
      this.triggerCameraShake(0.14, 0.08);
      soundEngine.playTakingDamage();
    }

    if (attacker?.isPlayer) {
      const isElim = victim.health <= 0;
      if (this.settings.hitMarkersEnabled) {
        this.hitMarkerTimer = isElim ? 0.32 : 0.18;
        this.hitMarkerIsElim = isElim;
      }
      this.spawnDamagePopup(
        victim.x,
        victim.y + 1.55,
        victim.z,
        amount,
        hadShield
      );
      soundEngine.playHitMarker(isElim);
      soundEngine.playSurfaceImpact(hadShield ? 'shield' : 'flesh');
    }

    if (victim.health <= 0) {
      // Check Squad Incapacitation (Downed state) if teammate is alive in BR Squad
      const hasAliveTeammate =
        this.mode === 'br_squad' &&
        victim.reviveCount < 1 &&
        this.actors.some(
          (a) =>
            a.id !== victim.id &&
            a.teamId === victim.teamId &&
            !a.eliminated &&
            a.stance !== 'downed'
        );

      if (hasAliveTeammate && victim.stance !== 'downed') {
        victim.stance = 'downed';
        victim.health = 35;
        victim.downedTimer = 18;
        victim.reviveCount++;
        victim.aiState = 'Incapacitated';
        if (victim.isSquadAlly) {
          this.squadStatusMessage = `${victim.name} is downed and needs assistance!`;
        }
        return;
      }

      this.finalizeElimination(victim, attacker, weaponLabel);
    }
  }

  private finalizeElimination(
    victim: ContestantActor,
    attacker: ContestantActor | null,
    weaponLabel: string
  ) {
    if (victim.eliminated) return;
    victim.eliminated = true;
    victim.aiState = 'Eliminated';
    victim.rig.root.visible = false;

    // Subtle elimination burst effect (triggers once)
    this.spawnImpactBurst(victim.x, victim.y + 1.0, victim.z, '#F43F5E', 0.42);

    if (attacker) {
      attacker.eliminations++;
    }

    const feedEntry = {
      id: `kf_${Date.now()}_${Math.random()}`,
      text: attacker
        ? `${attacker.name} [${weaponLabel}] ${victim.name}`
        : `${victim.name} eliminated (${weaponLabel})`,
      isPlayer: Boolean(attacker?.isPlayer || victim.isPlayer),
    };
    this.killFeed = [feedEntry, ...this.killFeed].slice(0, 4);

    if (victim.isPlayer && this.mode !== 'clash_arena') {
      const aliveOthers = this.actors.filter(
        (a) => !a.eliminated && !a.isPlayer
      );
      if (aliveOthers.length > 0) {
        this.phase = 'spectating';
        this.spectatingIndex = 0;
      } else {
        this.phase = 'defeat';
      }
    }
  }

  // Smarter 4-Role Tactical AI Controller with Vision, Sound Investigation, Cover & Difficulty Scaling
  private updateAIActor(
    bot: ContestantActor,
    dt: number,
    _elapsed: number
  ) {
    if (this.phase === 'prep_buy') {
      bot.animState = 'idle';
      return;
    }

    if (bot.stance === 'downed') {
      bot.downedTimer -= dt;
      if (bot.downedTimer <= 0) {
        this.finalizeElimination(bot, null, 'Eliminated');
      }
      return;
    }

    if (bot.fireCooldownTimer > 0) {
      bot.fireCooldownTimer = Math.max(0, bot.fireCooldownTimer - dt);
    }

    // Handle AI Reloading
    if (bot.reloadTimer > 0) {
      bot.reloadTimer -= dt;
      if (bot.reloadTimer <= 0) {
        bot.reloadTimer = 0;
        bot.clipAmmo = bot.weapon.energyCapacity;
      }
    } else if (bot.clipAmmo <= 0) {
      bot.reloadTimer = bot.weapon.reloadTime;
      bot.rig.reloadAnimTimer = bot.weapon.reloadTime;
    }

    const diff = this.settings.aiDifficulty || 'NORMAL';
    const thinkInterval =
      diff === 'HARD' ? 0.24 : diff === 'EASY' ? 0.45 : 0.34;

    // Periodic AI decision & stuck detection
    bot.aiThinkTimer -= dt;
    if (bot.aiThinkTimer <= 0) {
      bot.aiThinkTimer = thinkInterval + Math.random() * 0.12;

      const movedDist = Math.hypot(
        bot.x - bot.aiLastCheckPos.x,
        bot.z - bot.aiLastCheckPos.z
      );
      bot.aiLastCheckPos = { x: bot.x, z: bot.z };
      if (
        movedDist < 0.22 &&
        bot.aiState !== 'Idle' &&
        bot.aiState !== 'ApproachingEncounter'
      ) {
        bot.aiStuckTimer += thinkInterval;
        if (bot.aiStuckTimer >= 1.1) {
          bot.aiStuckTimer = 0;
          const wps = this.worldData?.waypoints || [{ x: 0, z: 0 }];
          const wp = wps[Math.floor(Math.random() * wps.length)];
          bot.aiTargetPos = {
            x: wp.x + (Math.random() - 0.5) * 14,
            z: wp.z + (Math.random() - 0.5) * 14,
          };
        }
      } else {
        bot.aiStuckTimer = 0;
      }

      // Self-heal if low health
      if (bot.health < 48 && bot.medKits > 0) {
        bot.medKits--;
        bot.health = Math.min(100, bot.health + 50);
      } else if (bot.shield < 25 && bot.shieldCells > 0) {
        bot.shieldCells--;
        bot.shield = Math.min(bot.maxShield, bot.shield + 50);
      }

      this.evaluateAIStateTransitions(bot);
    }

    const player = this.getPlayer();

    // 1. Assisting a downed squadmate (if safe)
    if (bot.aiState === 'AssistingTeammate') {
      const downedAlly = this.actors.find(
        (a) =>
          a.teamId === bot.teamId &&
          !a.eliminated &&
          a.stance === 'downed'
      );
      if (downedAlly) {
        bot.aiTargetPos = { x: downedAlly.x, z: downedAlly.z };
        bot.aiTargetLabel = `Revive ${downedAlly.name}`;
        const d = Math.hypot(downedAlly.x - bot.x, downedAlly.z - bot.z);
        if (d < 2.6) {
          downedAlly.stance = 'standing';
          downedAlly.health = 50;
          downedAlly.downedTimer = 0;
          bot.aiState = bot.isSquadAlly ? 'Following' : 'Exploring';
          return;
        }
        this.moveBotToward(bot, downedAlly.x, downedAlly.z, 6.8, dt);
        return;
      } else {
        bot.aiState = bot.isSquadAlly ? 'Following' : 'Exploring';
      }
    }

    // 2. Retreating / Taking Cover when badly hurt
    if (bot.aiState === 'Retreating') {
      bot.stance = 'crouching';
      this.moveBotToward(bot, bot.aiTargetPos.x, bot.aiTargetPos.z, 6.5, dt);
      return;
    } else {
      bot.stance = 'standing';
    }

    // 3. Look for nearest visible enemy (respecting vision cone & walls)
    const enemy = this.findVisibleEnemyForBot(bot);
    if (enemy) {
      bot.aiLastSeenEnemyPos = {
        x: enemy.x,
        z: enemy.z,
        time: this.matchTimeSec,
      };
      bot.aiTargetLabel = enemy.name;

      const dx = enemy.x - bot.x;
      const dz = enemy.z - bot.z;
      const dist = Math.hypot(dx, dz);
      bot.yaw = Math.atan2(dx, dz);

      // Reaction delay before opening fire so bots feel fair on mobile
      if (bot.aiReactionTimer > 0) {
        bot.aiReactionTimer = Math.max(0, bot.aiReactionTimer - dt);
      }

      if (dist <= bot.weapon.effectiveRange * 0.9) {
        bot.animState = 'aiming';
        if (
          bot.fireCooldownTimer <= 0 &&
          bot.reloadTimer <= 0 &&
          bot.aiReactionTimer <= 0
        ) {
          const dy = enemy.y - bot.y;
          const pitch = Math.atan2(dy, dist);
          this.fireActorWeapon(bot, pitch);
          const diffDelay =
            diff === 'EASY' ? 0.52 : diff === 'HARD' ? 0.16 : 0.32;
          bot.fireCooldownTimer += diffDelay;
        }

        // Role-specific combat positioning
        const preferredDist =
          bot.role === 'Scout'
            ? 34
            : bot.role === 'Support'
            ? 24
            : bot.role === 'Defender'
            ? 16
            : 14;
        if (dist > preferredDist + 4) {
          this.moveBotToward(bot, enemy.x, enemy.z, 5.4, dt);
        } else if (dist < preferredDist - 5 && bot.role === 'Scout') {
          this.moveBotToward(bot, bot.x - dx, bot.z - dz, 4.8, dt);
        }
        return;
      }
    } else {
      // Reset reaction timer when no enemy is in sight
      bot.aiReactionTimer =
        diff === 'EASY' ? 0.45 : diff === 'HARD' ? 0.14 : 0.28;
    }

    if (bot.aiState === 'Idle') {
      bot.animState = 'idle';
      return;
    }

    // 4. Squad Following with Role Spacing & Safe-Zone Protection
    if (bot.aiState === 'Following' && player && !player.eliminated) {
      const playerOutsideZone =
        (this.mode === 'br_solo' || this.mode === 'br_squad') &&
        Math.hypot(
          player.x - this.zoneCenter.x,
          player.z - this.zoneCenter.z
        ) > this.zoneRadius;
      if (playerOutsideZone) {
        // Do not blindly follow leader into unsafe zone
        bot.aiState = 'MovingToSafeZone';
        bot.aiTargetPos = { ...this.zoneCenter };
        return;
      }

      // Role formation offset so squadmates spread out naturally
      const roleAngle =
        bot.role === 'Assault'
          ? 0.6
          : bot.role === 'Support'
          ? -0.6
          : bot.role === 'Scout'
          ? 1.4
          : -1.4;
      const formX = player.x - Math.sin(player.yaw + roleAngle) * 5.5;
      const formZ = player.z - Math.cos(player.yaw + roleAngle) * 5.5;
      bot.aiTargetLabel = `Leader (${bot.role})`;

      const dToForm = Math.hypot(formX - bot.x, formZ - bot.z);
      if (dToForm > 3.2) {
        this.moveBotToward(bot, formX, formZ, 7.2, dt);
      } else {
        bot.animState = 'idle';
      }
      return;
    }

    // 5. Move toward current AI destination
    const dTarget = Math.hypot(
      bot.aiTargetPos.x - bot.x,
      bot.aiTargetPos.z - bot.z
    );
    if (dTarget > 2.2) {
      this.moveBotToward(bot, bot.aiTargetPos.x, bot.aiTargetPos.z, 6.2, dt);
    } else {
      const wps = this.worldData?.waypoints || [{ x: 0, z: 0 }];
      const wp = wps[Math.floor(Math.random() * wps.length)];
      bot.aiTargetPos = {
        x: wp.x + (Math.random() - 0.5) * 18,
        z: wp.z + (Math.random() - 0.5) * 18,
      };
      bot.aiTargetLabel = 'Patrol Waypoint';
      bot.animState = 'idle';
    }
  }

  private evaluateAIStateTransitions(bot: ContestantActor) {
    // 1. Safe-zone priority in Battle Royale
    if (this.mode === 'br_solo' || this.mode === 'br_squad') {
      const distFromZone = Math.hypot(
        bot.x - this.zoneCenter.x,
        bot.z - this.zoneCenter.z
      );
      if (distFromZone > this.zoneRadius * 0.88) {
        bot.aiState = 'MovingToSafeZone';
        bot.aiTargetPos = {
          x: this.zoneCenter.x + (Math.random() - 0.5) * 24,
          z: this.zoneCenter.z + (Math.random() - 0.5) * 24,
        };
        bot.aiTargetLabel = 'Safe Zone';
        return;
      }
    }

    // 2. Retreat to cover when critically low HP
    if (bot.health < 32 && this.settings.aiDifficulty !== 'EASY') {
      bot.aiState = 'Retreating';
      const wps = this.worldData?.waypoints || [{ x: 0, z: 0 }];
      let nearestWp = wps[0];
      let bestD = 999;
      for (const wp of wps) {
        const d = Math.hypot(wp.x - bot.x, wp.z - bot.z);
        if (d > 6 && d < bestD) {
          bestD = d;
          nearestWp = wp;
        }
      }
      bot.aiTargetPos = { x: nearestWp.x, z: nearestWp.z };
      bot.aiTargetLabel = 'Cover Retreat';
      return;
    }

    // 3. Teammate assistance priority (only if safe — no enemy within 14m)
    const downedAlly = this.actors.find(
      (a) =>
        a.teamId === bot.teamId &&
        !a.eliminated &&
        a.stance === 'downed'
    );
    if (downedAlly) {
      const nearbyEnemy = this.actors.some(
        (e) =>
          !e.eliminated &&
          e.teamId !== bot.teamId &&
          Math.hypot(e.x - downedAlly.x, e.z - downedAlly.z) < 14
      );
      if (!nearbyEnemy) {
        bot.aiState = 'AssistingTeammate';
        bot.aiTargetPos = { x: downedAlly.x, z: downedAlly.z };
        return;
      }
    }

    // 4. Search last seen enemy position or nearby combat gunfire sound
    if (
      bot.aiLastSeenEnemyPos &&
      this.matchTimeSec - bot.aiLastSeenEnemyPos.time < 6.0
    ) {
      bot.aiState = 'Investigating';
      bot.aiTargetPos = {
        x: bot.aiLastSeenEnemyPos.x,
        z: bot.aiLastSeenEnemyPos.z,
      };
      bot.aiTargetLabel = 'Last Seen Target';
      return;
    }

    if (
      !bot.isSquadAlly &&
      this.lastCombatSoundPos &&
      this.matchTimeSec - this.lastCombatSoundPos.time < 4.5 &&
      Math.hypot(
        this.lastCombatSoundPos.x - bot.x,
        this.lastCombatSoundPos.z - bot.z
      ) < 65
    ) {
      bot.aiState = 'Investigating';
      bot.aiTargetPos = {
        x: this.lastCombatSoundPos.x,
        z: this.lastCombatSoundPos.z,
      };
      bot.aiTargetLabel = 'Combat Sound';
      return;
    }

    // 5. Respect Squad Command for player's allies
    if (bot.isSquadAlly) {
      if (this.activeSquadCommand === 'hold') {
        bot.aiState = 'Idle';
        bot.aiTargetLabel = 'Holding Position';
        return;
      }
      if (this.activeSquadCommand === 'move_marker' && this.squadMarker) {
        bot.aiState = 'MovingToDestination';
        bot.aiTargetPos = { ...this.squadMarker };
        bot.aiTargetLabel = 'Squad Marker';
        return;
      }
      if (
        this.activeSquadCommand === 'follow' ||
        this.activeSquadCommand === 'regroup'
      ) {
        bot.aiState = 'Following';
        return;
      }
    }

    // 6. Nearby supply pickup
    const nearLoot = this.findNearestLoot(bot.x, bot.z, 12);
    if (nearLoot) {
      bot.aiState = 'CollectingSupplies';
      bot.aiTargetPos = { x: nearLoot.data.x, z: nearLoot.data.z };
      bot.aiTargetLabel = nearLoot.data.name;
      if (Math.hypot(nearLoot.data.x - bot.x, nearLoot.data.z - bot.z) < 2.4) {
        this.applyLootToActor(bot, nearLoot.data);
        nearLoot.data.collected = true;
        nearLoot.mesh.visible = false;
      }
      return;
    }

    bot.aiState = 'Exploring';
  }

  private findVisibleEnemyForBot(bot: ContestantActor): ContestantActor | null {
    const diff = this.settings.aiDifficulty || 'NORMAL';
    let closest: ContestantActor | null = null;
    let closestDist = diff === 'HARD' ? 68 : diff === 'EASY' ? 44 : 56;
    const colliders = this.worldData?.colliders || [];

    const forwardX = Math.sin(bot.yaw);
    const forwardZ = Math.cos(bot.yaw);

    for (const other of this.actors) {
      if (
        other.eliminated ||
        other.teamId === bot.teamId ||
        other.stance === 'parachuting'
      ) {
        continue;
      }
      const dx = other.x - bot.x;
      const dz = other.z - bot.z;
      const d = Math.hypot(dx, dz);
      if (d < closestDist && d > 0.1) {
        // Vision cone check (140 deg forward cone unless target is very close <14m or recently seen)
        const dot = (dx / d) * forwardX + (dz / d) * forwardZ;
        const recentlyAlerted =
          bot.aiLastSeenEnemyPos &&
          this.matchTimeSec - bot.aiLastSeenEnemyPos.time < 4.0;
        if (d > 14 && dot < -0.25 && !recentlyAlerted) {
          continue;
        }

        const los = castSegmentAgainstColliders(
          bot.x,
          bot.y + 1.3,
          bot.z,
          other.x,
          other.y + 1.3,
          other.z,
          colliders
        );
        if (!los.hit) {
          closestDist = d;
          closest = other;
        }
      }
    }
    return closest;
  }

  private moveBotToward(
    bot: ContestantActor,
    tx: number,
    tz: number,
    speed: number,
    dt: number
  ) {
    let dx = tx - bot.x;
    let dz = tz - bot.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) return;

    // Teammate separation steering so bots never stack or block each other
    for (const mate of this.actors) {
      if (
        mate.id !== bot.id &&
        mate.teamId === bot.teamId &&
        !mate.eliminated
      ) {
        const mdx = bot.x - mate.x;
        const mdz = bot.z - mate.z;
        const mDist = Math.hypot(mdx, mdz);
        if (mDist > 0.05 && mDist < 2.2) {
          dx += (mdx / mDist) * 2.5;
          dz += (mdz / mDist) * 2.5;
        }
      }
    }

    // Vehicle avoidance steering so AI bots never get stuck walking into parked or moving vehicles
    for (const veh of this.vehicles) {
      const vdx = bot.x - veh.x;
      const vdz = bot.z - veh.z;
      const vDist = Math.hypot(vdx, vdz);
      if (vDist > 0.05 && vDist < 3.6) {
        dx += (vdx / vDist) * 4.2;
        dz += (vdz / vDist) * 4.2;
      }
    }

    const normLen = Math.hypot(dx, dz) || 1;
    const dirX = dx / normLen;
    const dirZ = dz / normLen;
    bot.yaw = Math.atan2(dirX, dirZ);

    const nextX = bot.x + dirX * speed * dt;
    const nextZ = bot.z + dirZ * speed * dt;
    const resolved = resolveHorizontalCollision(
      nextX,
      bot.y,
      nextZ,
      0.42,
      1.75,
      this.worldData?.colliders || []
    );

    if (resolved.hitWall) {
      const perpX = -dirZ;
      const perpZ = dirX;
      bot.x += perpX * speed * 0.75 * dt;
      bot.z += perpZ * speed * 0.75 * dt;
    } else {
      bot.x = resolved.x;
      bot.z = resolved.z;
    }

    bot.y = getSupportHeightAt(
      bot.x,
      bot.z,
      bot.y,
      this.mode,
      this.worldData?.walkableSurfaces || []
    );
    bot.animState = speed > 6.5 ? 'sprinting' : 'running';
  }

  private updateCameraFollow(dt: number) {
    let targetActor = this.getPlayer();
    if (this.phase === 'spectating') {
      const aliveBots = this.actors.filter((a) => !a.eliminated && !a.isPlayer);
      if (aliveBots.length > 0) {
        targetActor = aliveBots[this.spectatingIndex % aliveBots.length];
      }
    }
    if (!targetActor) return;

    const isAiming =
      targetActor.isPlayer &&
      this.input.aiming &&
      !this.activeDriverVehicleId;
    const camDist = this.activeDriverVehicleId
      ? 7.8
      : isAiming
      ? 2.4
      : 4.8;
    const shoulderOffset = isAiming ? 0.55 : 0.35;
    const pivotHeight =
      targetActor.stance === 'crouching'
        ? 1.25
        : targetActor.stance === 'prone'
        ? 0.65
        : 1.75;

    const pivotX = targetActor.x + Math.cos(this.cameraYaw) * shoulderOffset;
    const pivotY = targetActor.y + pivotHeight;
    const pivotZ = targetActor.z - Math.sin(this.cameraYaw) * shoulderOffset;

    const horizDist = camDist * Math.cos(this.cameraPitch);
    let desiredCamX = pivotX - Math.sin(this.cameraYaw) * horizDist;
    let desiredCamY = pivotY + camDist * Math.sin(this.cameraPitch);
    let desiredCamZ = pivotZ - Math.cos(this.cameraYaw) * horizDist;

    // Prevent camera from clipping through walls or below ground
    const wallCheck = castSegmentAgainstColliders(
      pivotX,
      pivotY,
      pivotZ,
      desiredCamX,
      desiredCamY,
      desiredCamZ,
      this.worldData?.colliders || []
    );
    if (wallCheck.hit) {
      desiredCamX = THREE.MathUtils.lerp(pivotX, wallCheck.hitX, 0.85);
      desiredCamY = THREE.MathUtils.lerp(pivotY, wallCheck.hitY, 0.85);
      desiredCamZ = THREE.MathUtils.lerp(pivotZ, wallCheck.hitZ, 0.85);
    }

    const groundAtCam = groundHeightAt(desiredCamX, desiredCamZ, this.mode);
    desiredCamY = Math.max(groundAtCam + 0.45, desiredCamY);

    if (this.cameraShakeTimer > 0) {
      desiredCamX += (Math.random() - 0.5) * this.cameraShakeIntensity;
      desiredCamY += (Math.random() - 0.5) * this.cameraShakeIntensity;
    }

    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      desiredCamX,
      18,
      dt
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      desiredCamY,
      18,
      dt
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      desiredCamZ,
      18,
      dt
    );

    const lookTargetX = pivotX + Math.sin(this.cameraYaw) * 14;
    const lookTargetY = pivotY - Math.sin(this.cameraPitch) * 10;
    const lookTargetZ = pivotZ + Math.cos(this.cameraYaw) * 14;
    this.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
  }

  private updateTrainingTrials(player: ContestantActor, dt: number) {
    if (!this.trainingState.isRunning) return;
    this.trainingState.currentTimerSec += dt;

    const idx = this.trainingState.activeTrialIndex;
    const trial = this.trainingState.trials[idx];
    if (!trial || trial.completed) return;

    if (idx === 0) {
      // Movement Trial: cross hurdles at x ~ -22, z from -5 to 19
      if (player.x < -17 && player.z > -6) {
        const p = Math.min(4, Math.max(0, Math.floor((player.z + 6) / 7)));
        if (p > trial.progress) {
          this.advanceTrainingTrial(0, p - trial.progress);
        }
      }
    } else if (idx === 1) {
      // Navigation Trial: visit 3 corners
      const navPoints = [
        [-22, 22],
        [0, 22],
        [20, 0],
      ];
      const [nx, nz] = navPoints[trial.progress] || [0, 0];
      if (Math.hypot(player.x - nx, player.z - nz) < 4.5) {
        this.advanceTrainingTrial(1, 1);
      }
    } else if (idx === 2) {
      // Camera Tracking Trial: rotate yaw across sectors
      const yawSector = Math.floor(
        ((this.cameraYaw % (Math.PI * 2)) + Math.PI * 2) / 2.0
      );
      if (yawSector !== trial.progress) {
        this.advanceTrainingTrial(2, 1);
      }
    } else if (idx === 4) {
      // Safe-Zone Survival Trial: reach (0, 22) practice house
      if (Math.hypot(player.x - 0, player.z - 22) < 5.0) {
        this.advanceTrainingTrial(4, 1);
      }
    }
  }

  private advanceTrainingTrial(trialIdx: number, deltaProgress: number) {
    const trial = this.trainingState.trials[trialIdx];
    if (!trial || trial.completed) return;
    trial.progress = Math.min(trial.target, trial.progress + deltaProgress);
    if (trial.progress >= trial.target) {
      trial.completed = true;
      trial.bestTimeSec = Number(this.trainingState.currentTimerSec.toFixed(1));
      soundEngine.playMatchResult(true);
      this.onTrainingComplete();
    }
  }

  private resolveClashArenaTiebreaker() {
    const team1Alive = this.actors.filter(
      (a) => a.teamId === 1 && !a.eliminated
    );
    const team2Alive = this.actors.filter(
      (a) => a.teamId === 2 && !a.eliminated
    );
    const t1HP = team1Alive.reduce((s, a) => s + a.health + a.shield, 0);
    const t2HP = team2Alive.reduce((s, a) => s + a.health + a.shield, 0);

    if (
      team1Alive.length > team2Alive.length ||
      (team1Alive.length === team2Alive.length && t1HP >= t2HP)
    ) {
      this.onClashArenaRoundEnd(1);
    } else {
      this.onClashArenaRoundEnd(2);
    }
  }

  private onClashArenaRoundEnd(winningTeam: number) {
    if (winningTeam === 1) {
      this.arenaPlayerScore++;
      this.arenaCredits += 750;
      this.arenaBannerText = `ROUND ${this.arenaRound} WON!`;
    } else {
      this.arenaRivalScore++;
      this.arenaCredits += 600;
      this.arenaBannerText = `ROUND ${this.arenaRound} LOST`;
    }

    if (this.arenaPlayerScore >= 3) {
      this.phase = 'victory';
      this.recordMatchCompletionOnce(true);
      soundEngine.playMatchResult(true);
    } else if (this.arenaRivalScore >= 3) {
      this.phase = 'defeat';
      this.recordMatchCompletionOnce(false);
      soundEngine.playMatchResult(false);
    } else {
      this.arenaRound++;
      this.startClashArenaRound();
    }
  }

  private evaluateMatchOutcome() {
    if (this.mode === 'training') return;
    if (
      this.phase === 'victory' ||
      this.phase === 'defeat' ||
      this.phase === 'lobby'
    ) {
      return;
    }

    if (this.mode === 'clash_arena' && this.phase === 'active') {
      const t1Alive = this.actors.some((a) => a.teamId === 1 && !a.eliminated);
      const t2Alive = this.actors.some((a) => a.teamId === 2 && !a.eliminated);
      if (!t2Alive) {
        this.onClashArenaRoundEnd(1);
      } else if (!t1Alive) {
        this.onClashArenaRoundEnd(2);
      }
      return;
    }

    // Battle Royale Solo / Squad outcome
    const aliveTeams = new Set(
      this.actors.filter((a) => !a.eliminated).map((a) => a.teamId)
    );
    const playerTeamAlive = aliveTeams.has(1);

    if (playerTeamAlive && aliveTeams.size === 1) {
      this.phase = 'victory';
      this.recordMatchCompletionOnce(true);
      soundEngine.playMatchResult(true);
    } else if (!playerTeamAlive && this.phase !== 'spectating') {
      this.phase = 'defeat';
      this.recordMatchCompletionOnce(false);
      soundEngine.playMatchResult(false);
    } else if (this.phase === 'spectating' && aliveTeams.size <= 1) {
      this.phase = 'defeat';
      this.recordMatchCompletionOnce(false);
    }
  }

  private recordMatchCompletionOnce(victory: boolean) {
    if (this.matchRecorded) return;
    this.matchRecorded = true;

    const player = this.getPlayer();
    const aliveOthers = this.actors.filter(
      (a) => !a.eliminated && a.teamId !== 1
    ).length;
    const placement = victory ? 1 : aliveOthers + 1;
    const elims = player?.eliminations || 0;
    const xpEarned =
      (victory ? 180 : 65) +
      elims * 35 +
      this.suppliesCollectedInMatch * 8;

    const modeLabels: Record<GameMode, string> = {
      br_solo: 'Battle Royale (Solo)',
      br_squad: 'Battle Royale (Squad)',
      clash_arena: 'Clash Arena (Sunset Yard)',
      training: 'Training Grounds',
    };

    const record: MatchHistoryRecord = {
      id: this.matchId,
      mode: this.mode,
      modeLabel: modeLabels[this.mode],
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      durationSec: Math.round(this.matchTimeSec),
      placement,
      totalContestants: this.actors.length,
      eliminations: elims,
      outcome: victory ? 'VICTORY' : 'DEFEAT',
      arenaScore:
        this.mode === 'clash_arena'
          ? `${this.arenaPlayerScore} - ${this.arenaRivalScore}`
          : undefined,
      xpEarned,
    };

    this.onMatchComplete(record, {
      suppliesCollected: this.suppliesCollectedInMatch,
      zonesSurvived: Math.max(0, this.zoneStage - 1),
      landed: this.landedInMatch,
      teamCommandsUsed: this.teamCommandsUsedCount,
      regionsVisited: Array.from(this.regionsVisitedInMatch),
    });
  }

  private emitHUDSnapshot() {
    const player = this.getPlayer();
    const aliveCount = this.actors.filter((a) => !a.eliminated).length;
    const nearLoot = player
      ? this.findNearestLoot(player.x, player.z, 3.6)?.data || null
      : null;
    const nearDowned = player ? this.findNearbyDownedAlly(player) : null;

    let currentRegionName = 'Sunset Island';
    if (this.mode === 'clash_arena') {
      currentRegionName = 'Sunset Yard Arena';
    } else if (this.mode === 'training') {
      currentRegionName = 'Training Grounds';
    } else if (player) {
      for (const reg of SUNSET_ISLAND_REGIONS) {
        if (Math.hypot(player.x - reg.x, player.z - reg.z) <= reg.radius) {
          currentRegionName = reg.name;
          break;
        }
      }
    }

    const squadMembers: SquadMemberHUD[] = this.actors
      .filter((a) => a.teamId === 1)
      .map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        isLeader: a.isPlayer,
        isPlayer: a.isPlayer,
        health: Math.round(a.health),
        maxHealth: a.maxHealth,
        shield: Math.round(a.shield),
        maxShield: a.maxShield,
        stance: a.stance,
        aiStateLabel: a.isPlayer ? 'Leader' : `${a.role} · ${a.aiState}`,
        color: a.isPlayer ? '#FF6B1A' : '#00E5FF',
        x: a.x,
        z: a.z,
        downedTimer: Math.ceil(a.downedTimer),
        eliminated: a.eliminated,
      }));

    const aliveBots = this.actors.filter((a) => !a.eliminated && !a.isPlayer);
    const specTarget =
      aliveBots.length > 0
        ? aliveBots[this.spectatingIndex % aliveBots.length]
        : null;

    const nearestVeh = player
      ? this.findNearestVehicle(player.x, player.z, 4.8)
      : null;
    const nearVehicle = Boolean(nearestVeh && !this.activeDriverVehicleId);
    const activeVehObj = this.activeDriverVehicleId
      ? this.vehicles.find((v) => v.id === this.activeDriverVehicleId) || null
      : null;

    const vehiclesOnMap: VehicleHUDInfo[] = this.vehicles.map((v) => ({
      id: v.id,
      type: v.type,
      name: v.name,
      x: v.x,
      z: v.z,
      health: Math.round(v.health),
      maxHealth: v.maxHealth,
      speedKmh: Math.round(Math.abs(v.speed) * 3.6),
      disabled: v.disabled,
    }));

    const activeVehicle: VehicleHUDInfo | null = activeVehObj
      ? {
          id: activeVehObj.id,
          type: activeVehObj.type,
          name: activeVehObj.name,
          x: activeVehObj.x,
          z: activeVehObj.z,
          health: Math.round(activeVehObj.health),
          maxHealth: activeVehObj.maxHealth,
          speedKmh: Math.round(Math.abs(activeVehObj.speed) * 3.6),
          disabled: activeVehObj.disabled,
        }
      : null;

    const outsideZoneWarning = Boolean(
      player &&
        (this.mode === 'br_solo' || this.mode === 'br_squad') &&
        player.stance !== 'parachuting' &&
        Math.hypot(
          player.x - this.zoneCenter.x,
          player.z - this.zoneCenter.z
        ) > this.zoneRadius
    );

    const aiDebugEntries = this.settings.showAiDebug
      ? this.actors
          .filter((a) => !a.isPlayer && !a.eliminated)
          .slice(0, 8)
          .map((a) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            state: a.aiState,
            hp: Math.round(a.health + a.shield),
            dist: Math.round(
              Math.hypot(
                a.x - (player?.x ?? 0),
                a.z - (player?.z ?? 0)
              )
            ),
            targetLabel: a.aiTargetLabel,
          }))
      : [];

    const snapshot: interfaceHUDStateSnapshot = {
      phase: this.phase,
      mode: this.mode,
      matchTimeSec: Math.floor(this.matchTimeSec),
      aliveCount,
      totalContestants: this.actors.length || 20,
      eliminations: player?.eliminations || 0,
      suppliesCollectedCount: this.suppliesCollectedInMatch,
      health: Math.round(player?.health ?? 100),
      maxHealth: player?.maxHealth ?? 100,
      shield: Math.round(player?.shield ?? 0),
      maxShield: player?.maxShield ?? 100,
      armorLevel: player?.armorLevel ?? 1,
      stance: player?.stance ?? 'standing',
      isAiming: this.input.aiming,
      isSprinting: this.input.sprint,
      isReloading: (player?.reloadTimer ?? 0) > 0,
      reloadProgress:
        player && player.reloadTimer > 0
          ? 1 - player.reloadTimer / player.weapon.reloadTime
          : 0,
      inVehicle: Boolean(this.activeDriverVehicleId),
      nearVehicle,
      activeVehicle,
      nearbyVehicleName: nearestVeh?.name || null,
      hitMarkerActive: this.hitMarkerTimer > 0,
      hitMarkerIsElim: this.hitMarkerIsElim,
      takingDamageFlash: this.takingDamageFlashTimer > 0,
      damagePopups: this.damagePopups,
      weapons: [player?.weapon || null, player?.secondaryWeapon || null],
      activeWeaponSlot: 0,
      currentClip: [
        player?.clipAmmo ?? 0,
        player?.secondaryClipAmmo ?? 0,
      ],
      reserveAmmo: player?.reserveAmmo ?? 0,
      medKits: player?.medKits ?? 0,
      shieldCells: player?.shieldCells ?? 0,
      coverGadgets: player?.coverGadgets ?? 0,
      coverPlacementPreview: this.input.coverPreview,
      coverPlacementValid: true,
      nearbyLoot: nearLoot,
      nearbyDownedAllyName: nearDowned?.name || null,
      reviveProgress: nearDowned ? Math.min(1, this.reviveHoldTimer / 2.5) : 0,
      zoneStage: this.zoneStage,
      zoneStatusText: this.zoneShrinking
        ? `ZONE SHRINKING (${Math.ceil(this.zoneTimerSec)}s)`
        : `NEXT ZONE IN ${Math.ceil(this.zoneTimerSec)}s`,
      zoneTimerSec: Math.ceil(this.zoneTimerSec),
      zoneCenter: { ...this.zoneCenter },
      zoneRadius: this.zoneRadius,
      nextZoneCenter: { ...this.nextZoneCenter },
      nextZoneRadius: this.nextZoneRadius,
      outsideZoneWarning,
      playerPos: {
        x: player?.x ?? 0,
        y: player?.y ?? 0,
        z: player?.z ?? 0,
        yaw: this.cameraYaw,
      },
      currentRegionName,
      minimapActors: this.actors
        .filter((a) => !a.eliminated && !a.isPlayer)
        .map((a) => ({
          id: a.id,
          x: a.x,
          z: a.z,
          isAlly: a.teamId === 1,
          isDowned: a.stance === 'downed',
        })),
      vehiclesOnMap,
      vehiclePos:
        this.vehicles.length > 0
          ? { x: this.vehicles[0].x, z: this.vehicles[0].z }
          : null,
      squadMarker: this.squadMarker ? { ...this.squadMarker } : null,
      squadMembers,
      activeSquadCommand: this.activeSquadCommand,
      squadStatusMessage: this.squadStatusMessage,
      arenaRound: this.arenaRound,
      arenaPlayerScore: this.arenaPlayerScore,
      arenaRivalScore: this.arenaRivalScore,
      arenaCredits: this.arenaCredits,
      arenaPrepTimerSec: Math.ceil(this.arenaPrepTimerSec),
      arenaRoundTimerSec: Math.ceil(this.arenaRoundTimerSec),
      arenaBannerText: this.arenaBannerText,
      spectatingTargetName: specTarget?.name || 'None',
      spectatingTargetHealth: Math.round(specTarget?.health ?? 0),
      spectatingIndex: this.spectatingIndex,
      training: {
        ...this.trainingState,
        currentTimerSec: Number(this.trainingState.currentTimerSec.toFixed(1)),
      },
      aiDebugEntries,
      fps: Math.round(this.fpsSmooth),
      killFeed: this.killFeed,
    };

    this.onHUDUpdate(snapshot);
  }

  private handleResize = () => {
    if (!this.container || this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.cleanupMatchEntities();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
