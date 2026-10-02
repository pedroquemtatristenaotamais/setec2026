import { Player } from "./player/Player.js";
import { Level } from "./world/Level.js";
import { AK47 } from "./weapons/AK47.js";
import { ZombiePNG } from "./enemy/ZombiePNG.js";
import { Knife } from "./weapons/Knife.js";
import { AudioManager } from "./audio/AudioManager.js";

const MAX_LIGHTS = 8;
const SHADOW_SIZE = 1024;

const BILLBOARD_VERTEX_SHADER = `#version 100
attribute vec3 aPosition;
attribute vec2 aUV;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
varying vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
}
`;

const BILLBOARD_FRAGMENT_SHADER = `#version 100
precision mediump float;
uniform sampler2D uTexture;
uniform float uOpacity;
uniform float uHitFlash;
varying vec2 vUV;
void main() {
  vec4 texel = texture2D(uTexture, vUV);
  if (texel.a < 0.08) discard;
  vec3 color = texel.rgb;
  if (uHitFlash > 0.0) color = mix(color, vec3(1.0, 0.12, 0.03), uHitFlash * 0.65);
  gl_FragColor = vec4(color, texel.a * uOpacity);
}
`;

const VERTEX_SHADER_SOURCE = `#version 100
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform mat4 uLightViewProjection;
uniform mat3 uNormalMatrix;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUV;
varying vec4 vShadowCoord;

void main() {
  vec4 worldPosition = uModel * vec4(aPosition, 1.0);
  vWorldPosition = worldPosition.xyz;
  vNormal = normalize(uNormalMatrix * aNormal);
  vUV = aUV;
  vShadowCoord = uLightViewProjection * worldPosition;
  gl_Position = uProjection * uView * worldPosition;
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 100
precision mediump float;

uniform vec3 uColor;
uniform vec3 uLightDirection;
uniform vec3 uAmbient;
uniform vec3 uCameraPosition;
uniform vec3 uEmissive;
uniform vec3 uPointPositions[8];
uniform vec3 uPointColors[8];
uniform vec2 uPointParams[8];
uniform int uPointLightCount;
uniform int uMaterialId;
uniform float uTime;
uniform sampler2D uTexture;
uniform int uUseTexture;
uniform sampler2D uShadowMap;
uniform float uShadowTexelSize;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUV;
varying vec4 vShadowCoord;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float unpackDepth(vec4 rgba) {
  const vec4 bitShift = vec4(1.0, 1.0 / 256.0, 1.0 / 65536.0, 1.0 / 16777216.0);
  return dot(rgba, bitShift);
}

float shadowVisibility() {
  vec3 projected = vShadowCoord.xyz / max(vShadowCoord.w, 0.0001);
  projected = projected * 0.5 + 0.5;

  if (projected.x <= 0.0 || projected.x >= 1.0 || projected.y <= 0.0 || projected.y >= 1.0 || projected.z <= 0.0 || projected.z >= 1.0) {
    return 1.0;
  }

  float bias = 0.0018;
  float result = 0.0;

  for (int x = -1; x <= 1; x += 2) {
    for (int y = -1; y <= 1; y += 2) {
      vec2 offset = vec2(float(x), float(y)) * uShadowTexelSize;
      float sampledDepth = unpackDepth(texture2D(uShadowMap, projected.xy + offset));
      result += step(projected.z - bias, sampledDepth);
    }
  }

  return result * 0.25;
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 base = uColor;

  if (uUseTexture == 1) {
    base *= texture2D(uTexture, vUV).rgb;
  }

  // Materiais do complexo usando coordenadas do mundo, sem padrões verticais presos ao UV.
  if (uMaterialId == 1) {
    float grain = noise2(vWorldPosition.xz * 2.1);
    base *= mix(0.80, 1.05, grain);
  } else if (uMaterialId == 2) {
    float panel = 0.95 + 0.05 * noise2(vWorldPosition.xy * 2.0);
    float seamX = 1.0 - step(0.96, fract(abs(vWorldPosition.x) * 1.15));
    base *= panel * (0.84 + 0.16 * seamX);
  } else if (uMaterialId == 3) {
    float tile = noise2(vWorldPosition.xz * 1.1);
    base *= mix(0.82, 1.03, tile);
  } else if (uMaterialId == 4) {
    float brushed = 0.94 + 0.06 * noise2(vWorldPosition.yz * 1.6);
    base *= brushed;
  } else if (uMaterialId == 5) {
    float stripe = step(0.50, fract((vWorldPosition.x + vWorldPosition.z) * 0.20));
    base *= mix(0.37, 1.0, stripe);
  } else if (uMaterialId == 6) {
    float screenNoise = 0.88 + 0.12 * noise2(vWorldPosition.xy * 2.5);
    float scan = 0.97 + 0.03 * sin(vWorldPosition.y * 25.0 + uTime * 1.5);
    base *= screenNoise * scan;
  } else if (uMaterialId == 7) {
    base *= 0.90 + 0.10 * noise2(vWorldPosition.xz * 1.8);
  } else if (uMaterialId == 8) {
    base *= 0.94 + 0.06 * noise2(vWorldPosition.xy * 5.0);
  } else if (uMaterialId == 9) {
    base *= 0.65 + 0.35 * sin(uTime * 38.0);
  }

  vec3 lighting = uAmbient;
  vec3 sunDirection = normalize(-uLightDirection);
  float directional = max(dot(normal, sunDirection), 0.0);
  float shadow = 1.0;
  lighting += vec3(directional * 0.48 * shadow);

  for (int i = 0; i < 8; i++) {
    if (i >= uPointLightCount) break;
    vec3 toLight = uPointPositions[i] - vWorldPosition;
    float distanceToLight = length(toLight);
    vec3 lightDir = normalize(toLight);
    float radius = max(0.01, uPointParams[i].y);
    float attenuation = 1.0 - smoothstep(0.0, radius, distanceToLight);
    attenuation *= attenuation;
    float diffuse = max(dot(normal, lightDir), 0.0);
    lighting += uPointColors[i] * diffuse * attenuation * uPointParams[i].x;
    vec3 pointHalf = normalize(lightDir + normalize(uCameraPosition - vWorldPosition));
    float pointSpec = pow(max(dot(normal, pointHalf), 0.0), 34.0) * attenuation * 0.20;
    lighting += uPointColors[i] * pointSpec * uPointParams[i].x;
  }

  vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
  vec3 halfDir = normalize(sunDirection + viewDir);
  float specular = pow(max(dot(normal, halfDir), 0.0), 48.0) * 0.12;

  vec3 litColor = base * lighting;
  litColor += vec3(specular);
  litColor += uEmissive;

  float fog = smoothstep(45.0, 90.0, length(vWorldPosition - uCameraPosition)) * 0.20;
  litColor = mix(litColor, vec3(0.025, 0.031, 0.035), fog);
  litColor = max(litColor, vec3(0.018));
  litColor = pow(litColor, vec3(0.91));

  gl_FragColor = vec4(litColor, 1.0);
}
`;

const SHADOW_VERTEX_SHADER = `#version 100
attribute vec3 aPosition;
uniform mat4 uModel;
uniform mat4 uLightViewProjection;
void main() {
  gl_Position = uLightViewProjection * uModel * vec4(aPosition, 1.0);
}
`;

const SHADOW_FRAGMENT_SHADER = `#version 100
precision mediump float;
vec4 packDepth(const in float depth) {
  const vec4 bitShift = vec4(16777216.0, 65536.0, 256.0, 1.0);
  const vec4 bitMask = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
  vec4 comp = fract(depth * bitShift);
  comp -= comp.xxyz * bitMask;
  return comp;
}
void main() {
  gl_FragColor = packDepth(gl_FragCoord.z);
}
`;

const MATERIALS = {
  floor: { color: [0.17, 0.19, 0.19], id: 3 },
  floorPanel: { color: [0.13, 0.15, 0.15], id: 3 },
  concrete: { color: [0.24, 0.27, 0.28], id: 1 },
  steelWall: { color: [0.20, 0.23, 0.24], id: 2 },
  ceiling: { color: [0.10, 0.12, 0.13], id: 2 },
  metal: { color: [0.34, 0.36, 0.35], id: 4 },
  metalDark: { color: [0.13, 0.15, 0.16], id: 4 },
  blackMetal: { color: [0.07, 0.08, 0.085], id: 4 },
  locker: { color: [0.18, 0.22, 0.23], id: 4 },
  machine: { color: [0.22, 0.25, 0.25], id: 4 },
  generator: { color: [0.25, 0.27, 0.25], id: 4 },
  cable: { color: [0.03, 0.035, 0.04], id: 4 },
  pipe: { color: [0.28, 0.31, 0.31], id: 4 },
  wood: { color: [0.35, 0.20, 0.09], id: 7 },
  bed: { color: [0.17, 0.20, 0.22], id: 4 },
  crateUtility: { color: [0.31, 0.27, 0.18], id: 4 },
  crateAmmo: { color: [0.19, 0.24, 0.17], id: 4 },
  crateMedical: { color: [0.52, 0.54, 0.50], id: 4 },
  crateLab: { color: [0.22, 0.27, 0.29], id: 4 },
  warning: { color: [0.72, 0.43, 0.06], id: 5 },
  warningDark: { color: [0.31, 0.19, 0.05], id: 5 },
  screen: { color: [0.09, 0.35, 0.45], id: 6, emissive: [0.01, 0.06, 0.08] },
  screenBlue: { color: [0.06, 0.27, 0.56], id: 6, emissive: [0.01, 0.05, 0.16] },
  screenGreen: { color: [0.07, 0.48, 0.21], id: 6, emissive: [0.01, 0.12, 0.045] },
  screenRed: { color: [0.55, 0.07, 0.04], id: 6, emissive: [0.24, 0.01, 0.006] },
  screenCyan: { color: [0.05, 0.55, 0.62], id: 6, emissive: [0.01, 0.13, 0.17] },
  screenWall: { color: [0.04, 0.12, 0.16], id: 6 },
  fixture: { color: [0.70, 0.76, 0.74], id: 6, emissive: [0.08, 0.10, 0.10] },
  redPanel: { color: [0.45, 0.06, 0.045], id: 5, emissive: [0.08, 0.005, 0.002] },
  signRed: { color: [0.70, 0.09, 0.05], id: 6, emissive: [0.24, 0.012, 0.006] },
  signAmber: { color: [0.84, 0.37, 0.04], id: 6, emissive: [0.18, 0.04, 0.005] },
  signBlue: { color: [0.07, 0.33, 0.68], id: 6, emissive: [0.015, 0.05, 0.12] },
  signCyan: { color: [0.06, 0.58, 0.65], id: 6, emissive: [0.012, 0.14, 0.18] },
  glass: { color: [0.47, 0.60, 0.64], id: 4 },
  door: { color: [0.25, 0.28, 0.29], id: 2 },
  muzzleFlash: { color: [1.0, 0.45, 0.07], id: 9, emissive: [1.35, 0.35, 0.02] },
  tracer: { color: [1.0, 0.50, 0.08], id: 9, emissive: [0.95, 0.13, 0.01] },
  spark: { color: [1.0, 0.68, 0.20], id: 9, emissive: [0.70, 0.22, 0.02] },
  droneBody: { color: [0.13, 0.16, 0.17], id: 4 },
  droneMetal: { color: [0.27, 0.30, 0.30], id: 4 },
  droneEye: { color: [0.65, 0.045, 0.03], id: 6, emissive: [0.38, 0.008, 0.004] },
  hitFlash: { color: [1.0, 0.75, 0.42], id: 9, emissive: [0.64, 0.20, 0.035] },
  model: { color: [1, 1, 1], id: 0 },
};

export class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.gl = null;
    this.program = null;
    this.shadowProgram = null;
    this.shadow = null;
    this.geometries = {};
    this.level = new Level();
    this.levelData = null;
    this.player = null;
    this.weapon = new AK47();
    this.audio = new AudioManager();
    this.effects = [];
    this.running = false;
    this.sessionActive = false;
    this.time = 0;
    this.lastTime = 0;
    this.rafId = 0;
    this.flashlight = true;
    this.lastZone = "";
    this.currentWeapon = "ak";
    this.knife = new Knife();
    this.zombies = [];
    this.zombieTexture = null;
    this.billboardProgram = null;

    this.handleCanvasClick = () => this.requestPointerLock();
    this.handlePointerLockChange = () => {
      const locked = document.pointerLockElement === this.canvas;
      this.player?.setEnabled(this.sessionActive && !this.player.isDead());
      this.callbacks.onPointerLock?.(locked);
    };
    this.handleMouseDown = (event) => {
      if (event.button !== 0 || !this.sessionActive || !this.player || this.player.isDead()) return;
      this.audio.resume();
      if (this.currentWeapon === "knife") this.attackKnife();
      else { this.weapon.triggerHeld = true; this.fireOnce(); }
    };
    this.handleMouseUp = (event) => {
      if (event.button === 0) this.weapon.triggerHeld = false;
    };
    this.handleKeyDown = (event) => {
      if (!this.sessionActive) return;
      if (event.code === "KeyR" && this.currentWeapon === "ak") {
        event.preventDefault();
        if (this.weapon.startReload()) {
          this.audio.playReload();
          this.callbacks.onStatus?.("RECARREGANDO");
        }
      } else if (event.code === "KeyF") {
        event.preventDefault();
        this.flashlight = !this.flashlight;
        this.callbacks.onStatus?.(this.flashlight ? "LANTERNA: ATIVA" : "LANTERNA: DESATIVADA");
      } else if (event.code === "Digit1") {
        event.preventDefault();
        this.currentWeapon = "ak";
        this.callbacks.onWeaponChange?.("ak");
      } else if (event.code === "Digit3") {
        event.preventDefault();
        this.currentWeapon = "knife";
        this.weapon.triggerHeld = false;
        this.callbacks.onWeaponChange?.("knife");
      } else if (event.code === "KeyQ") {
        event.preventDefault();
        this.currentWeapon = this.currentWeapon === "ak" ? "knife" : "ak";
        this.weapon.triggerHeld = false;
        this.callbacks.onWeaponChange?.(this.currentWeapon);
      }
    };
    this.handleWindowBlur = () => { this.weapon.triggerHeld = false; };

    canvas.addEventListener("click", this.handleCanvasClick);
    canvas.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mouseup", this.handleMouseUp);
    window.addEventListener("keydown", this.handleKeyDown, { passive: false });
    window.addEventListener("blur", this.handleWindowBlur);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    this.resizeObserver = new ResizeObserver(() => this.resize());
  }

  async init() {
    this.gl = this.canvas.getContext("webgl", { antialias: true, alpha: false, depth: true, powerPreference: "high-performance" });
    if (!this.gl) throw new Error("Seu navegador não conseguiu inicializar WebGL.");

    this.program = this.createProgram(VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
    this.shadowProgram = null;
    this.billboardProgram = this.createProgram(BILLBOARD_VERTEX_SHADER, BILLBOARD_FRAGMENT_SHADER);
    this.createGeometries();
    this.cacheLocations();
    this.cacheBillboardLocations();
    this.configureContext();

    this.zombieTexture = await this.loadTexture("./assets/images/zombie.png");
    this.levelData = this.level.build();
    this.player = new Player({ spawn: this.levelData.spawn, speed: 4.8, runSpeed: 7.8 });
    this.player.attachCanvas(this.canvas);
    this.player.setCollisionObjects(this.levelData.objects);
    this.player.setEnabled(false);
    this.player.onFootstep = () => this.audio.playFootstep();
    this.player.onDamage = (amount) => this.callbacks.onDamage?.(amount);
    this.player.onDeath = () => {
      this.sessionActive = false;
      this.weapon.triggerHeld = false;
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      this.callbacks.onGameOver?.();
    };

    this.spawnZombies();
    this.resize();
    this.resizeObserver.observe(this.canvas);
  }

  startSession() {
    this.sessionActive = true;
    this.weapon = new AK47();
    this.weapon.triggerHeld = false;
    this.knife = new Knife();
    this.currentWeapon = "ak";
    this.flashlight = true;
    this.player.reset();
    this.player.setEnabled(true);
    this.spawnZombies();
    this.effects.length = 0;
    this.callbacks.onState?.(this.getHUDState());
    this.requestPointerLock();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame((time) => this.loop(time));
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.player?.destroy();
    this.canvas.removeEventListener("click", this.handleCanvasClick);
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mouseup", this.handleMouseUp);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("blur", this.handleWindowBlur);
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  requestPointerLock() {
    if (!this.canvas.requestPointerLock) return;
    this.audio.resume();
    this.canvas.requestPointerLock();
  }

  loop(time) {
    if (!this.running) return;
    const deltaTime = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    this.time += deltaTime;
    this.update(deltaTime);
    this.render();
    this.rafId = requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(deltaTime) {
    if (!this.player) return;
    if (!this.sessionActive) return;

    this.player.update(deltaTime);
    const weaponEvents = this.weapon.update(deltaTime, this.player.moveAmount > 0, this.player.isSprinting);
    if (weaponEvents.reloaded) {
      this.audio.playReloadComplete();
      this.callbacks.onStatus?.("CARREGADOR INSERIDO");
    }
    if (this.currentWeapon === "ak") {
      if (this.weapon.triggerHeld && this.player.enabled) this.fireOnce();
    } else {
      this.knife.update(deltaTime);
    }

    for (const zombie of this.zombies) {
      zombie.update(deltaTime, this.player, (from, to) => this.hasLineOfSight(from, to));
    }

    this.effects = this.effects.filter((effect) => {
      effect.ttl -= deltaTime;
      if (effect.kind === "spark") {
        effect.velocity[1] -= 8.5 * deltaTime;
        effect.position[0] += effect.velocity[0] * deltaTime;
        effect.position[1] += effect.velocity[1] * deltaTime;
        effect.position[2] += effect.velocity[2] * deltaTime;
      }
      return effect.ttl > 0;
    });

    const zone = this.level.getZoneName(this.player.position);
    if (zone !== this.lastZone) {
      this.lastZone = zone;
      this.callbacks.onZone?.(zone);
    }

    this.callbacks.onState?.(this.getHUDState());
  }

  getHUDState() {
    return {
      health: this.player?.health ?? 100,
      maxHealth: this.player?.maxHealth ?? 100,
      ammo: this.weapon.ammo,
      magazineSize: this.weapon.magazineSize,
      spareMagazines: this.weapon.spareMagazines,
      reserveRounds: this.weapon.spareMagazines * this.weapon.magazineSize,
      reloading: this.currentWeapon === "ak" && this.weapon.reloadTimer > 0,
      knifeAttacking: this.knife.isAttacking(),
      weaponType: this.currentWeapon,
      weaponName: this.currentWeapon === "ak" ? "AK-47" : "FACA",
      flashlight: this.flashlight,
      zone: this.level.getZoneName(this.player?.position || this.levelData.spawn),
      aliveZombies: this.zombies.filter((zombie) => !zombie.dead).length
    };
  }

  attackKnife() {
    if (!this.player?.enabled || this.player.isDead() || this.currentWeapon !== "knife") return;
    const attack = this.knife.tryAttack();
    if (!attack.attacked) return;
    this.callbacks.onKnifeAttack?.();
    const origin = [...this.player.camera.position];
    const target = this.player.camera.getLookTarget(attack.range);
    const direction = normalize3(subtract3(target, origin));
    const hit = this.raycastZombies(origin, direction, attack.range);
    if (hit) {
      const killed = hit.zombie.takeDamage(55, hit.headshot);
      this.callbacks.onHit?.(killed);
      if (hit.headshot) { this.audio.playHeadshot(); this.callbacks.onHeadshot?.(killed); } else this.audio.playHit();
      this.spawnImpact(hit.point, true);
    }
  }

  fireOnce() {
    if (!this.player?.enabled || this.player.isDead() || this.currentWeapon !== "ak") return;
    const result = this.weapon.tryFire();
    if (!result.fired) {
      if (result.reason === "empty" && this.weapon.spareMagazines > 0 && this.weapon.startReload()) {
        this.audio.playReload();
        this.callbacks.onStatus?.("SEM MUNIÇÃO — RECARREGANDO");
      } else if (result.reason === "empty") {
        this.audio.playDryFire();
        this.callbacks.onStatus?.("SEM MUNIÇÃO");
      }
      return;
    }

    this.audio.playGunshot();
    this.callbacks.onShot?.();

    const camera = this.player.camera;
    const muzzle = this.getWeaponMuzzleWorld();
    const aimTarget = camera.getLookTarget(90);
    let direction = normalize3(subtract3(aimTarget, muzzle));
    direction = normalize3([
      direction[0] + (Math.random() - 0.5) * result.spread,
      direction[1] + (Math.random() - 0.5) * result.spread,
      direction[2] + (Math.random() - 0.5) * result.spread
    ]);

    const maxDistance = 85;
    const zombieHit = this.raycastZombies(muzzle, direction, maxDistance);
    const worldHit = this.raycastWorld(muzzle, direction, maxDistance);
    let hitPoint = add3(muzzle, multiply3(direction, maxDistance));

    if (zombieHit && (!worldHit || zombieHit.distance < worldHit.distance)) {
      hitPoint = zombieHit.point;
      const damage = zombieHit.headshot ? 100 : result.damage;
      const killed = zombieHit.zombie.takeDamage(damage, zombieHit.headshot);
      this.callbacks.onHit?.(killed);
      if (zombieHit.headshot) {
        this.audio.playHeadshot();
        this.callbacks.onHeadshot?.(killed);
      } else {
        this.audio.playHit();
      }
      this.spawnImpact(hitPoint, true);
    } else if (worldHit) {
      hitPoint = worldHit.point;
      this.audio.playEnemyHit();
      this.spawnImpact(hitPoint, false);
    }

    this.effects.push({ kind: "tracer", from: [...muzzle], to: [...hitPoint], ttl: 0.030, duration: 0.030, material: "tracer" });
    this.spawnMuzzleFlash(muzzle);
    this.spawnShellEject(muzzle);
    this.callbacks.onMuzzleFlash?.();
    this.callbacks.onState?.(this.getHUDState());
  }

  getWeaponMuzzleWorld() {
    const camera = this.player.camera;
    const basis = getCameraBasis(camera);
    return [
      camera.position[0] + basis.forward[0] * 0.92 + basis.right[0] * 0.38 + basis.up[0] * -0.20,
      camera.position[1] + basis.forward[1] * 0.92 + basis.right[1] * 0.38 + basis.up[1] * -0.20,
      camera.position[2] + basis.forward[2] * 0.92 + basis.right[2] * 0.38 + basis.up[2] * -0.20
    ];
  }

  spawnMuzzleFlash(position) {
    this.effects.push({ kind: "muzzle", position: [...position], ttl: 0.075, scale: 0.16, material: "muzzleFlash" });
  }

  spawnShellEject(position) {
    const basis = getCameraBasis(this.player.camera);
    this.effects.push({
      kind: "spark",
      position: add3(position, multiply3(basis.right, 0.08)),
      velocity: [basis.right[0] * 1.2 + 0.12, 0.9, basis.right[2] * 1.2 + 0.05],
      ttl: 0.30,
      scale: 0.032,
      material: "spark"
    });
  }

  spawnImpact(position, hitEnemy) {
    for (let i = 0; i < (hitEnemy ? 5 : 7); i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.0;
      this.effects.push({
        kind: "spark",
        position: [...position],
        velocity: [Math.cos(angle) * speed, 0.45 + Math.random() * 1.3, Math.sin(angle) * speed],
        ttl: 0.18 + Math.random() * 0.18,
        scale: 0.04 + Math.random() * 0.025,
        material: hitEnemy ? "hitFlash" : "spark"
      });
    }
  }

  raycastZombies(origin, direction, maxDistance) {
    let closest = null;
    for (const zombie of this.zombies) {
      if (zombie.dead) continue;
      const regions = zombie.getHitRegions();
      const candidates = [];
      const headHit = raySphere(origin, direction, regions.head, regions.headRadius);
      const torsoHit = raySphere(origin, direction, regions.torso, regions.torsoRadius);
      const bodyHit = raySphere(origin, direction, zombie.position, regions.bodyRadius);
      if (headHit && headHit.distance <= maxDistance) candidates.push({ ...headHit, headshot: true });
      if (torsoHit && torsoHit.distance <= maxDistance) candidates.push({ ...torsoHit, headshot: false });
      if (bodyHit && bodyHit.distance <= maxDistance) candidates.push({ ...bodyHit, headshot: false });
      if (!candidates.length) continue;
      candidates.sort((a, b) => a.distance - b.distance);
      const hit = candidates[0];
      if (!closest || hit.distance < closest.distance) closest = { zombie, ...hit };
    }
    return closest;
  }

  raycastWorld(origin, direction, maxDistance) {
    let closest = null;
    for (const object of this.levelData.objects) {
      if (!object.solid || object.name === "floor" || object.name === "ceiling" || object.geometry !== "box") continue;
      const hit = rayAABB(origin, direction, object);
      if (!hit || hit.distance > maxDistance || hit.distance < 0.08) continue;
      if (!closest || hit.distance < closest.distance) closest = hit;
    }
    return closest;
  }

  hasLineOfSight(from, to) {
    const origin = [from[0], from[1] + 1.0, from[2]];
    const target = [to[0], to[1] + 1.35, to[2]];
    const delta = subtract3(target, origin);
    const distance = length3(delta);
    if (distance < 0.001) return true;
    return !this.raycastWorld(origin, multiply3(delta, 1 / distance), distance - 0.45);
  }

  enemyCollidesAt(x, z, radius) {
    for (const object of this.levelData.objects) {
      if (!object.solid || object.name === "floor" || object.name === "ceiling") continue;
      const [ox, oy, oz] = object.position;
      const [sx, sy, sz] = object.scale;
      if (x > ox - sx / 2 - radius && x < ox + sx / 2 + radius && z > oz - sz / 2 - radius && z < oz + sz / 2 + radius && oy + sy / 2 > 0) return true;
    }
    return false;
  }

  spawnZombies() {
    this.zombies.length = 0;
    for (let i = 0; i < this.levelData.enemySpawns.length; i += 1) {
      this.zombies.push(new ZombiePNG(
        this.levelData.enemySpawns[i], i,
        (x, z, radius) => this.enemyCollidesAt(x, z, radius),
        () => { this.audio.playAlert(); this.callbacks.onAlert?.(); }
      ));
    }
  }

  render() {
    if (!this.gl || !this.player || !this.levelData) return;

    const gl = this.gl;
    const camera = this.player.camera;
    const aspect = gl.drawingBufferWidth / Math.max(gl.drawingBufferHeight, 1);
    const projection = mat4Perspective(degToRad(camera.fovY), aspect, 0.035, camera.far);
    const view = mat4LookAt(camera.position, camera.getLookTarget(1), camera.up);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.018, 0.023, 0.026, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);

    gl.uniform3fv(this.uniforms.cameraPosition, new Float32Array(camera.position));
    gl.uniformMatrix4fv(this.uniforms.view, false, view);
    gl.uniformMatrix4fv(this.uniforms.projection, false, projection);
    gl.uniform1f(this.uniforms.time, this.time);

    const lights = this.getActiveLights(camera.position);
    const pointPositions = [];
    const pointColors = [];
    const pointParams = [];
    for (const light of lights) { pointPositions.push(...light.position); pointColors.push(...light.color); pointParams.push(light.intensity, light.radius); }
    while (pointPositions.length < MAX_LIGHTS * 3) pointPositions.push(0, 0, 0);
    while (pointColors.length < MAX_LIGHTS * 3) pointColors.push(0, 0, 0);
    while (pointParams.length < MAX_LIGHTS * 2) pointParams.push(0, 1);
    gl.uniform3fv(this.uniforms.pointPositions, new Float32Array(pointPositions));
    gl.uniform3fv(this.uniforms.pointColors, new Float32Array(pointColors));
    gl.uniform2fv(this.uniforms.pointParams, new Float32Array(pointParams));
    gl.uniform1i(this.uniforms.pointLightCount, lights.length);
    gl.uniform3fv(this.uniforms.ambient, new Float32Array([0.31, 0.35, 0.36]));
    gl.uniform3fv(this.uniforms.lightDirection, new Float32Array([-0.32, -1.0, -0.24]));

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(true);

    for (const object of this.levelData.objects) this.drawObject(object, view, projection);
    this.drawZombies(view, projection, camera);

    for (const effect of this.effects) {
      if (effect.kind !== "muzzle") this.drawEffect(effect, view, projection);
    }

    if (this.weapon.muzzleFlashTimer > 0 && this.currentWeapon === "ak") {
      const muzzle = this.getWeaponMuzzleWorld();
      this.drawMuzzleFlashWorld(muzzle, view, projection);
    }
  }

  drawZombies(view, projection, camera) {
    const gl = this.gl;
    const g = this.geometries.flashQuad;
    if (!g || !this.zombieTexture || !this.billboardProgram) return;

    gl.useProgram(this.billboardProgram);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);

    gl.bindBuffer(gl.ARRAY_BUFFER, g.positionBuffer);
    gl.enableVertexAttribArray(this.billboardAttributes.position);
    gl.vertexAttribPointer(this.billboardAttributes.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.uvBuffer);
    gl.enableVertexAttribArray(this.billboardAttributes.uv);
    gl.vertexAttribPointer(this.billboardAttributes.uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.indexBuffer);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.zombieTexture);
    gl.uniform1i(this.billboardUniforms.texture, 0);
    gl.uniform1f(this.billboardUniforms.opacity, 1);
    gl.uniformMatrix4fv(this.billboardUniforms.view, false, view);
    gl.uniformMatrix4fv(this.billboardUniforms.projection, false, projection);

    const h = 2.35;
    const w = h * (325 / 535);
    for (const zombie of this.zombies) {
      if (zombie.dead) continue;
      const model = mat4FromTRS(
        [zombie.position[0], zombie.position[1] + h * 0.5, zombie.position[2]],
        [0, -camera.yaw, 0],
        [w, h, 1]
      );
      gl.uniformMatrix4fv(this.billboardUniforms.model, false, model);
      gl.uniform1f(this.billboardUniforms.hitFlash, zombie.hitFlash > 0 ? zombie.hitFlash / 0.10 : 0);
      gl.drawElements(gl.TRIANGLES, g.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(this.program);
  }

  renderShadowPass() {
    const gl = this.gl;
    const lightPosition = [18, 26, 18];
    const lightTarget = [0, 0, -10];
    const lightView = mat4LookAt(lightPosition, lightTarget, [0, 1, 0]);
    const lightProjection = mat4Ortho(-25, 25, -46, 42, 1.0, 70);
    this.shadow.lightViewProjection = mat4Multiply(lightProjection, lightView);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadow.framebuffer);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.shadowProgram);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);

    gl.uniformMatrix4fv(this.shadowUniforms.lightViewProjection, false, this.shadow.lightViewProjection);

    for (const object of this.levelData.objects) this.drawShadowObject(object);


    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.cullFace(gl.BACK);
  }

  drawShadowObject(object) {
    const geometry = this.geometries[object.geometry || "box"];
    if (!geometry) return;
    const model = object.modelMatrix || mat4FromTRS(object.position, object.rotation || [0, 0, 0], object.scale);
    this.drawShadowGeometry(geometry, model);
  }

  drawShadowGeometry(geometry, model) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.positionBuffer);
    gl.enableVertexAttribArray(this.shadowAttributes.position);
    gl.vertexAttribPointer(this.shadowAttributes.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indexBuffer);
    gl.uniformMatrix4fv(this.shadowUniforms.model, false, model);
    gl.drawElements(gl.TRIANGLES, geometry.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  drawObject(object, view, projection) {
    const gl = this.gl;
    const geometry = this.geometries[object.geometry || "box"];
    if (!geometry) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.positionBuffer);
    gl.enableVertexAttribArray(this.attributes.position);
    gl.vertexAttribPointer(this.attributes.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.normalBuffer);
    gl.enableVertexAttribArray(this.attributes.normal);
    gl.vertexAttribPointer(this.attributes.normal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.uvBuffer);
    gl.enableVertexAttribArray(this.attributes.uv);
    gl.vertexAttribPointer(this.attributes.uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indexBuffer);

    const model = object.modelMatrix || mat4FromTRS(object.position, object.rotation || [0, 0, 0], object.scale);
    this.applyMaterial(object.material || "metal");
    gl.uniform1i(this.uniforms.useTexture, 0);
    gl.uniformMatrix4fv(this.uniforms.model, false, model);
    gl.uniformMatrix3fv(this.uniforms.normalMatrix, false, mat3NormalFromMat4(model));
    gl.uniformMatrix4fv(this.uniforms.view, false, view);
    gl.uniformMatrix4fv(this.uniforms.projection, false, projection);
    gl.drawElements(gl.TRIANGLES, geometry.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  drawEffect(effect, view, projection) {
    if (effect.kind === "tracer") {
      const direction = normalize3(subtract3(effect.to, effect.from));
      const totalDistance = length3(subtract3(effect.to, effect.from));
      const progress = 1 - effect.ttl / effect.duration;
      const tip = add3(effect.from, multiply3(direction, totalDistance * progress));
      const trailDistance = Math.min(0.55, totalDistance * 0.04);
      const tail = add3(tip, multiply3(direction, -trailDistance));
      const model = mat4FromSegment(tail, tip, [0.0028, 0.0028, Math.max(0.008, trailDistance)]);
      this.drawObject({ geometry: "box", material: effect.material, modelMatrix: model }, view, projection);
      return;
    }

    this.drawObject({
      geometry: "box",
      position: effect.position,
      rotation: [this.time * 3.0, this.time * 2.0, 0],
      scale: [effect.scale, effect.scale, effect.scale],
      material: effect.material
    }, view, projection);
  }

  getActiveLights(cameraPosition) {
    const dynamic = this.levelData.lights.map((light, index) => ({
      ...light,
      intensity: light.pulse
        ? light.intensity * (0.62 + 0.38 * (0.5 + 0.5 * Math.sin(this.time * 13.0 + index * 1.31)))
        : light.intensity
    }));

    if (this.flashlight) {
      dynamic.push({ position: [...cameraPosition], color: [0.68, 0.82, 1.0], intensity: 2.8, radius: 10.0, pulse: false, priority: 5 });
    }

    if (this.weapon.muzzleFlashTimer > 0 && this.player) {
      const muzzle = this.getWeaponMuzzleWorld();
      const basis = getCameraBasis(this.player.camera);
      dynamic.push({ position: muzzle, color: [1.0, 0.62, 0.16], intensity: 16.0, radius: 5.6, pulse: false, priority: 80 });
      dynamic.push({ position: add3(muzzle, multiply3(basis.forward, 0.28)), color: [1.0, 0.82, 0.42], intensity: 7.0, radius: 2.6, pulse: false, priority: 79 });
    }

    dynamic.sort((a, b) => (b.priority || 0) - (a.priority || 0) || distanceSquared(a.position, cameraPosition) - distanceSquared(b.position, cameraPosition));
    return dynamic.slice(0, MAX_LIGHTS);
  }

  cacheBillboardLocations() {
    const gl = this.gl;
    this.billboardAttributes = {
      position: gl.getAttribLocation(this.billboardProgram, "aPosition"),
      uv: gl.getAttribLocation(this.billboardProgram, "aUV")
    };
    this.billboardUniforms = {
      model: gl.getUniformLocation(this.billboardProgram, "uModel"),
      view: gl.getUniformLocation(this.billboardProgram, "uView"),
      projection: gl.getUniformLocation(this.billboardProgram, "uProjection"),
      texture: gl.getUniformLocation(this.billboardProgram, "uTexture"),
      opacity: gl.getUniformLocation(this.billboardProgram, "uOpacity"),
      hitFlash: gl.getUniformLocation(this.billboardProgram, "uHitFlash")
    };
  }

  async loadTexture(url) {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Não foi possível carregar ${url}.`));
      img.src = url;
    });
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  applyMaterial(name) {
    const gl = this.gl;
    const material = MATERIALS[name] || MATERIALS.metal;
    gl.uniform3fv(this.uniforms.color, new Float32Array(material.color));
    gl.uniform1i(this.uniforms.materialId, material.id);
    gl.uniform3fv(this.uniforms.emissive, new Float32Array(material.emissive || [0, 0, 0]));
  }

  cacheLocations() {
    const gl = this.gl;
    this.attributes = {
      position: gl.getAttribLocation(this.program, "aPosition"),
      normal: gl.getAttribLocation(this.program, "aNormal"),
      uv: gl.getAttribLocation(this.program, "aUV")
    };
    this.uniforms = {
      model: gl.getUniformLocation(this.program, "uModel"),
      view: gl.getUniformLocation(this.program, "uView"),
      projection: gl.getUniformLocation(this.program, "uProjection"),
      lightViewProjection: gl.getUniformLocation(this.program, "uLightViewProjection"),
      normalMatrix: gl.getUniformLocation(this.program, "uNormalMatrix"),
      color: gl.getUniformLocation(this.program, "uColor"),
      lightDirection: gl.getUniformLocation(this.program, "uLightDirection"),
      ambient: gl.getUniformLocation(this.program, "uAmbient"),
      cameraPosition: gl.getUniformLocation(this.program, "uCameraPosition"),
      emissive: gl.getUniformLocation(this.program, "uEmissive"),
      pointPositions: gl.getUniformLocation(this.program, "uPointPositions"),
      pointColors: gl.getUniformLocation(this.program, "uPointColors"),
      pointParams: gl.getUniformLocation(this.program, "uPointParams"),
      pointLightCount: gl.getUniformLocation(this.program, "uPointLightCount"),
      materialId: gl.getUniformLocation(this.program, "uMaterialId"),
      time: gl.getUniformLocation(this.program, "uTime"),
      texture: gl.getUniformLocation(this.program, "uTexture"),
      useTexture: gl.getUniformLocation(this.program, "uUseTexture"),
      shadowMap: gl.getUniformLocation(this.program, "uShadowMap"),
      shadowTexelSize: gl.getUniformLocation(this.program, "uShadowTexelSize")
    };
  }

  cacheShadowLocations() {
    const gl = this.gl;
    this.shadowAttributes = { position: gl.getAttribLocation(this.shadowProgram, "aPosition") };
    this.shadowUniforms = {
      model: gl.getUniformLocation(this.shadowProgram, "uModel"),
      lightViewProjection: gl.getUniformLocation(this.shadowProgram, "uLightViewProjection")
    };
  }

  createShadowMap() {
    const gl = this.gl;
    const framebuffer = gl.createFramebuffer();
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SHADOW_SIZE, SHADOW_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SHADOW_SIZE, SHADOW_SIZE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      throw new Error("O mapa de sombras WebGL não pôde ser criado neste navegador.");
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.shadow = { framebuffer, texture, depthBuffer, lightViewProjection: mat4Identity() };
  }

  configureContext() {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearDepth(1);
  }

  createGeometries() {
    this.geometries.box = this.createGeometry(createCubeData());
    this.geometries.cylinder = this.createGeometry(createCylinderData(16));
    this.geometries.flashQuad = this.createGeometry(createQuadData());
  }

  createGeometry(data) {
    const gl = this.gl;
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);

    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.uvs), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);

    return { positionBuffer, normalBuffer, uvBuffer, indexBuffer, indexCount: data.indices.length };
  }

  createProgram(vertexSource, fragmentSource) {
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const log = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`Falha ao vincular shaders: ${log}`);
    }
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);
    return program;
  }

  compileShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const log = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Falha ao compilar shader: ${log}`);
    }
    return shader;
  }

  resize() {
    if (!this.gl) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);
    const width = Math.floor(this.canvas.clientWidth * pixelRatio);
    const height = Math.floor(this.canvas.clientHeight * pixelRatio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }
}

function createCubeData() {
  const positions = [
    -0.5,-0.5,0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5, -0.5,0.5,0.5,
    0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5,0.5,-0.5, 0.5,0.5,-0.5,
    -0.5,0.5,0.5, 0.5,0.5,0.5, 0.5,0.5,-0.5, -0.5,0.5,-0.5,
    -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,0.5,
    0.5,-0.5,0.5, 0.5,-0.5,-0.5, 0.5,0.5,-0.5, 0.5,0.5,0.5,
    -0.5,-0.5,-0.5, -0.5,-0.5,0.5, -0.5,0.5,0.5, -0.5,0.5,-0.5
  ];
  const normals = [
    0,0,1, 0,0,1, 0,0,1, 0,0,1,
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    0,1,0, 0,1,0, 0,1,0, 0,1,0,
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
    1,0,0, 1,0,0, 1,0,0, 1,0,0,
    -1,0,0, -1,0,0, -1,0,0, -1,0,0
  ];
  const indices = [];
  const faceUVs = [
    [0,0,1,0,1,1,0,1], [1,0,0,0,0,1,1,1],
    [0,1,1,1,1,0,0,0], [0,0,1,0,1,1,0,1],
    [0,0,1,0,1,1,0,1], [1,0,0,0,0,1,1,1]
  ];
  const uvs = [];
  for (let face = 0; face < 6; face += 1) {
    const base = face * 4;
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    uvs.push(...faceUVs[face]);
  }
  return { positions, normals, uvs, indices };
}

function createQuadData() {
  return {
    positions: [-0.5,-0.5,0, 0.5,-0.5,0, 0.5,0.5,0, -0.5,0.5,0],
    normals: [0,0,1, 0,0,1, 0,0,1, 0,0,1],
    uvs: [0,0, 1,0, 1,1, 0,1],
    indices: [0,1,2, 0,2,3]
  };
}

function createCylinderData(segments = 16) {
  const positions = [], normals = [], uvs = [], indices = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * 0.5;
    const z = Math.sin(a) * 0.5;
    const u = i / segments;
    positions.push(x,-0.5,z, x,0.5,z);
    normals.push(Math.cos(a),0,Math.sin(a), Math.cos(a),0,Math.sin(a));
    uvs.push(u,0, u,1);
  }
  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    const b = i * 2, nb = next * 2;
    indices.push(b,nb,nb+1,b,nb+1,b+1);
  }
  const topCenter = positions.length / 3;
  positions.push(0,0.5,0); normals.push(0,1,0); uvs.push(0.5,0.5);
  const bottomCenter = positions.length / 3;
  positions.push(0,-0.5,0); normals.push(0,-1,0); uvs.push(0.5,0.5);
  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    indices.push(topCenter,next*2+1,i*2+1);
    indices.push(bottomCenter,i*2,next*2);
  }
  return { positions, normals, uvs, indices };
}

function transformPoint(matrix, point) {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
  ];
}

function mat4Perspective(fovRadians, aspect, near, far) {
  const f = 1 / Math.tan(fovRadians / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,(2*far*near)*nf,0
  ]);
}

function mat4Ortho(left, right, bottom, top, near, far) {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);
  return new Float32Array([
    -2 * lr,0,0,0,
    0,-2 * bt,0,0,
    0,0,2 * nf,0,
    (left + right) * lr,
    (top + bottom) * bt,
    (far + near) * nf,
    1
  ]);
}

function mat4LookAt(eye, target, up) {
  const zAxis = normalize3(subtract3(eye, target));
  const xAxis = normalize3(cross3(up, zAxis));
  const yAxis = cross3(zAxis, xAxis);
  return new Float32Array([
    xAxis[0],yAxis[0],zAxis[0],0,
    xAxis[1],yAxis[1],zAxis[1],0,
    xAxis[2],yAxis[2],zAxis[2],0,
    -dot3(xAxis,eye),-dot3(yAxis,eye),-dot3(zAxis,eye),1
  ]);
}

function mat4Multiply(a,b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      out[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
    }
  }
  return out;
}

function mat4Identity() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}

function mat4FromTRS(position, rotation, scale) {
  const [sx,sy,sz] = scale;
  const [rx,ry,rz] = rotation;
  const cx=Math.cos(rx), sxr=Math.sin(rx), cy=Math.cos(ry), syr=Math.sin(ry), cz=Math.cos(rz), szr=Math.sin(rz);
  const r00=cy*cz, r01=-cy*szr, r02=syr;
  const r10=sxr*syr*cz+cx*szr, r11=-sxr*syr*szr+cx*cz, r12=-sxr*cy;
  const r20=-cx*syr*cz+sxr*szr, r21=cx*syr*szr+sxr*cz, r22=cx*cy;
  return new Float32Array([
    r00*sx,r10*sx,r20*sx,0,
    r01*sy,r11*sy,r21*sy,0,
    r02*sz,r12*sz,r22*sz,0,
    position[0],position[1],position[2],1
  ]);
}

function mat4FromSegment(start,end,scale) {
  const direction=normalize3(subtract3(end,start));
  let side=normalize3(cross3([0,1,0],direction));
  if (length3(side)<0.01) side=[1,0,0];
  const up=normalize3(cross3(direction,side));
  side=normalize3(cross3(up,direction));
  const center=multiply3(add3(start,end),0.5);
  const [sx,sy,sz]=scale;
  return new Float32Array([
    side[0]*sx,side[1]*sx,side[2]*sx,0,
    up[0]*sy,up[1]*sy,up[2]*sy,0,
    direction[0]*sz,direction[1]*sz,direction[2]*sz,0,
    center[0],center[1],center[2],1
  ]);
}

function mat3NormalFromMat4(m) {
  const a00=m[0],a01=m[4],a02=m[8],a10=m[1],a11=m[5],a12=m[9],a20=m[2],a21=m[6],a22=m[10];
  const b01=a22*a11-a12*a21,b11=-a22*a10+a12*a20,b21=a21*a10-a11*a20;
  let det=a00*b01+a01*b11+a02*b21; if(Math.abs(det)<1e-8)det=1;
  const inv=1/det;
  return new Float32Array([
    b01*inv,(-a22*a01+a02*a21)*inv,(a12*a01-a02*a11)*inv,
    b11*inv,(a22*a00-a02*a20)*inv,(-a12*a00+a02*a10)*inv,
    b21*inv,(-a21*a00+a01*a20)*inv,(a11*a00-a01*a10)*inv
  ]);
}

function getCameraBasis(camera) {
  const fwdXZ=camera.getForwardXZ();
  const forward=normalize3([fwdXZ[0],Math.sin(camera.pitch),fwdXZ[1]]);
  const right=normalize3(cross3(forward,[0,1,0]));
  const up=normalize3(cross3(right,forward));
  return {forward,right,up};
}

function rayAABB(origin,direction,object) {
  const [ox,oy,oz]=object.position,[sx,sy,sz]=object.scale;
  const min=[ox-sx/2,oy-sy/2,oz-sz/2],max=[ox+sx/2,oy+sy/2,oz+sz/2];
  let tMin=-Infinity,tMax=Infinity,hitNormal=[0,0,0];
  for(let i=0;i<3;i+=1){
    const o=origin[i],d=direction[i];
    if(Math.abs(d)<1e-7){if(o<min[i]||o>max[i])return null;continue;}
    const inv=1/d; let near=(min[i]-o)*inv,far=(max[i]-o)*inv;
    let nearN=[0,0,0],farN=[0,0,0]; nearN[i]=-1;farN[i]=1;
    if(near>far){[near,far]=[far,near];[nearN,farN]=[farN,nearN];}
    if(near>tMin){tMin=near;hitNormal=nearN;} tMax=Math.min(tMax,far); if(tMin>tMax)return null;
  }
  const distance=tMin>=0?tMin:tMax; if(distance<0||!Number.isFinite(distance))return null;
  return {distance,point:add3(origin,multiply3(direction,distance)),normal:hitNormal};
}

function raySphere(origin,direction,center,radius) {
  const oc=subtract3(origin,center),b=dot3(oc,direction),c=dot3(oc,oc)-radius*radius,h=b*b-c;
  if(h<0)return null; const s=Math.sqrt(h); let distance=-b-s; if(distance<0)distance=-b+s; if(distance<0)return null;
  const point=add3(origin,multiply3(direction,distance));
  return {distance,point,normal:normalize3(subtract3(point,center))};
}

function subtract3(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function add3(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function multiply3(v,s){return [v[0]*s,v[1]*s,v[2]*s];}
function cross3(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function length3(v){return Math.hypot(v[0],v[1],v[2]);}
function distanceSquared(a,b){const x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];return x*x+y*y+z*z;}
function normalize3(v){const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];}
function degToRad(d){return d*Math.PI/180;}
