export class AK47 {
  constructor() {
    this.name = "AK-47";
    this.magazineSize = 30;
    this.ammo = 30;
    this.spareMagazines = 4;

    this.fireInterval = 0.105;
    this.reloadDuration = 2.2;
    this.reloadTimer = 0;
    this.fireTimer = 0;
    this.recoil = 0;
    this.muzzleFlashTimer = 0;
    this.triggerHeld = false;
    this.bobTime = 0;
    this.shotCount = 0;

    // O ponto é definido no espaço local do OBJ normalizado.
    // O modelo está apontado para +Z; a rotação do viewmodel vira o cano para -Z.
    this.muzzleLocal = [0.018, 0.535, 0.945];
  }

  update(deltaTime, isMoving, isSprinting) {
    this.fireTimer = Math.max(0, this.fireTimer - deltaTime);
    this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - deltaTime);
    this.recoil = Math.max(0, this.recoil - deltaTime * 10.5);

    if (isMoving) {
      this.bobTime += deltaTime * (isSprinting ? 14 : 9.5);
    }

    let reloaded = false;
    if (this.reloadTimer > 0) {
      const previous = this.reloadTimer;
      this.reloadTimer = Math.max(0, this.reloadTimer - deltaTime);

      if (previous > 0 && this.reloadTimer === 0) {
        if (this.spareMagazines > 0 && this.ammo < this.magazineSize) {
          this.ammo = this.magazineSize;
          this.spareMagazines -= 1;
          reloaded = true;
        }
      }
    }

    return { reloaded };
  }

  tryFire() {
    if (this.reloadTimer > 0) {
      return { fired: false, reason: "reloading" };
    }

    if (this.fireTimer > 0) {
      return { fired: false, reason: "busy" };
    }

    if (this.ammo <= 0) {
      return { fired: false, reason: "empty" };
    }

    this.ammo -= 1;
    this.fireTimer = this.fireInterval;
    this.recoil = 1;
    this.muzzleFlashTimer = 0.105;
    this.shotCount += 1;

    return {
      fired: true,
      damage: 42,
      spread: 0.0045
    };
  }

  startReload() {
    if (this.reloadTimer > 0) return false;
    if (this.spareMagazines <= 0) return false;
    if (this.ammo >= this.magazineSize) return false;

    this.reloadTimer = this.reloadDuration;
    return true;
  }

  getReloadProgress() {
    if (this.reloadTimer <= 0) return 0;
    return 1 - this.reloadTimer / this.reloadDuration;
  }

  getViewBob() {
    if (this.bobTime <= 0) return [0, 0];
    return [
      Math.sin(this.bobTime * 1.42) * 0.012,
      Math.abs(Math.cos(this.bobTime * 1.42)) * 0.009
    ];
  }

  getViewModelTransform() {
    const [bobX, bobY] = this.getViewBob();
    const progress = this.getReloadProgress();
    const active = this.reloadTimer > 0;
    const reloadWave = active ? Math.sin(progress * Math.PI) : 0;
    const reloadDrop = active ? Math.sin(Math.min(progress / 0.42, 1) * Math.PI * 0.5) : 0;
    const reloadReturn = progress > 0.68 ? (progress - 0.68) / 0.32 : 0;

    return {
      // Perfil lateral competitivo: coronha à direita, cano apontando para o centro-esquerda.
      position: [
        0.46 + bobX + reloadWave * 0.025,
        -0.55 + bobY - reloadDrop * 0.075,
        -0.82 + this.recoil * 0.022 + reloadWave * 0.04
      ],
      rotation: [
        -0.115 + reloadWave * 0.08,
        -1.12,
        -0.16 - reloadWave * 0.06 + reloadReturn * 0.025
      ],
      scale: [0.64, 0.64, 0.64]
    };
  }

  getArmViewModelTransforms() {
    const [bobX, bobY] = this.getViewBob();
    const progress = this.getReloadProgress();
    const active = this.reloadTimer > 0;
    const reloadWave = active ? Math.sin(progress * Math.PI) : 0;
    const leftReach = active ? Math.sin(Math.min(progress / 0.52, 1) * Math.PI) : 0;
    const rightReach = active ? Math.sin(Math.max((progress - 0.12) / 0.76, 0) * Math.PI) : 0;

    return {
      right: {
        // Pivot no ombro: mão direita converge para o punho/guarda-mato.
        position: [
          0.88 + bobX - rightReach * 0.035,
          -0.98 + bobY + rightReach * 0.025,
          -0.83 - rightReach * 0.08
        ],
        rotation: [
          0.16,
          -0.13,
          -2.73 - rightReach * 0.18
        ],
        scale: [0.35, 0.35, 0.35]
      },
      left: {
        // Pivot no ombro: mão esquerda apoia o handguard pela parte inferior.
        position: [
          -0.45 + bobX + leftReach * 0.025,
          -1.00 + bobY - leftReach * 0.02,
          -0.95 - leftReach * 0.06
        ],
        rotation: [
          -0.13,
          0.12,
          2.73 + leftReach * 0.18
        ],
        scale: [0.35, 0.35, 0.35]
      }
    };
  }

  getMuzzleLocal() {
    return [...this.muzzleLocal];
  }
}
