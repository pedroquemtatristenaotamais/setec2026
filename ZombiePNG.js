export class ZombiePNG {
  constructor(position, id, collisionTest, alertCallback) {
    this.id = id;
    this.position = [...position];
    this.home = [...position];
    this.collisionTest = collisionTest;
    this.alertCallback = alertCallback;

    this.state = "WANDER";
    this.health = 100;
    this.radius = 0.36;
    this.height = 2.25;
    this.speed = 0.72;
    this.chaseSpeed = 1.65;
    this.detectionRange = 20;
    this.attackRange = 1.45;
    this.attackCooldown = 0;
    this.dead = false;
    this.hitFlash = 0;
    this.bobTime = Math.random() * Math.PI * 2;
    this.wanderTime = 1.5 + Math.random() * 2.5;
    this.yaw = Math.random() * Math.PI * 2;
  }

  update(deltaTime, player, canSeePlayer) {
    if (this.dead) return;

    this.bobTime += deltaTime;
    this.hitFlash = Math.max(0, this.hitFlash - deltaTime);
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);

    const dx = player.position[0] - this.position[0];
    const dz = player.position[2] - this.position[2];
    const distance = Math.hypot(dx, dz);

    const seesPlayer = distance <= this.detectionRange && canSeePlayer(this.position, player.position);

    if (seesPlayer) {
      if (this.state !== "CHASE") this.alertCallback?.(this);
      this.state = "CHASE";
    }

    if (this.state === "CHASE") {
      if (!seesPlayer && distance > this.detectionRange * 1.3) {
        this.state = "WANDER";
      } else {
        this.moveToward(player.position[0], player.position[2], this.chaseSpeed, deltaTime);
        if (distance <= this.attackRange && this.attackCooldown <= 0) {
          this.attackCooldown = 0.95;
          player.takeDamage?.(11);
        }
        return;
      }
    }

    this.wanderTime -= deltaTime;
    if (this.wanderTime <= 0) {
      this.wanderTime = 1.5 + Math.random() * 2.5;
      this.yaw += (-0.7 + Math.random() * 1.4);
    }

    const targetX = this.position[0] + Math.sin(this.yaw) * 2.0;
    const targetZ = this.position[2] - Math.cos(this.yaw) * 2.0;
    this.moveToward(targetX, targetZ, this.speed, deltaTime);
  }

  moveToward(targetX, targetZ, speed, deltaTime) {
    const dx = targetX - this.position[0];
    const dz = targetZ - this.position[2];
    const distance = Math.hypot(dx, dz);
    if (distance < 0.001) return;

    const step = Math.min(speed * deltaTime, distance);
    const nextX = this.position[0] + (dx / distance) * step;
    const nextZ = this.position[2] + (dz / distance) * step;

    if (!this.collisionTest(nextX, nextZ, this.radius)) {
      this.position[0] = nextX;
      this.position[2] = nextZ;
    } else {
      this.yaw += 0.8;
    }

    this.yaw = Math.atan2(dx, -dz);
  }

  takeDamage(amount, headshot = false) {
    if (this.dead) return false;

    this.health -= headshot ? Math.max(amount, 100) : amount;
    this.hitFlash = 0.10;
    this.state = "CHASE";

    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      return true;
    }

    return false;
  }

  getHitRegions() {
    const head = [this.position[0], this.position[1] + 1.95, this.position[2]];
    const torso = [this.position[0], this.position[1] + 1.18, this.position[2]];
    return {
      head,
      headRadius: 0.24,
      torso,
      torsoRadius: 0.56,
      bodyRadius: 0.68
    };
  }
}
