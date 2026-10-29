import * as THREE from 'three';
import {
  CollectibleType,
  EQUIPMENT_CATALOG,
  GameMode,
  GraphicsPreset,
  RarityTier,
  SUNSET_ISLAND_REGIONS,
  WorldCollectible,
} from '../types/game';

export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  blocksProjectiles: boolean;
  isTemporaryCover?: boolean;
}

export interface WalkableSurface {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  heightAt: (x: number, z: number) => number;
}

export interface BuiltWorldData {
  worldGroup: THREE.Group;
  colliders: ColliderBox[];
  walkableSurfaces: WalkableSurface[];
  waypoints: { x: number; z: number }[];
  initialLoot: WorldCollectible[];
  trainingTargets: {
    id: string;
    mesh: THREE.Group;
    x: number;
    y: number;
    z: number;
    hit: boolean;
  }[];
  dispose: () => void;
}

export function groundHeightAt(x: number, z: number, mode: GameMode): number {
  if (mode === 'clash_arena' || mode === 'training') {
    return 0;
  }

  // Sunset Island deterministic terrain heightmap
  const distFromCenter = Math.hypot(x, z);
  if (distFromCenter > 188) {
    // Coastal beach slope down into ocean
    return Math.max(-1.8, (188 - distFromCenter) * 0.12);
  }

  // Smooth rolling island base
  let h =
    Math.sin(x * 0.025) * Math.cos(z * 0.025) * 1.4 +
    Math.sin((x + z) * 0.015) * 0.9;

  // Elevate Green Ridge (-85, 80)
  const dGreenRidge = Math.hypot(x - -85, z - 80);
  if (dGreenRidge < 46) {
    h += Math.cos((dGreenRidge / 46) * (Math.PI / 2)) * 6.2;
  }

  // Elevate Hilltop Observatory (5, 125)
  const dObservatory = Math.hypot(x - 5, z - 125);
  if (dObservatory < 44) {
    h += Math.cos((dObservatory / 44) * (Math.PI / 2)) * 7.5;
  }

  // Flatten building foundations around POIs so structures sit flush
  for (const reg of SUNSET_ISLAND_REGIONS) {
    if (reg.id === 'green_ridge' || reg.id === 'hilltop_observatory') continue;
    const d = Math.hypot(x - reg.x, z - reg.z);
    if (d < reg.radius * 0.85) {
      const blend = Math.max(0, 1 - d / (reg.radius * 0.85));
      h = THREE.MathUtils.lerp(h, 0.6, blend * 0.85);
    }
  }

  return Math.max(0.1, h);
}

export function getSupportHeightAt(
  x: number,
  z: number,
  currentY: number,
  mode: GameMode,
  walkableSurfaces: WalkableSurface[]
): number {
  let supportY = groundHeightAt(x, z, mode);
  for (const surf of walkableSurfaces) {
    if (x >= surf.minX && x <= surf.maxX && z >= surf.minZ && z <= surf.maxZ) {
      const sh = surf.heightAt(x, z);
      // Allow stepping up onto stairs/floors/rooftops within step tolerance
      if (sh <= currentY + 1.15 && sh > supportY) {
        supportY = sh;
      }
    }
  }
  return supportY;
}

export function resolveHorizontalCollision(
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  colliders: ColliderBox[]
): { x: number; z: number; hitWall: boolean } {
  let outX = x;
  let outZ = z;
  let hitWall = false;

  for (const box of colliders) {
    if (y + height <= box.minY + 0.15 || y >= box.maxY - 0.15) {
      continue;
    }
    const closestX = Math.max(box.minX, Math.min(outX, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(outZ, box.maxZ));
    const dx = outX - closestX;
    const dz = outZ - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      hitWall = true;
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const push = radius - dist;
        outX += (dx / dist) * push;
        outZ += (dz / dist) * push;
      } else {
        // Inside box fallback: push out along shallowest axis
        const penLeft = Math.abs(outX - box.minX);
        const penRight = Math.abs(box.maxX - outX);
        const penBack = Math.abs(outZ - box.minZ);
        const penFront = Math.abs(box.maxZ - outZ);
        const minPen = Math.min(penLeft, penRight, penBack, penFront);
        if (minPen === penLeft) outX = box.minX - radius;
        else if (minPen === penRight) outX = box.maxX + radius;
        else if (minPen === penBack) outZ = box.minZ - radius;
        else outZ = box.maxZ + radius;
      }
    }
  }

  return { x: outX, z: outZ, hitWall };
}

export function castSegmentAgainstColliders(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  colliders: ColliderBox[]
): { hit: boolean; hitX: number; hitY: number; hitZ: number; colliderId?: string } {
  let minT = 1.0;
  let hit = false;
  let colliderId: string | undefined;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;

  for (const box of colliders) {
    if (!box.blocksProjectiles) continue;

    let tmin = 0;
    let tmax = minT;

    // X slab
    if (Math.abs(dx) < 1e-6) {
      if (x0 < box.minX || x0 > box.maxX) continue;
    } else {
      const invD = 1 / dx;
      let t1 = (box.minX - x0) * invD;
      let t2 = (box.maxX - x0) * invD;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    // Y slab
    if (Math.abs(dy) < 1e-6) {
      if (y0 < box.minY || y0 > box.maxY) continue;
    } else {
      const invD = 1 / dy;
      let t1 = (box.minY - y0) * invD;
      let t2 = (box.maxY - y0) * invD;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    // Z slab
    if (Math.abs(dz) < 1e-6) {
      if (z0 < box.minZ || z0 > box.maxZ) continue;
    } else {
      const invD = 1 / dz;
      let t1 = (box.minZ - z0) * invD;
      let t2 = (box.maxZ - z0) * invD;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (tmin <= tmax && tmin < minT && tmin >= 0) {
      minT = tmin;
      hit = true;
      colliderId = box.id;
    }
  }

  return {
    hit,
    hitX: x0 + dx * minT,
    hitY: y0 + dy * minT,
    hitZ: z0 + dz * minT,
    colliderId,
  };
}

// Helper to add a building with an accessible doorway, interior floor, rooftop, and exterior stair ramp
function addAccessibleBuilding(
  worldGroup: THREE.Group,
  colliders: ColliderBox[],
  walkableSurfaces: WalkableSurface[],
  idPrefix: string,
  cx: number,
  cz: number,
  width: number,
  depth: number,
  height: number,
  baseY: number,
  wallColor: string,
  roofColor: string,
  hasRoofStairs: boolean
) {
  const wallMat = new THREE.MeshStandardMaterial({
    color: wallColor,
    roughness: 0.78,
    metalness: 0.08,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: roofColor,
    roughness: 0.6,
    metalness: 0.15,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.85,
  });

  const buildingGroup = new THREE.Group();
  buildingGroup.position.set(cx, baseY, cz);
  worldGroup.add(buildingGroup);

  const wallThick = 0.4;
  const hw = width / 2;
  const hd = depth / 2;
  const doorWidth = 2.4;
  const doorHeight = 2.5;

  // Interior floor slab
  const floorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.2, depth),
    floorMat
  );
  floorMesh.position.set(0, 0.1, 0);
  floorMesh.receiveShadow = true;
  buildingGroup.add(floorMesh);

  walkableSurfaces.push({
    minX: cx - hw,
    maxX: cx + hw,
    minZ: cz - hd,
    maxZ: cz + hd,
    heightAt: () => baseY + 0.2,
  });

  // Back wall (-Z)
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, wallThick),
    wallMat
  );
  backWall.position.set(0, height / 2, -hd);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  buildingGroup.add(backWall);
  colliders.push({
    id: `${idPrefix}_back`,
    minX: cx - hw,
    maxX: cx + hw,
    minY: baseY,
    maxY: baseY + height,
    minZ: cz - hd - wallThick / 2,
    maxZ: cz - hd + wallThick / 2,
    blocksProjectiles: true,
  });

  // Left wall (-X)
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick, height, depth),
    wallMat
  );
  leftWall.position.set(-hw, height / 2, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  buildingGroup.add(leftWall);
  colliders.push({
    id: `${idPrefix}_left`,
    minX: cx - hw - wallThick / 2,
    maxX: cx - hw + wallThick / 2,
    minY: baseY,
    maxY: baseY + height,
    minZ: cz - hd,
    maxZ: cz + hd,
    blocksProjectiles: true,
  });

  // Right wall (+X)
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick, height, depth),
    wallMat
  );
  rightWall.position.set(hw, height / 2, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  buildingGroup.add(rightWall);
  colliders.push({
    id: `${idPrefix}_right`,
    minX: cx + hw - wallThick / 2,
    maxX: cx + hw + wallThick / 2,
    minY: baseY,
    maxY: baseY + height,
    minZ: cz - hd,
    maxZ: cz + hd,
    blocksProjectiles: true,
  });

  // Front wall (+Z) with accessible center doorway
  const sideSegWidth = (width - doorWidth) / 2;
  const frontLeft = new THREE.Mesh(
    new THREE.BoxGeometry(sideSegWidth, height, wallThick),
    wallMat
  );
  frontLeft.position.set(-hw + sideSegWidth / 2, height / 2, hd);
  frontLeft.castShadow = true;
  buildingGroup.add(frontLeft);
  colliders.push({
    id: `${idPrefix}_fl`,
    minX: cx - hw,
    maxX: cx - doorWidth / 2,
    minY: baseY,
    maxY: baseY + height,
    minZ: cz + hd - wallThick / 2,
    maxZ: cz + hd + wallThick / 2,
    blocksProjectiles: true,
  });

  const frontRight = new THREE.Mesh(
    new THREE.BoxGeometry(sideSegWidth, height, wallThick),
    wallMat
  );
  frontRight.position.set(hw - sideSegWidth / 2, height / 2, hd);
  frontRight.castShadow = true;
  buildingGroup.add(frontRight);
  colliders.push({
    id: `${idPrefix}_fr`,
    minX: cx + doorWidth / 2,
    maxX: cx + hw,
    minY: baseY,
    maxY: baseY + height,
    minZ: cz + hd - wallThick / 2,
    maxZ: cz + hd + wallThick / 2,
    blocksProjectiles: true,
  });

  // Door lintel above entrance
  const lintelH = height - doorHeight;
  if (lintelH > 0.1) {
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth, lintelH, wallThick),
      roofMat
    );
    lintel.position.set(0, doorHeight + lintelH / 2, hd);
    buildingGroup.add(lintel);
  }

  // Roof / Balcony Slab
  const roofSlab = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.6, 0.35, depth + 0.6),
    roofMat
  );
  roofSlab.position.set(0, height + 0.175, 0);
  roofSlab.castShadow = true;
  roofSlab.receiveShadow = true;
  buildingGroup.add(roofSlab);

  walkableSurfaces.push({
    minX: cx - hw - 0.3,
    maxX: cx + hw + 0.3,
    minZ: cz - hd - 0.3,
    maxZ: cz + hd + 0.3,
    heightAt: () => baseY + height + 0.35,
  });

  // Optional exterior stair ramp on the +X side to climb onto rooftop
  if (hasRoofStairs) {
    const stairWidth = 2.0;
    const stairLen = depth;
    const steps = 8;
    for (let s = 0; s < steps; s++) {
      const stepH = ((s + 1) / steps) * height;
      const stepZ = hd - ((s + 0.5) / steps) * stairLen;
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(stairWidth, stepH, stairLen / steps),
        roofMat
      );
      stepMesh.position.set(hw + stairWidth / 2 + 0.2, stepH / 2, stepZ);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      buildingGroup.add(stepMesh);
    }

    walkableSurfaces.push({
      minX: cx + hw + 0.1,
      maxX: cx + hw + stairWidth + 0.3,
      minZ: cz - hd,
      maxZ: cz + hd,
      heightAt: (_x: number, z: number) => {
        const progress = THREE.MathUtils.clamp(
          (cz + hd - z) / stairLen,
          0,
          1
        );
        return baseY + progress * (height + 0.35);
      },
    });
  }
}

export function buildGameWorld(
  mode: GameMode,
  preset: GraphicsPreset
): BuiltWorldData {
  const worldGroup = new THREE.Group();
  const colliders: ColliderBox[] = [];
  const walkableSurfaces: WalkableSurface[] = [];
  const waypoints: { x: number; z: number }[] = [];
  const initialLoot: WorldCollectible[] = [];
  const trainingTargets: BuiltWorldData['trainingTargets'] = [];

  if (mode === 'clash_arena') {
    buildClashArenaSunsetYard(
      worldGroup,
      colliders,
      walkableSurfaces,
      waypoints
    );
  } else if (mode === 'training') {
    buildTrainingGrounds(
      worldGroup,
      colliders,
      walkableSurfaces,
      initialLoot,
      trainingTargets
    );
  } else {
    buildSunsetIsland(
      worldGroup,
      colliders,
      walkableSurfaces,
      waypoints,
      initialLoot,
      preset
    );
  }

  const dispose = () => {
    worldGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });
  };

  return {
    worldGroup,
    colliders,
    walkableSurfaces,
    waypoints,
    initialLoot,
    trainingTargets,
    dispose,
  };
}

function buildSunsetIsland(
  worldGroup: THREE.Group,
  colliders: ColliderBox[],
  walkableSurfaces: WalkableSurface[],
  waypoints: { x: number; z: number }[],
  initialLoot: WorldCollectible[],
  preset: GraphicsPreset
) {
  // 1. Surrounding Ocean Plane
  const oceanGeo = new THREE.PlaneGeometry(900, 900);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: '#0284C7',
    roughness: 0.25,
    metalness: 0.15,
  });
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.y = -0.65;
  worldGroup.add(oceanMesh);

  // 2. Sculpted Island Terrain Mesh with Vertex Colors (Grass, Sand, Dirt Roads, Ridge Rock)
  const segs = preset === 'LOW' ? 64 : preset === 'MEDIUM' ? 96 : 128;
  const terrainGeo = new THREE.PlaneGeometry(420, 420, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cGrass = new THREE.Color('#4D9E34');
  const cRidge = new THREE.Color('#65A30D');
  const cSand = new THREE.Color('#EAB308');
  const cRoad = new THREE.Color('#A16207');

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = groundHeightAt(vx, vz, 'br_solo');
    posAttr.setY(i, vy);

    const dist = Math.hypot(vx, vz);
    // Check if near main crossroad paths connecting regions
    const onRoad =
      Math.abs(vx) < 3.6 ||
      Math.abs(vz) < 3.6 ||
      Math.abs(vx - vz * 1.15) < 3.2 ||
      Math.abs(vx + vz * 1.15) < 3.2;

    let col = cGrass;
    if (vy < 0.35 || dist > 172) {
      col = cSand;
    } else if (onRoad && dist < 145) {
      col = cRoad;
    } else if (vy > 3.2) {
      col = cRidge;
    }

    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  worldGroup.add(terrainMesh);

  // 3. Build all 10 Named Regions (V1 Core 5 + V2 Expansion 5)
  SUNSET_ISLAND_REGIONS.forEach((reg, idx) => {
    waypoints.push({ x: reg.x, z: reg.z });
    waypoints.push({ x: reg.x + 14, z: reg.z - 12 });
    waypoints.push({ x: reg.x - 14, z: reg.z + 12 });

    const b1X = reg.x - 10;
    const b1Z = reg.z - 8;
    const b1Y = groundHeightAt(b1X, b1Z, 'br_solo');
    addAccessibleBuilding(
      worldGroup,
      colliders,
      walkableSurfaces,
      `${reg.id}_b1`,
      b1X,
      b1Z,
      10,
      9,
      3.8,
      b1Y,
      idx % 2 === 0 ? '#F8FAFC' : '#FEF3C7',
      reg.color,
      true
    );

    const b2X = reg.x + 12;
    const b2Z = reg.z + 7;
    const b2Y = groundHeightAt(b2X, b2Z, 'br_solo');
    addAccessibleBuilding(
      worldGroup,
      colliders,
      walkableSurfaces,
      `${reg.id}_b2`,
      b2X,
      b2Z,
      9,
      8,
      3.6,
      b2Y,
      '#E2E8F0',
      '#334155',
      idx % 2 === 0
    );

    // Special iconic landmark for Hilltop Observatory (Geodesic Radar Dome)
    if (reg.id === 'hilltop_observatory') {
      const domeY = groundHeightAt(reg.x, reg.z + 16, 'br_solo');
      const domeGroup = new THREE.Group();
      domeGroup.position.set(reg.x, domeY, reg.z + 16);
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(4.2, 4.8, 4.5, 12),
        new THREE.MeshStandardMaterial({ color: '#CBD5E1', roughness: 0.6 })
      );
      tower.position.y = 2.25;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(4.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: '#F8FAFC',
          roughness: 0.3,
          metalness: 0.2,
        })
      );
      dome.position.y = 4.5;
      domeGroup.add(tower, dome);
      worldGroup.add(domeGroup);
      colliders.push({
        id: 'observatory_dome',
        minX: reg.x - 4.4,
        maxX: reg.x + 4.4,
        minY: domeY,
        maxY: domeY + 8.5,
        minZ: reg.z + 16 - 4.4,
        maxZ: reg.z + 16 + 4.4,
        blocksProjectiles: true,
      });
    }

    // Special dock pier for Old Harbor
    if (reg.id === 'old_harbor') {
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.5, 28),
        new THREE.MeshStandardMaterial({ color: '#78350F', roughness: 0.85 })
      );
      pier.position.set(reg.x + 28, 0.6, reg.z + 24);
      worldGroup.add(pier);
      walkableSurfaces.push({
        minX: reg.x + 25,
        maxX: reg.x + 31,
        minZ: reg.z + 10,
        maxZ: reg.z + 38,
        heightAt: () => 0.85,
      });
    }
  });

  // 4. Instanced Palm Trees & Rocks across Sunset Island
  const treeCount = preset === 'LOW' ? 55 : preset === 'MEDIUM' ? 95 : 135;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 4.4, 7);
  trunkGeo.translate(0, 2.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: '#78350F',
    roughness: 0.9,
  });
  const canopyGeo = new THREE.ConeGeometry(2.1, 1.9, 7);
  canopyGeo.translate(0, 4.6, 0);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: '#15803D',
    roughness: 0.75,
  });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
  trunkInst.castShadow = true;
  canopyInst.castShadow = true;

  const rockCount = preset === 'LOW' ? 35 : 65;
  const rockGeo = new THREE.DodecahedronGeometry(1.35, 0);
  rockGeo.translate(0, 0.8, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#64748B',
    roughness: 0.85,
  });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  let placedTrees = 0;
  for (let i = 0; i < treeCount * 3 && placedTrees < treeCount; i++) {
    const angle = nextRand() * Math.PI * 2;
    const dist = 18 + nextRand() * 155;
    const tx = Math.cos(angle) * dist;
    const tz = Math.sin(angle) * dist;

    // Avoid spawning inside buildings
    const insideBuilding = colliders.some(
      (c) =>
        tx >= c.minX - 2.5 &&
        tx <= c.maxX + 2.5 &&
        tz >= c.minZ - 2.5 &&
        tz <= c.maxZ + 2.5
    );
    if (insideBuilding) continue;

    const ty = groundHeightAt(tx, tz, 'br_solo');
    const s = 0.85 + nextRand() * 0.35;
    dummy.position.set(tx, ty, tz);
    dummy.rotation.set(0, nextRand() * Math.PI * 2, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();

    trunkInst.setMatrixAt(placedTrees, dummy.matrix);
    canopyInst.setMatrixAt(placedTrees, dummy.matrix);

    colliders.push({
      id: `tree_${placedTrees}`,
      minX: tx - 0.38,
      maxX: tx + 0.38,
      minY: ty,
      maxY: ty + 4.5 * s,
      minZ: tz - 0.38,
      maxZ: tz + 0.38,
      blocksProjectiles: true,
    });
    placedTrees++;
  }
  trunkInst.count = placedTrees;
  canopyInst.count = placedTrees;
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  worldGroup.add(trunkInst, canopyInst);

  let placedRocks = 0;
  for (let i = 0; i < rockCount * 2 && placedRocks < rockCount; i++) {
    const angle = nextRand() * Math.PI * 2;
    const dist = 22 + nextRand() * 150;
    const rx = Math.cos(angle) * dist;
    const rz = Math.sin(angle) * dist;
    const insideBuilding = colliders.some(
      (c) =>
        rx >= c.minX - 2.5 &&
        rx <= c.maxX + 2.5 &&
        rz >= c.minZ - 2.5 &&
        rz <= c.maxZ + 2.5
    );
    if (insideBuilding) continue;

    const ry = groundHeightAt(rx, rz, 'br_solo');
    const sx = 0.8 + nextRand() * 0.6;
    const sy = 0.7 + nextRand() * 0.5;
    dummy.position.set(rx, ry, rz);
    dummy.rotation.set(0, nextRand() * Math.PI, 0);
    dummy.scale.set(sx, sy, sx);
    dummy.updateMatrix();
    rockInst.setMatrixAt(placedRocks, dummy.matrix);

    colliders.push({
      id: `rock_${placedRocks}`,
      minX: rx - 1.1 * sx,
      maxX: rx + 1.1 * sx,
      minY: ry,
      maxY: ry + 1.6 * sy,
      minZ: rz - 1.1 * sx,
      maxZ: rz + 1.1 * sx,
      blocksProjectiles: true,
    });
    placedRocks++;
  }
  rockInst.count = placedRocks;
  rockInst.instanceMatrix.needsUpdate = true;
  rockInst.computeBoundingSphere();
  worldGroup.add(rockInst);

  // 5. Seeded Collectible Supplies across all 10 Regions
  const equipKeys = Object.keys(EQUIPMENT_CATALOG);
  let lootIdx = 0;

  SUNSET_ISLAND_REGIONS.forEach((reg) => {
    const offsets = [
      [-10, -8], // Inside Building 1
      [12, 7], // Inside Building 2
      [0, 3], // Courtyard
      [-4, 11], // Road edge
      [6, -11], // Supply crate spot
      [-15, 4], // Flanking spot
    ];

    offsets.forEach(([ox, oz], spotIndex) => {
      const lx = reg.x + ox;
      const lz = reg.z + oz;
      const ly = getSupportHeightAt(lx, lz, 2.0, 'br_solo', walkableSurfaces);

      let type: CollectibleType = 'equipment';
      let equipmentId: string | undefined;
      let name = '';
      let rarity: RarityTier = 'common';
      let amount = 1;

      if (spotIndex % 3 === 0) {
        const eqKey = equipKeys[(lootIdx + spotIndex) % equipKeys.length];
        const eq = EQUIPMENT_CATALOG[eqKey];
        type = 'equipment';
        equipmentId = eq.id;
        name = eq.name;
        rarity = eq.rarity;
      } else if (spotIndex === 1) {
        type = 'health_kit';
        name = 'First-Aid Med-Kit (+50 HP)';
        rarity = 'rare';
        amount = 1;
      } else if (spotIndex === 2) {
        type = 'armor_upgrade';
        name = 'Ion Shield Plate (+50 Shield)';
        rarity = 'epic';
        amount = 50;
      } else if (spotIndex === 4) {
        type = 'cover_gadget';
        name = 'Aegis Cover Barrier (x2)';
        rarity = 'rare';
        amount = 2;
      } else {
        type = 'energy_ammo';
        name = 'Energy Cells (+36)';
        rarity = 'common';
        amount = 36;
      }

      initialLoot.push({
        id: `loot_${lootIdx++}`,
        type,
        equipmentId,
        name,
        rarity,
        amount,
        x: lx,
        y: ly,
        z: lz,
        collected: false,
      });
    });
  });
}

function buildClashArenaSunsetYard(
  worldGroup: THREE.Group,
  colliders: ColliderBox[],
  walkableSurfaces: WalkableSurface[],
  waypoints: { x: number; z: number }[]
) {
  // Symmetrical Sunset Yard Arena (76m x 96m)
  const floorGeo = new THREE.PlaneGeometry(80, 100);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    roughness: 0.85,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.receiveShadow = true;
  worldGroup.add(floorMesh);

  // Arena lane markings
  const centerLine = new THREE.Mesh(
    new THREE.PlaneGeometry(76, 0.6),
    new THREE.MeshBasicMaterial({ color: '#F59E0B' })
  );
  centerLine.rotation.x = -Math.PI / 2;
  centerLine.position.y = 0.02;
  worldGroup.add(centerLine);

  const wallMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.7,
  });
  // Perimeter Walls
  const perimConfigs: [number, number, number, number, string][] = [
    [0, -48, 80, 2, 'arena_north'],
    [0, 48, 80, 2, 'arena_south'],
    [-39, 0, 2, 96, 'arena_west'],
    [39, 0, 2, 96, 'arena_east'],
  ];
  for (const [x, z, w, d, id] of perimConfigs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 4.5, d), wallMat);
    mesh.position.set(x, 2.25, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    worldGroup.add(mesh);
    colliders.push({
      id,
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: 0,
      maxY: 4.5,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      blocksProjectiles: true,
    });
  }

  // Symmetrical Shipping Containers & Cover Walls
  const containerDefs: [number, number, number, number, number, string][] = [
    [-14, -18, 4.5, 3.2, 9, '#EA580C'],
    [14, -18, 4.5, 3.2, 9, '#0284C7'],
    [-14, 18, 4.5, 3.2, 9, '#0284C7'],
    [14, 18, 4.5, 3.2, 9, '#EA580C'],
    [0, -10, 8, 1.8, 1.6, '#64748B'],
    [0, 10, 8, 1.8, 1.6, '#64748B'],
    [-24, 0, 5, 2.8, 5, '#10B981'],
    [24, 0, 5, 2.8, 5, '#10B981'],
  ];

  containerDefs.forEach(([x, z, w, h, d, color], idx) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25 })
    );
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    worldGroup.add(m);
    colliders.push({
      id: `arena_cov_${idx}`,
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: 0,
      maxY: h,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      blocksProjectiles: true,
    });
  });

  // Central Small Warehouse with accessible doorways & roof stairs
  addAccessibleBuilding(
    worldGroup,
    colliders,
    walkableSurfaces,
    'arena_center_hub',
    0,
    0,
    11,
    9,
    3.6,
    0,
    '#E2E8F0',
    '#F59E0B',
    true
  );

  // Arena navigation waypoints
  waypoints.push(
    { x: 0, z: 0 },
    { x: -20, z: -20 },
    { x: 20, z: -20 },
    { x: -20, z: 20 },
    { x: 20, z: 20 },
    { x: -28, z: 0 },
    { x: 28, z: 0 },
    { x: 0, z: -28 },
    { x: 0, z: 28 }
  );
}

function buildTrainingGrounds(
  worldGroup: THREE.Group,
  colliders: ColliderBox[],
  walkableSurfaces: WalkableSurface[],
  initialLoot: WorldCollectible[],
  trainingTargets: BuiltWorldData['trainingTargets']
) {
  const floorGeo = new THREE.PlaneGeometry(120, 120);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.85,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.receiveShadow = true;
  worldGroup.add(floorMesh);

  // Grid lines on training floor
  const grid = new THREE.GridHelper(120, 30, '#38BDF8', '#334155');
  grid.position.y = 0.02;
  worldGroup.add(grid);

  // Station 1: Movement Hurdles (-25, z: -10 to 25)
  const hurdleMat = new THREE.MeshStandardMaterial({ color: '#FF6B1A' });
  for (let i = 0; i < 4; i++) {
    const hz = -5 + i * 8;
    const hurdle = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.85, 0.6),
      hurdleMat
    );
    hurdle.position.set(-22, 0.425, hz);
    hurdle.castShadow = true;
    worldGroup.add(hurdle);
    walkableSurfaces.push({
      minX: -24.5,
      maxX: -19.5,
      minZ: hz - 0.5,
      maxZ: hz + 0.5,
      heightAt: () => 0.85,
    });
  }

  // Station 2: Target Range (+22, z: -28)
  for (let i = 0; i < 5; i++) {
    const tx = 8 + i * 5.5;
    const tz = -26 - (i % 2) * 6;
    const targetGroup = new THREE.Group();
    targetGroup.position.set(tx, 0, tz);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: '#94A3B8' })
    );
    post.position.y = 0.7;
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 0.16, 16),
      new THREE.MeshStandardMaterial({
        color: '#00E5FF',
        emissive: '#00E5FF',
        emissiveIntensity: 0.4,
      })
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.y = 1.55;
    targetGroup.add(post, disc);
    worldGroup.add(targetGroup);

    trainingTargets.push({
      id: `target_${i}`,
      mesh: targetGroup,
      x: tx,
      y: 1.55,
      z: tz,
      hit: false,
    });
  }

  // Station 3: Equipment Bench (All 5 Fictional Projectors + Cover Gadget)
  const equipKeys = Object.keys(EQUIPMENT_CATALOG);
  equipKeys.forEach((key, idx) => {
    const eq = EQUIPMENT_CATALOG[key];
    initialLoot.push({
      id: `train_loot_${idx}`,
      type: 'equipment',
      equipmentId: eq.id,
      name: eq.name,
      rarity: eq.rarity,
      amount: 1,
      x: -10 + idx * 4.5,
      y: 0.1,
      z: -12,
      collected: false,
    });
  });

  initialLoot.push({
    id: 'train_loot_cover',
    type: 'cover_gadget',
    name: 'Aegis Cover Barrier (x5)',
    rarity: 'epic',
    amount: 5,
    x: 14,
    y: 0.1,
    z: -12,
    collected: false,
  });

  // Practice House at (0, 20)
  addAccessibleBuilding(
    worldGroup,
    colliders,
    walkableSurfaces,
    'training_house',
    0,
    22,
    10,
    8,
    3.6,
    0,
    '#F8FAFC',
    '#00E5FF',
    true
  );
}
