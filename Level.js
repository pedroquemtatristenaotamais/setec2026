export class Level {
  constructor() {
    this.objects = [];
    this.lights = [];
    this.enemySpawns = [];
    this.spawn = [0, 0, 24];

    this.zoneNames = [
      { minX: -3.7, maxX: 3.7, minZ: 17, maxZ: 30, name: "CHECKPOINT / ENTRADA" },
      { minX: -15.5, maxX: -4.0, minZ: 7.0, maxZ: 15.5, name: "ARSENAL" },
      { minX: 4.0, maxX: 15.5, minZ: 7.0, maxZ: 15.5, name: "COMUNICAÇÕES" },
      { minX: -15.5, maxX: -4.0, minZ: -4.5, maxZ: 5.5, name: "ALOJAMENTO" },
      { minX: 4.0, maxX: 15.5, minZ: -4.5, maxZ: 5.5, name: "LABORATÓRIO" },
      { minX: -15.5, maxX: 15.5, minZ: -22.0, maxZ: -5.2, name: "CENTRO DE COMANDO" },
      { minX: -15.5, maxX: 15.5, minZ: -45.0, maxZ: -23.0, name: "BAIA DO GERADOR" },
    ];
  }

  build() {
    this.objects.length = 0;
    this.lights.length = 0;
    this.enemySpawns.length = 0;

    this.buildArchitecture();
    this.buildRooms();
    this.buildIndustrialDetails();
    this.buildLighting();
    this.buildEnemies();

    return {
      objects: this.objects,
      lights: this.lights,
      enemySpawns: this.enemySpawns,
      spawn: [...this.spawn],
    };
  }

  getZoneName(position) {
    const [x, , z] = position;
    return this.zoneNames.find((zone) =>
      x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ
    )?.name || "SETOR RESTRITO";
  }

  buildArchitecture() {
    this.box("floor", [0, -0.12, -8], [34, 0.24, 70], "floor", false);
    this.box("ceiling", [0, 6.0, -8], [34, 0.30, 70], "ceiling", false);

    this.box("outer-west", [-17.0, 3.0, -8], [0.45, 6.0, 70], "concrete");
    this.box("outer-east", [17.0, 3.0, -8], [0.45, 6.0, 70], "concrete");
    this.box("outer-north", [0, 3.0, 27], [34, 6.0, 0.45], "concrete");
    this.box("outer-south", [0, 3.0, -43], [34, 6.0, 0.45], "concrete");

    // Corredor central contínuo: as paredes são segmentadas para criar entradas reais nas salas.
    this.segmentWall(-4.2, 17, -40, [
      { center: 11.2, width: 3.0 },
      { center: 0.3, width: 3.0 },
      { center: -13.5, width: 4.0 },
      { center: -31.0, width: 4.0 }
    ], "corridor-west");

    this.segmentWall(4.2, 17, -40, [
      { center: 11.2, width: 3.0 },
      { center: 0.3, width: 3.0 },
      { center: -13.5, width: 4.0 },
      { center: -31.0, width: 4.0 }
    ], "corridor-east");

    this.addDoorway(-4.2, 11.2, "ARSENAL DOOR");
    this.addDoorway(4.2, 11.2, "COMMS DOOR");
    this.addDoorway(-4.2, 0.3, "BARRACKS DOOR");
    this.addDoorway(4.2, 0.3, "LAB DOOR");
    this.addDoorway(-4.2, -13.5, "COMMAND WEST DOOR");
    this.addDoorway(4.2, -13.5, "COMMAND EAST DOOR");
    this.addDoorway(-4.2, -31.0, "GENERATOR WEST DOOR");
    this.addDoorway(4.2, -31.0, "GENERATOR EAST DOOR");

    // Portas internas ainda abertas para a exploração desta versão.
    for (const [x, z, label] of [
      [-4.12, 11.2, "ARMORY"],
      [4.12, 11.2, "COMMS"],
      [-4.12, 0.3, "BARRACKS"],
      [4.12, 0.3, "LAB"],
      [-4.12, -13.5, "COMMAND"],
      [4.12, -13.5, "COMMAND"],
      [-4.12, -31, "GENERATOR"],
      [4.12, -31, "GENERATOR"]
    ]) {
      this.addSlidingDoor(x, z, label);
    }

    for (let z = 25; z >= -40; z -= 4) {
      this.box(`floor-panel-${z}`, [0, 0.012, z], [7.8, 0.025, 3.5], "floorPanel", false);
      this.box(`ceiling-light-${z}`, [0, 5.78, z], [3.5, 0.08, 0.50], "fixture", false, [0.10, 0.16, 0.18]);
      this.box(`ceiling-beam-${z}`, [0, 5.40, z + 1.7], [8.3, 0.30, 0.30], "metalDark", false);
    }

    for (let z = 22; z >= -38; z -= 6) {
      this.box(`pillar-west-${z}`, [-3.85, 2.7, z], [0.25, 5.4, 0.25], "blackMetal", false);
      this.box(`pillar-east-${z}`, [3.85, 2.7, z], [0.25, 5.4, 0.25], "blackMetal", false);
    }
  }

  buildRooms() {
    this.buildRoomShell("armory", -10.5, 7.0, 15.5);
    this.buildRoomShell("comms", 10.5, 7.0, 15.5);
    this.buildRoomShell("barracks", -10.5, -4.5, 5.5);
    this.buildRoomShell("lab", 10.5, -4.5, 5.5);
    this.buildRoomShell("command", 0, -22.0, -5.2, true);
    this.buildRoomShell("generator", 0, -45.0, -23.0, true);

    this.buildArmoryDetails();
    this.buildCommsDetails();
    this.buildBarracksDetails();
    this.buildLabDetails();
    this.buildCommandDetails();
    this.buildGeneratorDetails();

    this.addEndDoor(0, -42.7);
    this.addSecurityGate(0, 20.8);
  }

  buildRoomShell(prefix, centerX, minZ, maxZ, fullWidth = false) {
    if (fullWidth) {
      this.box(`${prefix}-back`, [centerX, 3, minZ], [32.0, 6.0, 0.4], "steelWall");
      return;
    }

    const roomWidth = 10.5;
    const west = centerX - roomWidth / 2;
    const east = centerX + roomWidth / 2;

    this.box(`${prefix}-outer`, [centerX, 3, minZ - 0.2], [roomWidth, 6, 0.4], "steelWall");
    this.box(`${prefix}-back`, [centerX, 3, maxZ + 0.2], [roomWidth, 6, 0.4], "steelWall");
    // A parede interna de cada sala é a própria parede do corredor.
    // Isso evita paredes duplicadas bloqueando a porta.
    if (centerX > 0) {
      this.box(`${prefix}-east`, [east, 3, (minZ + maxZ) / 2], [0.4, 6, maxZ - minZ + 0.4], "steelWall");
    } else {
      this.box(`${prefix}-west`, [west, 3, (minZ + maxZ) / 2], [0.4, 6, maxZ - minZ + 0.4], "steelWall");
    }

    this.box(`${prefix}-wall-strip`, [centerX, 5.55, minZ + 1.0], [roomWidth - 0.3, 0.25, 0.25], "metalDark", false);
  }

  buildArmoryDetails() {
    this.addSign(-15.5, 4.15, 11.3, 3.3, 0.65, "signAmber");
    for (const z of [7.9, 10.4, 12.9]) {
      this.addRack(-13.8, z, 2.8);
      this.addRack(-7.3, z, 2.8);
    }
    this.addCrate(-12.7, 0.6, 8.0, 1.2, "crateAmmo");
    this.addCrate(-10.8, 0.6, 8.7, 1.1, "crateAmmo");
    this.addCrate(-8.0, 0.6, 12.7, 1.1, "crateUtility");
    this.addWorkbench(-8.2, 0.9, 9.0);
  }

  buildCommsDetails() {
    this.addSign(15.5, 4.15, 11.3, 3.8, 0.65, "signCyan");
    for (const z of [8.1, 11.0, 13.2]) {
      this.addServerRack(7.0, z);
      this.addServerRack(10.0, z);
      this.addServerRack(13.0, z);
    }
    this.addDesk(15.1, 0.95, 8.0);
    this.addDesk(15.1, 0.95, 12.1);
  }

  buildBarracksDetails() {
    this.addSign(-15.5, 4.15, 0.1, 3.6, 0.65, "signBlue");
    for (const z of [-3.0, 1.7]) {
      this.addBunk(-13.2, z);
      this.addBunk(-8.2, z);
    }
    for (const x of [-14.5, -12.7, -10.9, -9.1, -7.3]) this.addLocker(x, 4.55, 2.4);
    this.addCrate(-13.4, 0.55, -0.5, 0.9, "crateMedical");
    this.addDesk(-7.4, 0.9, 2.6);
  }

  buildLabDetails() {
    this.addSign(15.5, 4.15, 0.1, 2.8, 0.65, "signCyan");
    this.addLabBench(7.1, 0.9, -2.9);
    this.addLabBench(11.0, 0.9, -2.9);
    this.addMachine(14.1, 1.5, 1.8);
    this.addMachine(14.1, 1.5, -1.0);
    this.addCrate(7.7, 0.65, 1.8, 1.0, "crateLab");
  }

  buildCommandDetails() {
    this.addSign(-15.5, 4.15, -13.6, 4.9, 0.65, "signCyan");
    this.addMapTable(0, 1.0, -13.7);
    this.addDesk(-9.8, 0.9, -8.2);
    this.addDesk(-5.0, 0.9, -8.2);
    this.addDesk(5.0, 0.9, -8.2);
    this.addDesk(9.8, 0.9, -8.2);
    this.addScreenWall(0, 3.7, -21.45, 11.0, 2.7);
    this.addServerRack(-14.0, -18.8);
    this.addServerRack(14.0, -18.8);
  }

  buildGeneratorDetails() {
    this.addSign(-15.5, 4.15, -34.0, 5.8, 0.65, "signRed");
    this.addGenerator(0, -32.0);
    this.addMachine(-11.8, 1.7, -27.0);
    this.addMachine(11.8, 1.7, -27.0);
    this.addCrate(-13.2, 0.65, -36.5, 1.2, "crateUtility");
    this.addCrate(13.0, 0.65, -38.0, 1.2, "crateAmmo");
    this.addCrate(-10.8, 0.65, -39.0, 1.1, "crateUtility");
    this.addVerticalPipe(-15.0, -31.0);
    this.addVerticalPipe(15.0, -31.0);
    this.addVerticalPipe(-15.0, -37.0);
    this.addVerticalPipe(15.0, -37.0);
  }

  buildIndustrialDetails() {
    for (const x of [-15.8, 15.8]) {
      for (const z of [22, 16, 6, -6, -19, -29, -38]) {
        this.addVerticalPipe(x, z);
        this.addWallLightFixture(x, 3.1, z);
      }
    }

    for (let z = 23; z >= -41; z -= 3) {
      this.box(`cable-left-${z}`, [-5.1, 5.0, z], [0.14, 0.14, 2.2], "cable", false);
      this.box(`cable-right-${z}`, [5.1, 5.0, z], [0.14, 0.14, 2.2], "cable", false);
    }

    for (const z of [17.0, 5.9, -5.6, -22.6]) {
      this.addWallPanel(-16.7, 2.7, z, "redPanel");
      this.addWallPanel(16.7, 2.7, z, "redPanel");
    }
  }

  buildLighting() {
    const cold = [0.55, 0.72, 0.88];
    const neutral = [0.82, 0.88, 0.92];
    const amber = [1.0, 0.53, 0.19];
    const red = [1.0, 0.16, 0.06];

    for (let z = 24; z >= -40; z -= 4) {
      this.lights.push({ position: [0, 4.9, z], color: z < -20 ? neutral : cold, intensity: 1.9, radius: 7.0, pulse: false });
    }

    for (const [x, z, color] of [
      [-9.5, 11.2, amber], [9.5, 11.2, cold],
      [-9.5, 0.2, warmish([0.45, 0.75, 0.95])], [9.5, 0.2, neutral],
      [-7.5, -13.4, cold], [7.5, -13.4, cold]
    ]) {
      this.lights.push({ position: [x, 3.3, z], color, intensity: 2.1, radius: 6.2, pulse: false });
    }

    for (const z of [-26.0, -32.0, -38.0]) {
      this.lights.push({ position: [0, 4.1, z], color: z === -32 ? amber : red, intensity: 2.5, radius: 7.5, pulse: z !== -32 });
    }
  }

  buildEnemies() {
    this.enemySpawns.push(
      [-8.6, 0.0, 19.0],
      [8.7, 0.0, 4.2],
      [-2.1, 0.0, -4.0],
      [2.0, 0.0, -12.2],
      [-8.5, 0.0, -20.0],
      [9.0, 0.0, -26.2],
      [-7.7, 0.0, -36.4]
    );
  }

  segmentWall(x, minZ, maxZ, openings, name) {
    let cursor = minZ;
    const sorted = [...openings].sort((a, b) => a.center - b.center);

    for (const opening of sorted) {
      const start = opening.center - opening.width / 2;
      const end = opening.center + opening.width / 2;
      if (start > cursor) {
        this.box(`${name}-${cursor.toFixed(1)}`, [x, 3, (cursor + start) / 2], [0.42, 6, start - cursor], "steelWall");
      }
      cursor = Math.max(cursor, end);
    }

    if (cursor < maxZ) {
      this.box(`${name}-end`, [x, 3, (cursor + maxZ) / 2], [0.42, 6, maxZ - cursor], "steelWall");
    }
  }

  addDoorway(x, z, label) {
    this.box(`door-frame-a-${label}`, [x, 2.5, z - 1.7], [0.20, 5.0, 0.22], "metalDark", false);
    this.box(`door-frame-b-${label}`, [x, 2.5, z + 1.7], [0.20, 5.0, 0.22], "metalDark", false);
    this.box(`door-lintel-${label}`, [x, 5.0, z], [0.20, 0.22, 3.65], "metal", false);
  }

  addSlidingDoor(x, z, label) {
    this.box(`door-panel-${label}`, [x, 2.2, z], [0.12, 4.25, 2.75], "door", false);
    this.box(`door-status-${label}`, [x + (x < 0 ? 0.12 : -0.12), 4.35, z], [0.07, 0.12, 0.35], "signRed", false, [0.28, 0.01, 0.01]);
  }

  addEndDoor(x, z) {
    this.box("final-door-left", [-1.9, 2.3, z], [3.2, 4.6, 0.24], "door");
    this.box("final-door-right", [1.9, 2.3, z], [3.2, 4.6, 0.24], "door");
    this.box("final-door-status", [0, 4.6, z - 0.15], [0.55, 0.15, 0.10], "signRed", false, [0.28, 0.01, 0.01]);
  }

  addSecurityGate(x, z) {
    this.box("gate-left", [-1.85, 2.4, z], [0.18, 4.8, 0.18], "warningDark", false);
    this.box("gate-right", [1.85, 2.4, z], [0.18, 4.8, 0.18], "warningDark", false);
    this.box("gate-top", [0, 4.72, z], [3.85, 0.18, 0.18], "warningDark", false);
  }

  addRack(x, z, height) {
    this.box(`rack-${x}-${z}`, [x, height / 2, z], [1.15, height, 0.6], "blackMetal");
    for (const y of [0.6, 1.25, 1.9]) {
      this.box(`rack-light-${x}-${z}-${y}`, [x, y, z - 0.33], [0.16, 0.05, 0.05], "screenGreen", false, [0.01, 0.15, 0.05]);
    }
  }

  addServerRack(x, z) {
    this.box(`server-${x}-${z}`, [x, 1.6, z], [1.0, 3.2, 0.82], "blackMetal");
    for (let i = 0; i < 6; i += 1) {
      this.box(`server-led-${x}-${z}-${i}`, [x, 0.55 + i * 0.44, z - 0.45], [0.10, 0.05, 0.05], i % 2 ? "screenBlue" : "screenGreen", false);
    }
  }

  addWorkbench(x, y, z) {
    this.box(`workbench-${x}-${z}`, [x, y, z], [2.7, 0.18, 0.8], "metal", false);
    this.box(`workbench-back-${x}-${z}`, [x, y + 0.8, z + 0.28], [2.6, 1.1, 0.10], "blackMetal", false);
    this.box(`workbench-screen-${x}-${z}`, [x, y + 0.86, z + 0.20], [1.55, 0.68, 0.06], "screen", false, [0.01, 0.08, 0.11]);
  }

  addDesk(x, y, z) {
    this.box(`desk-${x}-${z}`, [x, y, z], [2.2, 1.15, 0.82], "metalDark");
    this.box(`desk-monitor-${x}-${z}`, [x, y + 0.72, z - 0.33], [1.45, 0.74, 0.07], "screen", false, [0.01, 0.08, 0.11]);
  }

  addBunk(x, z) {
    this.box(`bunk-bed-${x}-${z}`, [x, 0.68, z], [2.7, 0.22, 1.0], "bed", false);
    this.box(`bunk-head-${x}-${z}`, [x, 1.30, z + 0.42], [2.7, 1.15, 0.10], "blackMetal", false);
    this.box(`bunk-leg-a-${x}-${z}`, [x - 1.15, 0.32, z], [0.12, 0.64, 0.12], "metal", false);
    this.box(`bunk-leg-b-${x}-${z}`, [x + 1.15, 0.32, z], [0.12, 0.64, 0.12], "metal", false);
  }

  addLocker(x, z, height) {
    this.box(`locker-${x}-${z}`, [x, height / 2, z], [0.74, height, 0.58], "locker");
    this.box(`locker-handle-${x}-${z}`, [x + 0.16, height * 0.53, z - 0.31], [0.06, 0.09, 0.06], "warning", false);
  }

  addCrate(x, y, z, size, material) {
    this.box(`crate-${x}-${z}`, [x, y, z], [size, size, size], material);
    this.box(`crate-band-a-${x}-${z}`, [x, y, z - size / 2 - 0.02], [size + 0.03, 0.06, 0.06], "warning", false);
    this.box(`crate-band-b-${x}-${z}`, [x, y, z + size / 2 + 0.02], [size + 0.03, 0.06, 0.06], "warning", false);
  }

  addLabBench(x, y, z) {
    this.box(`labbench-${x}-${z}`, [x, y, z], [3.0, 0.18, 0.90], "metal", false);
    this.box(`labscreen-${x}-${z}`, [x, y + 0.72, z - 0.36], [1.7, 0.72, 0.06], "screenBlue", false);
    this.addCylinderProp(x - 0.70, 0.48, z, 0.12, 0.65, "glass");
    this.addCylinderProp(x + 0.30, 0.48, z, 0.12, 0.65, "glass");
  }

  addMachine(x, y, z) {
    this.box(`machine-${x}-${z}`, [x, y, z], [1.7, 2.8, 1.4], "machine");
    this.box(`machine-panel-${x}-${z}`, [x, y + 0.2, z - 0.73], [0.72, 0.75, 0.06], "screen", false, [0.01, 0.08, 0.11]);
  }

  addMapTable(x, y, z) {
    this.box("map-table", [x, y, z], [6.3, 0.18, 2.7], "metal", false);
    this.box("map-surface", [x, y + 0.12, z], [5.6, 0.04, 2.1], "screenWall", false, [0.01, 0.07, 0.09]);
  }

  addScreenWall(x, y, z, width, height) {
    this.box("screen-wall", [x, y, z], [width, height, 0.16], "screenWall", false, [0.01, 0.06, 0.08]);
    this.box("screen-main", [x, y, z + 0.09], [width - 0.5, height - 0.4, 0.06], "screen", false, [0.01, 0.08, 0.12]);
  }

  addGenerator(x, z) {
    this.box("generator-base", [x, 0.6, z], [5.8, 1.2, 3.6], "metalDark");
    this.box("generator-body", [x, 2.05, z], [4.3, 2.7, 2.5], "generator");
    this.box("generator-panel", [x, 2.1, z - 1.3], [1.25, 1.2, 0.08], "signAmber", false, [0.18, 0.05, 0.01]);
    this.addCylinderProp(x - 1.65, 2.0, z, 0.26, 2.5, "pipe");
    this.addCylinderProp(x + 1.65, 2.0, z, 0.26, 2.5, "pipe");
  }

  addVerticalPipe(x, z) {
    this.addCylinderProp(x, 2.8, z, 0.11, 5.6, "pipe");
  }

  addWallLightFixture(x, y, z) {
    this.box(`wall-fixture-${x}-${z}`, [x, y, z], [0.10, 0.35, 0.70], "fixture", false);
  }

  addWallPanel(x, y, z, material) {
    this.box(`wall-panel-${x}-${z}`, [x, y, z], [0.08, 1.15, 1.1], material, false);
  }

  addSign(x, y, z, width, height, material) {
    this.box(`sign-${x}-${z}`, [x, y, z], [width, height, 0.08], material, false);
  }

  addCylinderProp(x, y, z, radius, height, material = "metal") {
    this.objects.push({
      name: `cylinder-${x}-${y}-${z}-${height}`,
      geometry: "cylinder",
      position: [x, y, z],
      scale: [radius, height, radius],
      rotation: [0, 0, 0],
      material,
      solid: false,
      emissive: [0, 0, 0]
    });
  }

  box(name, position, scale, material = "metal", solid = true, emissive = [0, 0, 0]) {
    this.objects.push({
      name,
      geometry: "box",
      position,
      scale,
      rotation: [0, 0, 0],
      material,
      solid,
      emissive
    });
  }
}

function warmish(color) {
  return color;
}
