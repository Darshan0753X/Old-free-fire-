import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AIState,
  CharacterAnimState,
  CharacterStance,
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
  TrainingTrialState,
  WorldCollectible,
  interfaceHUDStateSnapshot,
} from '../types/game';
import {
  ArticulatedCharacterRig,
  createArticulatedCharacter,
  createCoverBarrierMesh,
  createIslandRoverMesh,
  createSupplyCrateMesh,
  updateCharacterAnimation,
} from './CharacterRig';
import {
  BuiltWorldData,
  ColliderBox,
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
  aiAggression: number;
  aiAccuracy: number;
  eliminations: number;
}

interface ActiveProjectile {
  mesh: THREE.Mesh;
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

  // Vehicle (Island Rover)
  private vehicleMesh: { root: THREE.Group; wheels: THREE.Mesh[] } | null = null;
  private vehicleState = {
    exists: false,
    x: 18,
    y: 0.6,
    z: 14,
    yaw: 0,
    speed: 0,
    driverId: null as string | null,
  };

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

    const maxRatio =
      settings.graphicsPreset === 'LOW'
        ? 1.0
        : settings.graphicsPreset === 'MEDIUM'
        ? 1.5
        : 2.0;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxRatio)
    );

    const enableShadows =
      !this.isSoftwareGl &&
      settings.shadowsEnabled &&
      settings.graphicsPreset !== 'LOW';
    this.renderer.shadowMap.enabled = enableShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.dirLight.castShadow = enableShadows;
    const shadowRes = settings.graphicsPreset === 'HIGH' ? 1024 : 512;
    this.dirLight.shadow.mapSize.set(shadowRes, shadowRes);
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
      // Spawn Drivable Island Rover Vehicle near Central Estate road
      this.vehicleMesh = createIslandRoverMesh();
      this.vehicleState = {
        exists: true,
        x: 16,
        y: groundHeightAt(16, 12, mode),
        z: 12,
        yaw: 0.4,
        speed: 0,
        driverId: null,
      };
      this.vehicleMesh.root.position.set(
        this.vehicleState.x,
        this.vehicleState.y,
        this.vehicleState.z
      );
      this.vehicleMesh.root.rotation.y = this.vehicleState.yaw;
      this.actorsGroup.add(this.vehicleMesh.root);

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
      aiAggression: 0.5,
      aiAccuracy: 0.5,
      eliminations: 0,
    };
    this.actors.push(playerActor);

    const equipList = Object.values(EQUIPMENT_CATALOG);
    for (let i = 0; i < 19; i++) {
      const isAlly = isSquad && i < 3;
      const teamId = isAlly ? 1 : Math.floor(i / (isSquad ? 4 : 1)) + 2;
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
        ? -85 + (i + 1) * 6
        : reg.x + (Math.random() - 0.5) * 32;
      const spawnZ = isAlly
        ? -65 + (i + 1) * 6
        : reg.z + (Math.random() - 0.5) * 32;
      const spawnY = groundHeightAt(spawnX, spawnZ, this.mode);

      const botWeapon = equipList[i % equipList.length];
      const bot: ContestantActor = {
        id: `bot_${i}`,
        name: isAlly ? `ALLY_${BOT_NAMES[i]}` : BOT_NAMES[i],
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
        medKits: 1,
        shieldCells: 1,
        coverGadgets: 1,
        aiState: isAlly ? 'Following' : 'Exploring',
        aiTargetPos: { x: reg.x, z: reg.z },
        aiThinkTimer: (i % 5) * 0.15,
        aiStuckTimer: 0,
        aiLastCheckPos: { x: spawnX, z: spawnZ },
        aiAggression: 0.4 + (i % 5) * 0.12,
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
    const sens = this.settings.cameraSensitivity;
    this.cameraYaw -= deltaYaw * sens;
    const pitchDir = this.settings.invertY ? -1 : 1;
    this.cameraPitch = THREE.MathUtils.clamp(
      this.cameraPitch + deltaPitch * sens * pitchDir,
      -0.65,
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
      soundEngine.playClick();
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
      soundEngine.playClick();
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
    if (!player || player.eliminated || !this.vehicleState.exists) return;

    if (this.vehicleState.driverId === 'player') {
      // Exit vehicle safely to the left
      this.vehicleState.driverId = null;
      this.vehicleState.speed = 0;
      player.stance = 'standing';
      player.x = this.vehicleState.x + Math.cos(this.vehicleState.yaw) * 2.4;
      player.z = this.vehicleState.z - Math.sin(this.vehicleState.yaw) * 2.4;
      player.y = groundHeightAt(player.x, player.z, this.mode);
      player.rig.root.visible = true;
      soundEngine.playClick();
    } else {
      const dist = Math.hypot(
        player.x - this.vehicleState.x,
        player.z - this.vehicleState.z
      );
      if (dist <= 4.5) {
        this.vehicleState.driverId = 'player';
        player.stance = 'driving';
        player.rig.root.visible = false;
        soundEngine.playClick();
      }
    }
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
    this.vehicleMesh = null;
    this.vehicleState.exists = false;
    this.vehicleState.driverId = null;
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

    // 4. Update Temporary Cover Barriers expiration
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

    // 5. Update Player & Vehicle Controls
    const player = this.getPlayer();
    if (player && !player.eliminated && this.phase === 'active') {
      if (this.vehicleState.driverId === 'player') {
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

    // 7. Update Character Visual Rigs
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
    }

    // 8. Update Projectiles & Hit Detection
    this.updateProjectiles(dt);

    // 9. Update Training Grounds Trials
    if (this.mode === 'training' && player) {
      this.updateTrainingTrials(player, dt);
    }

    // 10. Update Camera (Third-Person Follow or Spectator)
    this.updateCameraFollow(dt);

    // 11. Check Match / Round Win Conditions
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
    if (!this.vehicleMesh) return;
    const accelInput = this.input.moveZ;
    const steerInput = -this.input.moveX;

    const targetSpeed = accelInput * 22;
    this.vehicleState.speed = THREE.MathUtils.damp(
      this.vehicleState.speed,
      targetSpeed,
      4.5,
      dt
    );

    if (Math.abs(this.vehicleState.speed) > 0.4) {
      const turnDir = this.vehicleState.speed >= 0 ? 1 : -1;
      this.vehicleState.yaw += steerInput * 1.95 * turnDir * dt;
    }

    const nextX =
      this.vehicleState.x +
      Math.sin(this.vehicleState.yaw) * this.vehicleState.speed * dt;
    const nextZ =
      this.vehicleState.z +
      Math.cos(this.vehicleState.yaw) * this.vehicleState.speed * dt;
    const nextY = groundHeightAt(nextX, nextZ, this.mode);

    const col = resolveHorizontalCollision(
      nextX,
      nextY,
      nextZ,
      1.6,
      2.0,
      this.worldData?.colliders || []
    );
    if (col.hitWall) {
      this.vehicleState.speed *= 0.35;
    }

    this.vehicleState.x = THREE.MathUtils.clamp(col.x, -180, 180);
    this.vehicleState.z = THREE.MathUtils.clamp(col.z, -180, 180);
    this.vehicleState.y = groundHeightAt(
      this.vehicleState.x,
      this.vehicleState.z,
      this.mode
    );

    this.vehicleMesh.root.position.set(
      this.vehicleState.x,
      this.vehicleState.y,
      this.vehicleState.z
    );
    this.vehicleMesh.root.rotation.y = this.vehicleState.yaw;

    for (const w of this.vehicleMesh.wheels) {
      w.rotation.x += this.vehicleState.speed * dt * 1.8;
    }

    player.x = this.vehicleState.x;
    player.y = this.vehicleState.y;
    player.z = this.vehicleState.z;
    player.yaw = this.vehicleState.yaw;
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
        soundEngine.playFootstep(true);
      }
      return;
    }

    // Ground / Rooftop Movement
    const sens = this.settings.movementSensitivity;
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
      player.vy -= 22 * dt;
      player.y += player.vy * dt;
      if (player.y <= supportY) {
        player.y = supportY;
        player.vy = 0;
      }
    } else {
      player.y = THREE.MathUtils.damp(player.y, supportY, 18, dt);
      player.vy = 0;
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

    // Weapon Cooldown & Reloading
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
    } else if (this.input.firing && player.fireCooldownTimer <= 0) {
      if (player.clipAmmo > 0) {
        this.fireActorWeapon(player, this.cameraPitch);
      } else if (player.reserveAmmo > 0) {
        this.triggerReload();
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
    actor.clipAmmo = Math.max(0, actor.clipAmmo - 1);
    actor.fireCooldownTimer = actor.weapon.fireCooldown;
    if (actor.isPlayer) {
      soundEngine.playWeaponFire(actor.weapon.id);
    }

    const muzzleY = actor.y + (actor.stance === 'crouching' ? 1.0 : 1.38);
    const forwardX = Math.sin(actor.yaw) * Math.cos(aimPitch);
    const forwardY = Math.sin(aimPitch);
    const forwardZ = Math.cos(actor.yaw) * Math.cos(aimPitch);

    const pellets = actor.weapon.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const spreadX = (Math.random() - 0.5) * actor.weapon.spread * 2;
      const spreadY = (Math.random() - 0.5) * actor.weapon.spread * 1.5;
      const spreadZ = (Math.random() - 0.5) * actor.weapon.spread * 2;

      const dir = new THREE.Vector3(
        forwardX + spreadX,
        forwardY + spreadY,
        forwardZ + spreadZ
      ).normalize();

      const boltGeo = new THREE.SphereGeometry(0.11, 6, 6);
      const boltMat = new THREE.MeshBasicMaterial({
        color: actor.weapon.projectileColor,
      });
      const boltMesh = new THREE.Mesh(boltGeo, boltMat);
      boltMesh.position.set(
        actor.x + dir.x * 0.8,
        muzzleY + dir.y * 0.8,
        actor.z + dir.z * 0.8
      );
      this.projectilesGroup.add(boltMesh);

      this.projectiles.push({
        mesh: boltMesh,
        ownerId: actor.id,
        teamId: actor.teamId,
        x: boltMesh.position.x,
        y: boltMesh.position.y,
        z: boltMesh.position.z,
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
        this.removeProjectileAt(i);
        continue;
      }

      // 2. Check Training Targets in Training Grounds
      if (this.mode === 'training' && this.worldData) {
        let hitTarget = false;
        for (const t of this.worldData.trainingTargets) {
          if (t.hit) continue;
          const d = Math.hypot(nextX - t.x, nextY - t.y, nextZ - t.z);
          if (d < 0.95) {
            t.hit = true;
            t.mesh.visible = false;
            hitTarget = true;
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

      // 3. Check Actor Hit Detection
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
        const horizDist = Math.hypot(nextX - actor.x, nextZ - actor.z);
        const vertDist = Math.abs(nextY - actorCenterY);

        if (horizDist < 0.58 && vertDist < 0.95) {
          const attacker =
            this.actors.find((a) => a.id === p.ownerId) || null;
          this.applyDamage(actor, p.damage, attacker, attacker?.weapon.shortName || 'Pulse');
          hitActor = true;
          break;
        }
      }

      if (hitActor) {
        this.removeProjectileAt(i);
        continue;
      }

      p.x = nextX;
      p.y = nextY;
      p.z = nextZ;
      p.mesh.position.set(p.x, p.y, p.z);
      p.remainingRange -= stepDist;

      if (p.remainingRange <= 0 || p.y < -2) {
        this.removeProjectileAt(i);
      }
    }
  }

  private removeProjectileAt(index: number) {
    const p = this.projectiles[index];
    this.projectilesGroup.remove(p.mesh);
    p.mesh.geometry.dispose();
    (p.mesh.material as THREE.Material).dispose();
    this.projectiles.splice(index, 1);
  }

  private applyDamage(
    victim: ContestantActor,
    amount: number,
    attacker: ContestantActor | null,
    weaponLabel: string
  ) {
    if (victim.eliminated) return;

    victim.rig.hitFlashTimer = 0.15;
    let remaining = amount;

    if (victim.shield > 0) {
      const absorbed = Math.min(victim.shield, remaining * 0.75);
      victim.shield = Math.max(0, victim.shield - absorbed);
      remaining -= absorbed;
    }

    victim.health = Math.max(0, victim.health - remaining);

    if (attacker?.isPlayer) {
      soundEngine.playHitMarker(victim.health <= 0);
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
      // Player eliminated in Battle Royale -> allow spectator or results
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

  // 12-State AI Controller with Stuck Detection & Recovery
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

    // Periodic AI decision & stuck detection every ~0.35s
    bot.aiThinkTimer -= dt;
    if (bot.aiThinkTimer <= 0) {
      bot.aiThinkTimer = 0.32 + Math.random() * 0.15;

      // Stuck detection
      const movedDist = Math.hypot(
        bot.x - bot.aiLastCheckPos.x,
        bot.z - bot.aiLastCheckPos.z
      );
      bot.aiLastCheckPos = { x: bot.x, z: bot.z };
      if (
        movedDist < 0.25 &&
        bot.aiState !== 'Idle' &&
        bot.aiState !== 'ApproachingEncounter'
      ) {
        bot.aiStuckTimer += 0.35;
        if (bot.aiStuckTimer >= 1.2) {
          bot.aiStuckTimer = 0;
          // Pick alternate waypoint to unstick
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
      if (bot.health < 45 && bot.medKits > 0) {
        bot.medKits--;
        bot.health = Math.min(100, bot.health + 50);
      }

      this.evaluateAIStateTransitions(bot);
    }

    // Execute state movement & combat
    const player = this.getPlayer();

    // Check if assisting a downed squadmate
    if (bot.aiState === 'AssistingTeammate') {
      const downedAlly = this.actors.find(
        (a) =>
          a.teamId === bot.teamId &&
          !a.eliminated &&
          a.stance === 'downed'
      );
      if (downedAlly) {
        bot.aiTargetPos = { x: downedAlly.x, z: downedAlly.z };
        const d = Math.hypot(downedAlly.x - bot.x, downedAlly.z - bot.z);
        if (d < 2.6) {
          downedAlly.stance = 'standing';
          downedAlly.health = 50;
          downedAlly.downedTimer = 0;
          bot.aiState = 'Following';
          return;
        }
      } else {
        bot.aiState = bot.isSquadAlly ? 'Following' : 'Exploring';
      }
    }

    // Look for nearest visible enemy
    const enemy = this.findVisibleEnemyForBot(bot);
    if (enemy) {
      const dx = enemy.x - bot.x;
      const dz = enemy.z - bot.z;
      const dist = Math.hypot(dx, dz);
      bot.yaw = Math.atan2(dx, dz);

      if (dist <= bot.weapon.effectiveRange * 0.85) {
        bot.animState = 'aiming';
        if (bot.fireCooldownTimer <= 0) {
          const dy = enemy.y - bot.y;
          const pitch = Math.atan2(dy, dist);
          this.fireActorWeapon(bot, pitch);
          // Add slight bot fire interval so combat feels fair on mobile
          bot.fireCooldownTimer += 0.35 - bot.aiAccuracy * 0.18;
        }
        // Strafe or close distance if far
        if (dist > 22) {
          this.moveBotToward(bot, enemy.x, enemy.z, 5.2, dt);
        }
        return;
      }
    }

    if (bot.aiState === 'Idle') {
      bot.animState = 'idle';
      return;
    }

    if (bot.aiState === 'Following' && player && !player.eliminated) {
      const dToPlayer = Math.hypot(player.x - bot.x, player.z - bot.z);
      if (dToPlayer > 7.5) {
        this.moveBotToward(bot, player.x, player.z, 7.2, dt);
      } else {
        bot.animState = 'idle';
      }
      return;
    }

    // Move toward current AI destination
    const dTarget = Math.hypot(
      bot.aiTargetPos.x - bot.x,
      bot.aiTargetPos.z - bot.z
    );
    if (dTarget > 2.2) {
      this.moveBotToward(bot, bot.aiTargetPos.x, bot.aiTargetPos.z, 6.2, dt);
    } else {
      // Pick next waypoint
      const wps = this.worldData?.waypoints || [{ x: 0, z: 0 }];
      const wp = wps[Math.floor(Math.random() * wps.length)];
      bot.aiTargetPos = {
        x: wp.x + (Math.random() - 0.5) * 18,
        z: wp.z + (Math.random() - 0.5) * 18,
      };
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
        return;
      }
    }

    // 2. Teammate assistance priority
    const downedAlly = this.actors.find(
      (a) =>
        a.teamId === bot.teamId &&
        !a.eliminated &&
        a.stance === 'downed'
    );
    if (downedAlly) {
      bot.aiState = 'AssistingTeammate';
      bot.aiTargetPos = { x: downedAlly.x, z: downedAlly.z };
      return;
    }

    // 3. Respect Squad Command for player's allies
    if (bot.isSquadAlly) {
      if (this.activeSquadCommand === 'hold') {
        bot.aiState = 'Idle';
        return;
      }
      if (this.activeSquadCommand === 'move_marker' && this.squadMarker) {
        bot.aiState = 'MovingToDestination';
        bot.aiTargetPos = { ...this.squadMarker };
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

    // 4. Nearby supply pickup
    const nearLoot = this.findNearestLoot(bot.x, bot.z, 12);
    if (nearLoot) {
      bot.aiState = 'CollectingSupplies';
      bot.aiTargetPos = { x: nearLoot.data.x, z: nearLoot.data.z };
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
    let closest: ContestantActor | null = null;
    let closestDist = 58;
    const colliders = this.worldData?.colliders || [];

    for (const other of this.actors) {
      if (
        other.eliminated ||
        other.teamId === bot.teamId ||
        other.stance === 'parachuting'
      ) {
        continue;
      }
      const d = Math.hypot(other.x - bot.x, other.z - bot.z);
      if (d < closestDist) {
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
    const dx = tx - bot.x;
    const dz = tz - bot.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) return;

    const dirX = dx / dist;
    const dirZ = dz / dist;
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
      // Slide / steer around obstacle
      const perpX = -dirZ;
      const perpZ = dirX;
      bot.x += perpX * speed * 0.7 * dt;
      bot.z += perpZ * speed * 0.7 * dt;
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
      targetActor.isPlayer && this.input.aiming && !this.vehicleState.driverId;
    const camDist =
      this.vehicleState.driverId === 'player'
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
        isLeader: a.isPlayer,
        isPlayer: a.isPlayer,
        health: Math.round(a.health),
        maxHealth: a.maxHealth,
        shield: Math.round(a.shield),
        maxShield: a.maxShield,
        stance: a.stance,
        aiStateLabel: a.isPlayer ? 'Leader' : a.aiState,
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

    const nearVehicle =
      Boolean(
        player &&
          this.vehicleState.exists &&
          Math.hypot(
            player.x - this.vehicleState.x,
            player.z - this.vehicleState.z
          ) <= 4.5
      );

    const outsideZoneWarning = Boolean(
      player &&
        (this.mode === 'br_solo' || this.mode === 'br_squad') &&
        player.stance !== 'parachuting' &&
        Math.hypot(
          player.x - this.zoneCenter.x,
          player.z - this.zoneCenter.z
        ) > this.zoneRadius
    );

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
      inVehicle: this.vehicleState.driverId === 'player',
      nearVehicle,
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
      vehiclePos: this.vehicleState.exists
        ? { x: this.vehicleState.x, z: this.vehicleState.z }
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
