# Classic Drop (V1.0 + V2.0 Unified Edition)

A complete, all-in-one 3D classic-era mobile battle royale and tactical arena game that merges the entire **V1.0 Foundation Specification** and the **V2.0 Nostalgia Update Specification** into one unified, immediately playable application.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Unified V1 + V2 Single-Build Commitment**: Rather than splitting development into separate releases, **both V1.0 and V2.0 specifications are combined into one complete build** covering every game mode, map region, movement mechanic, AI behavior, vehicle, and progression system from both documents.

- **Confirmed Brand & Identity**: **Classic Drop: V2 Nostalgia Edition** — featuring an original emblem, classic 2018–2020 nostalgic lobby, and zero external asset dependencies.
- **Confirmed Unified Scope (V1 + V2 in One)**:
  - **V1.0 Core Systems**: 20-contestant Solo Battle Royale, Sunset Island's 5 core regions, pre-match aircraft deployment & parachute landing, third-person camera with wall-clip prevention & Y-invert, full movement suite (walk, run, sprint, jump, crouch, prone, stairs, doorways, slopes), 5 fictional energy equipment types, collectible supply crates & full Inventory Panel, deployable Temporary Cover Gadget, shrinking Safe Zone with countdowns, and synthesized Web Audio (Music, Effects, Ambient).
  - **V2.0 Expansion Systems**: 5 additional Sunset Island regions (10 total named POIs), **Clash Arena** (4v4 best-of-5 round mode on **Sunset Yard** with round economy), **4-Player Squad Battle Royale** (1 player + 3 AI teammates with 5 contextual squad commands and incapacitation/revive assistance), **Training Grounds** (5 interactive practice trials), upgraded 12-state AI with stuck-detection recovery, **Spectator Mode** (Previous/Next contestant cycling), drivable **Island Rover Vehicle**, 8 tracked **Achievements**, **Match History** log, and **LOW / MEDIUM / HIGH** graphics presets.
- **Confirmed Control Ergonomics**: **Dual-Mode Controls** — Multi-touch Android landscape controls (left virtual joystick, right touch-look zone, context-sensitive thumb buttons, customizable HUD scale/layout, portrait orientation prompt) plus full desktop keyboard and mouse bindings.

---

## 1. Overview & Core Concept

- **What It Does**: Combines the complete V1.0 Battle Royale experience and V2.0 expansion modes into a single cohesive 3D game. Players can drop solo or with a 4-player AI squad onto the 10-region **Sunset Island**, compete in best-of-5 tactical rounds in **Clash Arena (Sunset Yard)**, or hone their skills across 5 guided courses in **Training Grounds**.
- **Target Audience / Persona**: Mobile battle-royale players and developers on Android phones who want the nostalgic simplicity, colorful low-poly visuals, fast matches, and fair local progression of 2018–2020 mobile survival games.
- **Key Value**: Every feature from both the V1 and V2 specifications works out of the box in one unified codebase—running offline-first in mobile and desktop browsers with procedural 3D models, synthesized audio, and versioned local saves.

---

## 2. User Experience & Visual Design

### Unified User Flows (V1 + V2 Combined)

1. **Classic-Style 3D Lobby & Character Showcase (V1 Section 17 + V2 Section 8)**:
   - Opens into a colorful 3D tropical backdrop with an interactive character turntable where players can rotate their character and preview owned outfits, color themes, backpacks, accessories, and victory poses.
   - Direct navigation tabs open functional screens for:
     - **Mode Selection**: *Battle Royale (Solo — 20 Contestants)*, *Battle Royale (4-Player Squad)*, *Clash Arena (4v4 Best-of-5)*, and *Training Grounds (5 Trials)*.
     - **Character & Collection**: Equip outfits, color palettes, backpacks, and profile frames.
     - **Profile & Achievements**: View player level, XP bar, career stats (total matches, wins, top placements, eliminations, arena wins, training completions), and 8 achievements (*First Landing*, *First Victory*, *Island Explorer*, *Training Graduate*, *Team Player*, *Arena Champion*, *Safe-Zone Survivor*, *Collector*).
     - **Match History**: Inspect recent matches (mode, timestamp, duration, placement/score, eliminations, outcome) with an option in Settings to clear history.
     - **Settings**: Graphics preset (*LOW / MEDIUM / HIGH*), shadow quality, independent *Music / Effects / Ambient* volume sliders + Mute toggle, camera & movement sensitivity, invert vertical camera toggle, HUD scale/layout customization, live FPS performance readout, and Reset Saved Data.

2. **Battle Royale Mode — Solo & 4-Player Squad (V1 Sections 4–15 + V2 Sections 4, 6, 11, 12)**:
   - **Pre-Match Introduction & Aerial Deployment**: Starts inside/above a fictional sky transport aircraft crossing **Sunset Island**. Players view named region markers below, tap **JUMP / DEPLOY**, steer their aerial descent, open their glider/parachute, and land smoothly on terrain or rooftops.
   - **Unified 10-Region Sunset Island Map** (V1 5 Regions + V2 5 Regions connected by dirt roads, pathways, hills, and coastal beaches):
     1. *Palm Village* (V1): Small wooden houses, fences, and narrow village roads.
     2. *Old Harbor* (V1): Coastal docks, shipping containers, and waterfront warehouses.
     3. *Green Ridge* (V1): Elevated terraced hills, rocks, and palm groves.
     4. *Dustyard* (V1): Open industrial ground, boundary walls, and storage sheds.
     5. *Central Estate* (V1): Multi-building central compound with accessible stairs, doorways, balconies, and rooftops.
     6. *Coastal Village* (V2): Beachside stilt houses, boardwalks, and supply caches.
     7. *Forgotten Depot* (V2): Interconnected cargo bays and industrial containers.
     8. *Hilltop Observatory* (V2): High-ground radar dome landmark with interior rooms.
     9. *Riverside Market* (V2): Open-air market stalls, walkways, and natural cover.
     10. *Abandoned Research Station* (V2): Modular lab structures with interior corridors.
   - **Scavenging, Inventory & Temporary Cover Gadget**:
     - Seeded procedural loot spawns across buildings and recognizable supply containers without ever spawning inside walls or underground.
     - Approaching supplies reveals a context-sensitive **PICK UP** button updating the player's HUD and collapsible **Inventory Panel** (showing equipped projectile projectors, ammo/energy cells, armor protection level, health kits, and utility gadgets).
     - Players can deploy the **Temporary Cover Gadget** (translucent energy barrier) with a live placement range preview that rejects invalid wall/steep-slope placements, blocks movement and projectiles, and expires after a countdown timer.
   - **Drivable Vehicle (V2 Section 12)**:
     - Players can approach the stylized **Island Rover**, tap **ENTER VEHICLE**, and use **Accelerate, Brake, Steer Left/Right, Reverse, and Exit** controls with building/terrain collision and safe exit handling.
   - **4-Player Squad Mode & AI Teammates (V2 Section 4)**:
     - Spawns 1 human player + 3 AI teammates with squad-member health/status bars, leader badge, and 3D/minimap teammate markers.
     - Includes the 5-command tactical menu (**1. FOLLOW**, **2. HOLD POSITION**, **3. MOVE TO MARKER**, **4. REGROUP**, **5. ASSIST TEAMMATE**) that directly changes teammate AI states and triggers non-spammy contextual status messages.
     - Supports the **Incapacitated (Downed) & Revive Assistance** system with a visible countdown timer where nearby teammates or the player can revive a downed squad member before final elimination.
   - **Shrinking Safe Zone & Spectator Mode (V1 Section 13 + V2 Section 11)**:
     - Multi-stage shrinking safe zone with warning banners, countdown timer, minimap rings (current safe boundary + next safe boundary), world boundary wall, and health penalty outside the active zone.
     - Upon player elimination, offers **Spectator Mode** (smoothly following remaining active AI contestants with *Previous Contestant*, *Next Contestant*, contestant name, remaining count, and *Return to Results*) or immediate transition to **Match Results**.

3. **Clash Arena — 4v4 Round-Based Mode on Sunset Yard (V2 Section 3)**:
   - Symmetrical compact arena (**Sunset Yard**) featuring team spawn zones, low cover walls, shipping containers, small buildings, open lanes, elevated platforms, and a perimeter boundary.
   - **Best-of-5 Match Format** (first team to 3 round wins):
     - Starts each round with a preparation countdown and **Round Economy Buy Menu** where players spend round budget credits on fictional equipment, protection upgrades, and cover gadgets.
     - Tracks round timer, active team member counts, round scores, and fair tiebreaker resolution (remaining alive count + total team health if timer expires).
     - Cleanly resets positions, health, and eliminated states at the start of every round and provides Rematch / Return to Lobby options at match end.

4. **Training Grounds — 5 Interactive Practice Trials (V2 Section 5)**:
   - Dedicated training facility accessible from the lobby with 5 distinct stations and non-graphic visual targets:
     1. **Movement Trial**: Timed obstacle, jump, crouch, and sprint course.
     2. **Navigation Trial**: Waypoint-to-waypoint landmark routing challenge.
     3. **Camera Trial**: Smooth camera rotation and moving visual marker tracking.
     4. **Equipment Trial**: Target recognition, switching fictional projectile equipment, reloading, and deploying temporary cover.
     5. **Survival Trial**: Recognizing safe-zone warnings and sprinting into the marked safe ring before expiry.
   - Displays current objective, progress, completion status, elapsed time, Restart Trial button, and Return to Lobby button without altering competitive match win/loss ratios.

### Visual Identity & Theme

- **Aesthetic Direction**: Nostalgic 2018–2020 Classic Mobile Battle Royale — bright daylight sky, readable low-poly architecture, distinct character silhouettes, and high-contrast arcade UI.
- **Color Palette & Mood**:
  - `--background`: `#0D1726` (Lobby/modal deep slate) & `#5CB8FF` (Bright tropical sky with horizon fog `#C7E8FF`).
  - `--primary`: `#FF6B1A` (Classic nostalgia sunset orange for PLAY CTA, zone warnings, and victory highlights).
  - `--accent`: `#00E5FF` (Arcade cyan for energy shields, deployable cover barriers, and squad indicators).
  - *Rarity Colors*: Common (`#94A3B8`), Rare (`#38BDF8`), Epic (`#A855F7`), Legendary (`#F59E0B`).
- **Typography & Hierarchy**:
  - *Display*: Bold geometric condensed sans (`Chakra Petch` / `Oswald`) for mode titles, round banners, and VICTORY / DEFEAT headings.
  - *Body*: `Plus Jakarta Sans` for clean mobile readability.
  - *Numeric Telemetry*: `JetBrains Mono` (`tabular-nums`) for timers, contestant counts, ammo/energy, and FPS metrics.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Unified V1 + V2 Architecture in a Single State Machine**
  - *Chosen Approach*: Build one shared simulation core that parameterizes the active map (`Sunset Island`, `Sunset Yard`, or `Training Grounds`), team roster (`Solo 20`, `Squad 4x5`, `Arena 4v4`, `Training 1`), and ruleset (Safe-Zone BR, Round-Based Bo5 Economy, or Timed Trials).
  - *Why*: Guarantees that character movement, third-person camera collision, articulated animations, fictional weapons, cover gadgets, touch controls, audio, and local saves work identically across every V1 and V2 mode without duplicate code paths.
- **Decision 2: Articulated Procedural 3D Characters & Instanced Environment**
  - *Chosen Approach*: Construct every character as an articulated multi-part `THREE.Group` (head, visor/hair, torso, upper/lower arms, legs, shoes, backpack, held equipment) supporting all 13 procedural animation states (*Idle, Walking, Running, Sprinting, Jumping, Landing, Crouching, Prone, Aiming, Using Equipment, Taking a Hit, Victory, Defeat*), and use `THREE.InstancedMesh` for trees, rocks, fences, and grass clumps.
  - *Why*: Ensures smooth 30–60 FPS performance on mid-range Android browsers with zero external `.glb` download failures.
- **Decision 3: Multi-Touch Identifier Tracking & Context-Sensitive HUD**
  - *Chosen Approach*: Track independent `Touch.identifier` pointers for the left movement joystick, right camera look region, and action buttons, displaying context-sensitive buttons (*Pick Up*, *Reload*, *Deploy Cover*, *Enter/Exit Vehicle*, *Revive Teammate*) only when relevant.
  - *Why*: Prevents thumb cross-talk during simultaneous move + aim + fire actions on phone screens and keeps over 85% of the viewport unobstructed.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                CLASSIC DROP (V1.0 + V2.0 UNIFIED APPLICATION)                │
│                   React App Shell, Mode Router & Save Store                  │
└───────────────────┬──────────────────────────────────────┬───────────────────┘
                    │                                      │
                    ▼                                      ▼
┌─────────────────────────────────────────┐  ┌─────────────────────────────────┐
│        2D UI, LOBBY & HUD LAYER         │  │   3D SIMULATION & WEBGL ENGINE  │
│  (Responsive Landscape + Portrait Lock) │  │   (Isolated Canvas Ref Mount)   │
├─────────────────────────────────────────┤  ├─────────────────────────────────┤
│ • Nostalgic Main Lobby & 3D Turntable   │  │ • Renderer & Graphics Presets   │
│   - Mode Picker (BR Solo/Squad, Arena,  │  │   (LOW / MEDIUM / HIGH)         │
│     Training Grounds)                   │  │ • Procedural Map Builders:      │
│   - Character & Outfit Collection       │  │   - Sunset Island (10 Regions)  │
│   - Profile, XP & 8 Achievements        │  │   - Sunset Yard (Clash Arena)   │
│   - Match History (25 Saved Entries)    │  │   - Training Grounds (5 Courses)│
│   - Settings & HUD Layout Customizer    │  │ • Articulated 3D Character Rig  │
│ • Dual-Mode Input Layer:                │  │   (13 Procedural Animations)    │
│   - Multi-Touch Joystick + Look Region  │  │ • Third-Person Camera Controller│
│   - Context-Sensitive Action Buttons    │  │   (Wall Raycast + Y-Invert)     │
│   - Keyboard & Mouse Controls           │  │ • Fictional Projectile Engine   │
│ • In-Game Classic HUD:                  │  │   (5 Weapons + Cover Barrier)   │
│   - Top Match Bar & 2D Canvas Minimap   │  │ • 12-State Bot & Squad AI       │
│   - Squad Health & 5-Command Menu       │  │   (Waypoints, LOS, Stuck Fix,   │
│   - Collapsible Inventory Panel         │  │    Downed/Revive Assistance)    │
│   - Clash Arena Round Economy Shop      │  │ • Deployment & Safe-Zone System │
│   - Spectator Bar & Match Results Modal │  │ • Drivable Island Rover Vehicle │
└───────────────────┬─────────────────────┘  └─────────────────┬───────────────┘
                    │                                          │
                    └────────────────────┬─────────────────────┘
                                         ▼
                    ┌──────────────────────────────────────────┐
                    │  WEB AUDIO SYNTHESIZER & LOCAL STORAGE   │
                    ├──────────────────────────────────────────┤
                    │ • Synthesized SFX, Ambience & Menu Music │
                    │   (Footsteps, Shots, Hits, Zone, UI)     │
                    │ • Versioned LocalStorage Save System     │
                    │   (Graceful Recovery & Full Reset)       │
                    └──────────────────────────────────────────┘
```

### Data Model & Unified Feature Mapping

- **Centralized Equipment Configuration (V1 Section 10)**:
  - Stores abstract stats (*effective range, projectile speed, energy capacity, recharge time, damage category, handling spread, rarity color, arena credit cost*) for:
    1. **Rapid Pulse Emitter** (Fast automatic energy pulse)
    2. **Charged Arc Launcher** (High-impact heavy arc projectile)
    3. **Burst-Light Projector** (3-round mid-range precision burst)
    4. **Precision Energy Caster** (Long-range high-velocity beam)
    5. **Close-Range Energy Projector** (Wide close-quarters scatter pulse)
    6. **Temporary Cover Gadget** (Deployable translucent barrier with placement preview, collision, and expiration timer)
- **Unified AI State Machine (V1 Section 12 + V2 Sections 4 & 7)**:
  - States: `WaitingForDeployment` → `Parachuting` → `Idle` → `Exploring` → `CollectingSupplies` → `Following` → `MovingToDestination` → `Investigating` → `ApproachingEncounter` → `Retreating` → `Regrouping` → `AssistingTeammate` → `MovingToSafeZone` → `Incapacitated` → `Eliminated`.
  - Includes automatic stuck detection (monitoring position delta over 1.5s) that halts movement, picks an alternate waypoint, and resumes navigation cleanly.
- **Complete Lifecycle & Clean Restart**:
  - Every match end, round transition, or restart cleans up active timers, projectiles, cover barriers, and AI loops, updates XP/achievements/match history once, and prevents background ghost entities.
