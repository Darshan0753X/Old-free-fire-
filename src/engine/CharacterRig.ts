import * as THREE from 'three';
import {
  CharacterAnimState,
  CharacterStance,
  OUTFIT_CATALOG,
  OutfitConfig,
  RARITY_COLORS,
  RarityTier,
} from '../types/game';

export interface ArticulatedCharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  torsoMesh: THREE.Mesh;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  weaponMesh: THREE.Group;
  muzzleNode: THREE.Object3D;
  gliderGroup: THREE.Group;
  downedRing: THREE.Mesh;
  hitFlashTimer: number;
  recoilTimer: number;
  reloadAnimTimer: number;
}

export function createArticulatedCharacter(
  outfitId: string,
  backpackStyle: 'standard' | 'tactical' | 'jetpack' = 'standard',
  teamTint?: string
): ArticulatedCharacterRig {
  const outfit: OutfitConfig =
    OUTFIT_CATALOG.find((o) => o.id === outfitId) || OUTFIT_CATALOG[0];

  const primaryHex = teamTint || outfit.primaryColor;
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const skinMat = new THREE.MeshStandardMaterial({
    color: '#F3C6A5',
    roughness: 0.65,
    metalness: 0.05,
  });
  const primaryMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    roughness: 0.5,
    metalness: 0.15,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: outfit.secondaryColor,
    roughness: 0.75,
    metalness: 0.1,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: outfit.accentColor,
    roughness: 0.3,
    metalness: 0.4,
    emissive: outfit.accentColor,
    emissiveIntensity: 0.15,
  });
  const backpackMat = new THREE.MeshStandardMaterial({
    color: outfit.backpackColor,
    roughness: 0.6,
    metalness: 0.2,
  });

  // 1. Torso + Vest Trim
  const torsoGeo = new THREE.BoxGeometry(0.56, 0.68, 0.32);
  const torsoMesh = new THREE.Mesh(torsoGeo, primaryMat);
  torsoMesh.position.set(0, 1.08, 0);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyGroup.add(torsoMesh);

  const chestStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.14, 0.34),
    accentMat
  );
  chestStripe.position.set(0, 0.12, 0);
  torsoMesh.add(chestStripe);

  const beltMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.1, 0.34),
    secondaryMat
  );
  beltMesh.position.set(0, -0.3, 0);
  torsoMesh.add(beltMesh);

  // 2. Backpack
  const backpackGroup = new THREE.Group();
  backpackGroup.position.set(0, 0.05, -0.22);
  if (backpackStyle === 'jetpack') {
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.42, 0.16),
      backpackMat
    );
    const leftThruster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.44, 8),
      accentMat
    );
    leftThruster.position.set(-0.14, 0, -0.04);
    const rightThruster = leftThruster.clone();
    rightThruster.position.set(0.14, 0, -0.04);
    backpackGroup.add(core, leftThruster, rightThruster);
  } else if (backpackStyle === 'tactical') {
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.48, 0.2),
      backpackMat
    );
    const pouch = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.18, 0.08),
      accentMat
    );
    pouch.position.set(0, -0.08, -0.12);
    backpackGroup.add(pack, pouch);
  } else {
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.42, 0.16),
      backpackMat
    );
    backpackGroup.add(pack);
  }
  torsoMesh.add(backpackGroup);

  // 3. Head + Visor/Hat
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.62, 0);
  bodyGroup.add(headGroup);

  const headMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.38, 0.38),
    skinMat
  );
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Visor / Eyes facing +Z
  const visorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.1, 0.06),
    accentMat
  );
  visorMesh.position.set(0, 0.03, 0.18);
  headGroup.add(visorMesh);

  if (outfit.hatStyle === 'helmet') {
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.24, 0.42),
      primaryMat
    );
    helmet.position.set(0, 0.12, 0);
    headGroup.add(helmet);
  } else if (outfit.hatStyle === 'cap') {
    const capTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.14, 0.4),
      primaryMat
    );
    capTop.position.set(0, 0.16, 0);
    const brim = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.04, 0.18),
      secondaryMat
    );
    brim.position.set(0, 0.11, 0.24);
    headGroup.add(capTop, brim);
  } else {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.41, 0.09, 0.41),
      primaryMat
    );
    band.position.set(0, 0.12, 0);
    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.39, 0.1, 0.39),
      secondaryMat
    );
    hair.position.set(0, 0.2, 0);
    headGroup.add(band, hair);
  }

  // 4. Left & Right Arms + Weapon Mount
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(0.37, 1.34, 0);
  bodyGroup.add(leftArmPivot);

  const leftArmMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.56, 0.18),
    primaryMat
  );
  leftArmMesh.position.set(0, -0.24, 0);
  leftArmMesh.castShadow = true;
  leftArmPivot.add(leftArmMesh);

  const leftHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.14, 0.15),
    skinMat
  );
  leftHand.position.set(0, -0.54, 0);
  leftArmPivot.add(leftHand);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(-0.37, 1.34, 0);
  bodyGroup.add(rightArmPivot);

  const rightArmMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.56, 0.18),
    primaryMat
  );
  rightArmMesh.position.set(0, -0.24, 0);
  rightArmMesh.castShadow = true;
  rightArmPivot.add(rightArmMesh);

  const rightHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.14, 0.15),
    skinMat
  );
  rightHand.position.set(0, -0.54, 0);
  rightArmPivot.add(rightHand);

  // Held 3D Energy Crossbow / Tactical Projector (Local +Z is forward firing axis)
  const weaponMesh = new THREE.Group();
  weaponMesh.position.set(0, -0.54, 0.06);
  weaponMesh.rotation.x = Math.PI / 2;

  // Crossbow main body rail along local +Z
  const gunBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.13, 0.56),
    secondaryMat
  );
  gunBody.position.set(0, 0, 0.18);

  // Glowing top energy track
  const gunBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.44, 8),
    accentMat
  );
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.set(0, 0.055, 0.24);

  // Crossbow horizontal bow limbs (prod) at front
  const bowLimbLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.035, 0.055),
    primaryMat
  );
  bowLimbLeft.position.set(0.14, 0.04, 0.36);
  bowLimbLeft.rotation.y = 0.24;

  const bowLimbRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.035, 0.055),
    primaryMat
  );
  bowLimbRight.position.set(-0.14, 0.04, 0.36);
  bowLimbRight.rotation.y = -0.24;

  // Glowing energy bowstring
  const bowStringLeft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6),
    accentMat
  );
  bowStringLeft.rotation.z = Math.PI / 2;
  bowStringLeft.rotation.y = -0.55;
  bowStringLeft.position.set(0.12, 0.045, 0.24);

  const bowStringRight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6),
    accentMat
  );
  bowStringRight.rotation.z = Math.PI / 2;
  bowStringRight.rotation.y = 0.55;
  bowStringRight.position.set(-0.12, 0.045, 0.24);

  // Top optical sight
  const sightMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.065, 0.12),
    primaryMat
  );
  sightMesh.position.set(0, 0.1, 0.1);

  // Exact world-space firing origin at the front tip of the crossbow (+Z)
  const muzzleNode = new THREE.Object3D();
  muzzleNode.position.set(0, 0.055, 0.5);

  weaponMesh.add(
    gunBody,
    gunBarrel,
    bowLimbLeft,
    bowLimbRight,
    bowStringLeft,
    bowStringRight,
    sightMesh,
    muzzleNode
  );
  rightArmPivot.add(weaponMesh);

  // 5. Left & Right Legs + Shoes
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(0.16, 0.74, 0);
  bodyGroup.add(leftLegPivot);

  const leftLegMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.62, 0.21),
    secondaryMat
  );
  leftLegMesh.position.set(0, -0.31, 0);
  leftLegMesh.castShadow = true;
  leftLegPivot.add(leftLegMesh);

  const leftShoe = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.14, 0.3),
    primaryMat
  );
  leftShoe.position.set(0, -0.67, 0.04);
  leftLegPivot.add(leftShoe);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(-0.16, 0.74, 0);
  bodyGroup.add(rightLegPivot);

  const rightLegMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.62, 0.21),
    secondaryMat
  );
  rightLegMesh.position.set(0, -0.31, 0);
  rightLegMesh.castShadow = true;
  rightLegPivot.add(rightLegMesh);

  const rightShoe = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.14, 0.3),
    primaryMat
  );
  rightShoe.position.set(0, -0.67, 0.04);
  rightLegPivot.add(rightShoe);

  // 6. Glider / Parachute Wing (shown during deployment descent)
  const gliderGroup = new THREE.Group();
  gliderGroup.position.set(0, 2.75, 0);
  gliderGroup.visible = false;
  const canopyCenter = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.12, 1.1),
    primaryMat
  );
  const canopyLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.1, 0.95),
    accentMat
  );
  canopyLeft.position.set(-1.6, -0.12, -0.05);
  canopyLeft.rotation.z = 0.22;
  const canopyRight = canopyLeft.clone();
  canopyRight.position.set(1.6, -0.12, -0.05);
  canopyRight.rotation.z = -0.22;
  const cordLeft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6),
    secondaryMat
  );
  cordLeft.position.set(-0.5, -0.7, 0);
  const cordRight = cordLeft.clone();
  cordRight.position.set(0.5, -0.7, 0);
  gliderGroup.add(canopyCenter, canopyLeft, canopyRight, cordLeft, cordRight);
  root.add(gliderGroup);

  // 7. Downed Indicator Ring
  const downedRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 24),
    new THREE.MeshBasicMaterial({
      color: '#EF4444',
      side: THREE.DoubleSide,
    })
  );
  downedRing.rotation.x = -Math.PI / 2;
  downedRing.position.set(0, 0.05, 0);
  downedRing.visible = false;
  root.add(downedRing);

  return {
    root,
    bodyGroup,
    headGroup,
    torsoMesh,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    weaponMesh,
    muzzleNode,
    gliderGroup,
    downedRing,
    hitFlashTimer: 0,
    recoilTimer: 0,
    reloadAnimTimer: 0,
  };
}

export function updateCharacterAnimation(
  rig: ArticulatedCharacterRig,
  animState: CharacterAnimState,
  stance: CharacterStance,
  elapsedTime: number,
  dt: number
) {
  rig.gliderGroup.visible = stance === 'parachuting';
  rig.downedRing.visible = stance === 'downed';

  const torsoMat = rig.torsoMesh.material as THREE.MeshStandardMaterial;
  if (rig.hitFlashTimer > 0) {
    rig.hitFlashTimer = Math.max(0, rig.hitFlashTimer - dt);
    if (torsoMat && torsoMat.emissive) {
      torsoMat.emissive.setHex(0xff3b30);
      torsoMat.emissiveIntensity = 0.65;
    }
  } else if (torsoMat && torsoMat.emissive && torsoMat.emissiveIntensity > 0) {
    torsoMat.emissiveIntensity = 0;
  }

  if (rig.recoilTimer > 0) {
    rig.recoilTimer = Math.max(0, rig.recoilTimer - dt);
  }
  if (rig.reloadAnimTimer > 0) {
    rig.reloadAnimTimer = Math.max(0, rig.reloadAnimTimer - dt);
  }

  // Stance vertical & pitch adjustments
  let targetBodyY = 0;
  let targetBodyPitch = 0;
  let targetBodyRoll = 0;

  if (stance === 'crouching') {
    targetBodyY = -0.32;
    targetBodyPitch = 0.18;
  } else if (stance === 'prone') {
    targetBodyY = -0.72;
    targetBodyPitch = Math.PI / 2.15;
  } else if (stance === 'downed') {
    targetBodyY = -0.52;
    targetBodyPitch = 0.45;
  } else if (stance === 'driving') {
    targetBodyY = -0.35;
  }

  if (rig.hitFlashTimer > 0) {
    targetBodyPitch -= 0.12;
  }

  rig.bodyGroup.position.y = THREE.MathUtils.damp(
    rig.bodyGroup.position.y,
    targetBodyY,
    12,
    dt
  );
  rig.bodyGroup.rotation.x = THREE.MathUtils.damp(
    rig.bodyGroup.rotation.x,
    targetBodyPitch,
    12,
    dt
  );
  rig.bodyGroup.rotation.z = THREE.MathUtils.damp(
    rig.bodyGroup.rotation.z,
    targetBodyRoll,
    12,
    dt
  );

  // Limb targets
  let lLegX = 0;
  let rLegX = 0;
  let lArmX = 0;
  let rArmX = -0.65;
  let lArmZ = 0;
  let rArmZ = 0;

  if (stance === 'parachuting') {
    lArmX = -2.6;
    rArmX = -2.6;
    lLegX = 0.25 + Math.sin(elapsedTime * 4) * 0.12;
    rLegX = -0.25 + Math.cos(elapsedTime * 4) * 0.12;
    rig.gliderGroup.rotation.z = Math.sin(elapsedTime * 2.5) * 0.08;
  } else if (animState === 'sprinting' || animState === 'running') {
    const freq = animState === 'sprinting' ? 13 : 9.5;
    const amp = animState === 'sprinting' ? 0.78 : 0.55;
    lLegX = Math.sin(elapsedTime * freq) * amp;
    rLegX = -Math.sin(elapsedTime * freq) * amp;
    lArmX = -Math.sin(elapsedTime * freq) * (amp * 0.75);
    rArmX = -1.05 + Math.sin(elapsedTime * freq) * 0.2;
  } else if (animState === 'walking' || animState === 'crouching') {
    const freq = 6.5;
    const amp = 0.36;
    lLegX = Math.sin(elapsedTime * freq) * amp;
    rLegX = -Math.sin(elapsedTime * freq) * amp;
    lArmX = -Math.sin(elapsedTime * freq) * 0.28;
    rArmX = -1.15;
  } else if (animState === 'jumping' || animState === 'landing') {
    lLegX = -0.42;
    rLegX = 0.32;
    lArmX = -0.85;
    rArmX = -1.25;
  } else if (animState === 'aiming' || animState === 'using_equipment') {
    rArmX = -Math.PI / 2;
    lArmX = -1.35;
  } else if (animState === 'victory') {
    lArmX = -2.7 + Math.sin(elapsedTime * 6) * 0.25;
    rArmX = -2.7 - Math.sin(elapsedTime * 6) * 0.25;
    lArmZ = 0.25;
    rArmZ = -0.25;
  } else if (animState === 'defeat') {
    lArmX = 0.35;
    rArmX = 0.35;
  } else {
    // Idle breathing
    const breath = Math.sin(elapsedTime * 2.4) * 0.04;
    lArmX = breath;
    rArmX = -0.85 + breath;
  }

  // Apply reload procedural arm motion
  if (rig.reloadAnimTimer > 0) {
    rArmX = -1.1 + Math.sin(elapsedTime * 10) * 0.15;
    lArmX = -1.35 + Math.cos(elapsedTime * 12) * 0.28;
    lArmZ = -0.28;
  }

  // Apply firing recoil kick
  if (rig.recoilTimer > 0) {
    const kick = (rig.recoilTimer / 0.14) * 0.22;
    rArmX -= kick;
  }

  rig.leftLegPivot.rotation.x = THREE.MathUtils.damp(
    rig.leftLegPivot.rotation.x,
    lLegX,
    14,
    dt
  );
  rig.rightLegPivot.rotation.x = THREE.MathUtils.damp(
    rig.rightLegPivot.rotation.x,
    rLegX,
    14,
    dt
  );
  rig.leftArmPivot.rotation.x = THREE.MathUtils.damp(
    rig.leftArmPivot.rotation.x,
    lArmX,
    14,
    dt
  );
  rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(
    rig.rightArmPivot.rotation.x,
    rArmX,
    18,
    dt
  );
  rig.leftArmPivot.rotation.z = THREE.MathUtils.damp(
    rig.leftArmPivot.rotation.z,
    lArmZ,
    12,
    dt
  );
  rig.rightArmPivot.rotation.z = THREE.MathUtils.damp(
    rig.rightArmPivot.rotation.z,
    rArmZ,
    12,
    dt
  );

  // Keep weaponMesh default orientation compensated for rightArmPivot.rotation.x so local +Z stays level in lobby/idle
  const reloadRoll = rig.reloadAnimTimer > 0 ? 0.35 : 0;
  rig.weaponMesh.rotation.set(-rig.rightArmPivot.rotation.x, 0, reloadRoll);
}

export function createVehicleMeshByType(
  type: 'rover' | 'sprinter' | 'moto'
): { root: THREE.Group; wheels: THREE.Mesh[] } {
  if (type === 'sprinter') {
    const root = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#00E5FF',
      roughness: 0.3,
      metalness: 0.5,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: '#0F172A',
      roughness: 0.7,
      metalness: 0.3,
    });
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.45, 3.4),
      bodyMat
    );
    chassis.position.set(0, 0.55, 0);
    chassis.castShadow = true;
    root.add(chassis);

    const spoiler = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.1, 0.45),
      trimMat
    );
    spoiler.position.set(0, 1.15, -1.45);
    root.add(spoiler);

    const rollBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.65, 1.3),
      trimMat
    );
    rollBar.position.set(0, 0.95, -0.15);
    root.add(rollBar);

    const wheels: THREE.Mesh[] = [];
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const [wx, wy, wz] of [
      [-1.0, 0.4, 1.1],
      [1.0, 0.4, 1.1],
      [-1.0, 0.4, -1.1],
      [1.0, 0.4, -1.1],
    ]) {
      const w = new THREE.Mesh(wheelGeo, trimMat);
      w.position.set(wx, wy, wz);
      root.add(w);
      wheels.push(w);
    }
    return { root, wheels };
  }

  if (type === 'moto') {
    const root = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({
      color: '#F59E0B',
      roughness: 0.35,
      metalness: 0.45,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: '#1E293B',
      roughness: 0.75,
    });
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.52, 1.95),
      frameMat
    );
    body.position.set(0, 0.68, 0);
    body.castShadow = true;
    root.add(body);

    const handlebar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8),
      tireMat
    );
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.12, 0.55);
    root.add(handlebar);

    const wheels: THREE.Mesh[] = [];
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.22, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const wz of [0.85, -0.85]) {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.position.set(0, 0.38, wz);
      root.add(w);
      wheels.push(w);
    }
    return { root, wheels };
  }

  return createIslandRoverMesh();
}

export function createIslandRoverMesh(): {
  root: THREE.Group;
  wheels: THREE.Mesh[];
} {
  const root = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#FF6B1A',
    roughness: 0.35,
    metalness: 0.45,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.7,
    metalness: 0.25,
  });
  const cageMat = new THREE.MeshStandardMaterial({
    color: '#E2E8F0',
    roughness: 0.3,
    metalness: 0.8,
  });
  const lightMat = new THREE.MeshStandardMaterial({
    color: '#FEF08A',
    emissive: '#FEF08A',
    emissiveIntensity: 0.7,
  });

  // Main Chassis
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.65, 3.8),
    bodyMat
  );
  chassis.position.set(0, 0.68, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  root.add(chassis);

  // Front Hood Slope
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.32, 1.25),
    trimMat
  );
  hood.position.set(0, 1.05, 1.15);
  hood.castShadow = true;
  root.add(hood);

  // Roll Cage Pillars & Roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.12, 1.9),
    cageMat
  );
  roof.position.set(0, 2.02, -0.15);
  root.add(roof);

  const pillarPositions = [
    [-0.88, 1.5, 0.65],
    [0.88, 1.5, 0.65],
    [-0.88, 1.5, -0.95],
    [0.88, 1.5, -0.95],
  ];
  for (const [px, py, pz] of pillarPositions) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.05, 8),
      cageMat
    );
    pillar.position.set(px, py, pz);
    root.add(pillar);
  }

  // Headlights
  const leftLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.18, 0.1),
    lightMat
  );
  leftLight.position.set(-0.7, 0.78, 1.91);
  const rightLight = leftLight.clone();
  rightLight.position.set(0.7, 0.78, 1.91);
  root.add(leftLight, rightLight);

  // 4 Wheels
  const wheels: THREE.Mesh[] = [];
  const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.36, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelOffsets = [
    [-1.15, 0.46, 1.22],
    [1.15, 0.46, 1.22],
    [-1.15, 0.46, -1.22],
    [1.15, 0.46, -1.22],
  ];
  for (const [wx, wy, wz] of wheelOffsets) {
    const w = new THREE.Mesh(wheelGeo, trimMat);
    w.position.set(wx, wy, wz);
    w.castShadow = true;
    root.add(w);
    wheels.push(w);
  }

  return { root, wheels };
}

export function createCoverBarrierMesh(isPreview = false, isValid = true): THREE.Group {
  const group = new THREE.Group();
  const color = !isValid ? '#EF4444' : '#00E5FF';

  const panelMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: isPreview ? 0.35 : 0.25,
    transparent: true,
    opacity: isPreview ? 0.42 : 0.76,
    roughness: 0.2,
    metalness: 0.3,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: '#0F172A',
    roughness: 0.5,
    metalness: 0.7,
    transparent: isPreview,
    opacity: isPreview ? 0.55 : 1,
  });

  const centerWall = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 2.0, 0.24),
    panelMat
  );
  centerWall.position.set(0, 1.0, 0);
  group.add(centerWall);

  const basePlinth = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.22, 0.44),
    frameMat
  );
  basePlinth.position.set(0, 0.11, 0);
  group.add(basePlinth);

  const leftPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 2.1, 0.34),
    frameMat
  );
  leftPost.position.set(-1.6, 1.05, 0);
  const rightPost = leftPost.clone();
  rightPost.position.set(1.6, 1.05, 0);
  group.add(leftPost, rightPost);

  return group;
}

export function createSupplyCrateMesh(rarity: RarityTier): THREE.Group {
  const group = new THREE.Group();
  const rarityHex = RARITY_COLORS[rarity];

  const boxMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.6,
    metalness: 0.35,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: rarityHex,
    emissive: rarityHex,
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.5,
  });

  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.52, 0.76), boxMat);
  crate.position.y = 0.26;
  crate.castShadow = true;
  group.add(crate);

  const lidBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.12, 0.8),
    glowMat
  );
  lidBand.position.y = 0.46;
  group.add(lidBand);

  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.56, 16),
    new THREE.MeshBasicMaterial({
      color: rarityHex,
      side: THREE.DoubleSide,
    })
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.03;
  group.add(beaconRing);

  return group;
}
