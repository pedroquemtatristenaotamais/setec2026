export class Knife {
  constructor() {
    this.name = "Faca";
    this.attackCooldown = 0;
    this.attackDuration = 0.38;
    this.attackTimer = 0;
  }

  update(deltaTime) {
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
    this.attackTimer = Math.max(0, this.attackTimer - deltaTime);
  }

  tryAttack() {
    if (this.attackCooldown > 0) return { attacked: false, reason: "busy" };

    this.attackCooldown = 0.55;
    this.attackTimer = this.attackDuration;
    return { attacked: true, range: 2.1, damage: 60 };
  }

  isAttacking() {
    return this.attackTimer > 0;
  }
}
