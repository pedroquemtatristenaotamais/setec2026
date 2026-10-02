import { Camera } from "./Camera.js";

export class Player {
  constructor({ spawn = [0, 0, 16.5], speed = 4.6, runSpeed = 7.5 } = {}) {
    this.spawn = [...spawn];
    this.position = [...spawn];
    this.velocityY = 0;

    this.speed = speed;
    this.runSpeed = runSpeed;
    this.gravity = -20;
    this.height = 2.0;
    this.radius = 0.34;
    this.eyeHeight = 1.66;
    this.groundY = 0;
    this.grounded = true;

    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.moveAmount = 0;
    this.isSprinting = false;
    this.enabled = false;

    this.camera = new Camera({
      position: [spawn[0], spawn[1] + this.eyeHeight, spawn[2]],
      fovY: 72
    });

    this.keys = new Set();
    this.solidObjects = [];
    this.lastFootstep = 0;
    this.onFootstep = null;
    this.onDamage = null;
    this.onDeath = null;

    this.handleKeyDown = (event) => {
      this.keys.add(event.code);
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "KeyR", "KeyF"].includes(event.code)) {
        event.preventDefault();
      }
    };

    this.handleKeyUp = (event) => {
      this.keys.delete(event.code);
    };

    this.handleBlur = () => this.keys.clear();

    this.lastMouseX = null;
    this.lastMouseY = null;

    this.handleMouseMove = (event) => {
      if (!this.enabled) return;

      if (document.pointerLockElement === this.camera.canvas) {
        this.camera.rotate(event.movementX, event.movementY);
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        return;
      }

      if (this.lastMouseX === null || this.lastMouseY === null) {
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        return;
      }

      const dx = event.clientX - this.lastMouseX;
      const dy = event.clientY - this.lastMouseY;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      if (Math.abs(dx) < 80 && Math.abs(dy) < 80) this.camera.rotate(dx, dy);
    };

    window.addEventListener("keydown", this.handleKeyDown, { passive: false });
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    document.addEventListener("mousemove", this.handleMouseMove);
  }

  attachCanvas(canvas) {
    this.camera.canvas = canvas;
  }

  setCollisionObjects(objects) {
    this.solidObjects = objects.filter((object) =>
      object.solid && object.name !== "floor" && object.name !== "ceiling"
    );
  }

  update(deltaTime) {
    if (!this.enabled || this.isDead()) return;

    const forward = this.camera.getForwardXZ();
    const right = this.camera.getRightXZ();

    let moveX = 0;
    let moveZ = 0;

    if (this.keys.has("KeyW")) {
      moveX += forward[0];
      moveZ += forward[1];
    }
    if (this.keys.has("KeyS")) {
      moveX -= forward[0];
      moveZ -= forward[1];
    }
    if (this.keys.has("KeyD")) {
      moveX += right[0];
      moveZ += right[1];
    }
    if (this.keys.has("KeyA")) {
      moveX -= right[0];
      moveZ -= right[1];
    }

    const length = Math.hypot(moveX, moveZ);
    this.isSprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    this.moveAmount = Math.min(1, length);

    if (length > 0.0001) {
      moveX /= length;
      moveZ /= length;

      const speed = this.isSprinting ? this.runSpeed : this.speed;
      const distance = speed * deltaTime;

      this.tryMove(moveX * distance, 0);
      this.tryMove(0, moveZ * distance);

      this.lastFootstep -= deltaTime;
      const footstepInterval = this.isSprinting ? 0.27 : 0.39;
      if (this.lastFootstep <= 0) {
        this.lastFootstep = footstepInterval;
        this.onFootstep?.(this.isSprinting);
      }
    } else {
      this.lastFootstep = Math.min(this.lastFootstep, 0.08);
    }

    this.velocityY += this.gravity * deltaTime;
    this.position[1] += this.velocityY * deltaTime;

    if (this.position[1] <= this.groundY) {
      this.position[1] = this.groundY;
      this.velocityY = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    this.camera.setPosition(
      this.position[0],
      this.position[1] + this.eyeHeight,
      this.position[2]
    );
  }

  tryMove(deltaX, deltaZ) {
    const nextX = this.position[0] + deltaX;
    const nextZ = this.position[2] + deltaZ;

    if (!this.collidesAt(nextX, this.position[2])) this.position[0] = nextX;
    if (!this.collidesAt(this.position[0], nextZ)) this.position[2] = nextZ;
  }

  collidesAt(x, z) {
    const playerMinX = x - this.radius;
    const playerMaxX = x + this.radius;
    const playerMinZ = z - this.radius;
    const playerMaxZ = z + this.radius;
    const playerMinY = this.position[1];
    const playerMaxY = this.position[1] + this.height;

    for (const object of this.solidObjects) {
      const [ox, oy, oz] = object.position;
      const [sx, sy, sz] = object.scale;
      const minX = ox - sx / 2;
      const maxX = ox + sx / 2;
      const minY = oy - sy / 2;
      const maxY = oy + sy / 2;
      const minZ = oz - sz / 2;
      const maxZ = oz + sz / 2;

      if (
        playerMaxX > minX && playerMinX < maxX &&
        playerMaxZ > minZ && playerMinZ < maxZ &&
        playerMaxY > minY && playerMinY < maxY
      ) return true;
    }

    return false;
  }

  takeDamage(amount) {
    if (this.isDead()) return;

    this.health = Math.max(0, this.health - amount);
    this.onDamage?.(amount, this.health);

    if (this.health <= 0) {
      this.enabled = false;
      this.keys.clear();
      this.onDeath?.();
    }
  }

  isDead() {
    return this.health <= 0;
  }

  reset() {
    this.lastMouseX = null;
    this.lastMouseY = null;
    this.position = [...this.spawn];
    this.velocityY = 0;
    this.grounded = true;
    this.health = this.maxHealth;
    this.moveAmount = 0;
    this.isSprinting = false;
    this.lastFootstep = 0;
    this.camera.reset(
      [this.spawn[0], this.spawn[1] + this.eyeHeight],
      0,
      0
    );
    this.keys.clear();
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    if (!this.enabled) this.keys.clear();
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    document.removeEventListener("mousemove", this.handleMouseMove);
  }
}
