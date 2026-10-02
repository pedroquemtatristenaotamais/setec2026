export class SecurityDrone {
  constructor(position, id, collisionTest, alertCallback) {
    this.id = id;
    this.position = [...position];
    this.home = [...position];
    this.collisionTest = collisionTest;
    this.alertCallback = alertCallback;

    this.state = "PATROL";
    this.health = 100;
    this.radius = 0.72;
    this.height = 1.5;
    this.speed = 2.1;
    this.chaseSpeed = 3.6;
    this.detectionRange = 15.5;
    this.fov = Math.cos((72 * Math.PI / 180) / 2);
    this.attackRange = 4.2;
    this.attackCooldown = 0.0;
    this.investigateTimer = 0;
    this.returnDelay = 0;
    this.dead = false;
    this.hitFlash = 0;
    this.rotorTime = Math.random() * 10;
    this.yaw = Math.random() * Math.PI * 2;
  }

  update(deltaTime, player, canSeePlayer) {
    if (this.dead) return;

    this.rotorTime += deltaTime * 11;
    this.hitFlash = Math.max(0, this.hitFlash - deltaTime);
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);

    const dx = player.position[0] - this.position[0];
    const dz = player.position[2] - this.position[2];
    const distance = Math.hypot(dx, dz);

    if (this.state === "PATROL") {
      if (this.detectPlayer(player, distance, canSeePlayer)) {
        this.state = "CHASE";
        this.alertCallback?.(this);
      } else {
        this.position[1] = 1.5 + Math.sin(this.rotorTime * 0.8) * 0.05;
        const circleAngle = this.rotorTime * 0.30 + this.id * 1.3;
        const target = [
          this.home[0] + Math.cos(circleAngle) * 2.5,
          0,
          this.home[2] + Math.sin(circleAngle) * 2.5
        ];
        this.moveToward(target[0], target[2], this.speed, deltaTime);
      }
    } else if (this.state === "INVESTIGATE") {
      this.investigateTimer -= deltaTime;
      if (this.investigateTimer <= 0) this.state = "RETURN";
    } else if (this.state === "CHASE") {
      if (!this.detectPlayer(player, distance, canSeePlayer) && distance > this.detectionRange * 1.45) {
        this.returnDelay += deltaTime;
        if (this.returnDelay > 2.8) {
          this.returnDelay = 0;
          this.state = "RETURN";
        }
      } else {
        this.returnDelay = 0;
        this.moveToward(player.position[0], player.position[2], this.chaseSpeed, deltaTime);
        this.position[1] = 1.5 + Math.sin(this.rotorTime * 0.95) * 0.07;

        if (distance <= this.attackRange && this.attackCooldown <= 0) {
          this.attackCooldown = 0.85;
          player.takeDamage?.(8);
        }
      }
    } else if (this.state === "RETURN") {
      const homeDistance = Math.hypot(
        this.position[0] - this.home[0],
        this.position[2] - this.home[2]
      );
      this.moveToward(this.home[0], this.home[2], this.speed * 1.2, deltaTime);
      if (homeDistance < 0.5) this.state = "PATROL";
    }
  }

  detectPlayer(player, distance, canSeePlayer) {
    if (distance > this.detectionRange) return false;

    const forward = this.getForwardVector();
    const toPlayer = normalize2([
      player.position[0] - this.position[0],
      player.position[2] - this.position[2]
    ]);

    const dot = forward[0] * toPlayer[0] + forward[1] * toPlayer[1];
    return dot >= this.fov && canSeePlayer(this.position, player.position);
  }

  getForwardVector() {
    return [Math.sin(this.yaw), -Math.cos(this.yaw)];
  }

  moveToward(targetX, targetZ, speed, deltaTime) {
    const dx = targetX - this.position[0];
    const dz = targetZ - this.position[2];
    const length = Math.hypot(dx, dz);
    if (length < 0.001) return;

    const step = Math.min(speed * deltaTime, length);
    const nextX = this.position[0] + (dx / length) * step;
    const nextZ = this.position[2] + (dz / length) * step;
    this.yaw = Math.atan2(dx, -dz);

    if (!this.collisionTest(nextX, nextZ, this.radius)) {
      this.position[0] = nextX;
      this.position[2] = nextZ;
    }
  }

  takeDamage(amount) {
    if (this.dead) return false;

    this.health -= amount;
    this.hitFlash = 0.08;
    this.state = "CHASE";
    this.returnDelay = 0;

    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      return true;
    }

    return false;
  }

  getRenderables() {
    if (this.dead) return [];

    const flash = this.hitFlash > 0;
    const rotor = Math.sin(this.rotorTime) * 0.25;
    const eyeMaterial = flash ? "hitFlash" : "droneEye";

    return [
      {
        geometry: "box",
        position: [this.position[0], this.position[1], this.position[2]],
        scale: [1.0, 0.55, 1.0],
        rotation: [0, rotor, 0],
        material: "droneBody"
      },
      {
        geometry: "cylinder",
        position: [this.position[0], this.position[1] + 0.28, this.position[2]],
        scale: [0.58, 0.10, 0.58],
        rotation: [0, rotor, 0],
        material: "droneMetal"
      },
      {
        geometry: "box",
        position: [this.position[0], this.position[1] - 0.05, this.position[2] - 0.53],
        scale: [0.28, 0.18, 0.08],
        rotation: [0, 0, 0],
        material: eyeMaterial
      },
      {
        geometry: "box",
        position: [this.position[0], this.position[1] - 0.05, this.position[2] + 0.53],
        scale: [0.28, 0.18, 0.08],
        rotation: [0, 0, 0],
        material: eyeMaterial
      },
    ];
  }
}

function normalize2(vector) {
  const length = Math.hypot(vector[0], vector[1]) || 1;
  return [vector[0] / length, vector[1] / length];
}
