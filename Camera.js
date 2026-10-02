export class Camera {
  constructor({ position = [0, 1.65, 10.5], yaw = 0, pitch = 0, fovY = 68, near = 0.08, far = 120 } = {}) {
    this.position = [...position];
    this.yaw = yaw;
    this.pitch = pitch;
    this.fovY = fovY;
    this.near = near;
    this.far = far;
    this.up = [0, 1, 0];
    this.mouseSensitivity = 0.0024;
    this.maxPitch = Math.PI / 2 - 0.05;
    this.canvas = null;
  }

  setPosition(x, y, z) {
    this.position[0] = x;
    this.position[1] = y;
    this.position[2] = z;
  }

  reset(position = [0, 1.0, 10.5], yaw = 0, pitch = 0) {
    this.position = [...position];
    this.yaw = yaw;
    this.pitch = pitch;
  }

  rotate(deltaX, deltaY) {
    // Convenção FPS: mover o mouse para a direita faz a câmera olhar para a direita.
    this.yaw += deltaX * this.mouseSensitivity;
    this.pitch -= deltaY * this.mouseSensitivity;
    this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));
  }

  getForwardXZ() {
    const cosPitch = Math.cos(this.pitch);
    return [
      Math.sin(this.yaw) * cosPitch,
      -Math.cos(this.yaw) * cosPitch
    ];
  }

  getRightXZ() {
    return [
      Math.cos(this.yaw),
      Math.sin(this.yaw)
    ];
  }

  getLookTarget(distance = 1) {
    const cosPitch = Math.cos(this.pitch);
    const x = Math.sin(this.yaw) * cosPitch;
    const y = Math.sin(this.pitch);
    const z = -Math.cos(this.yaw) * cosPitch;

    return [
      this.position[0] + x * distance,
      this.position[1] + y * distance,
      this.position[2] + z * distance
    ];
  }
}
