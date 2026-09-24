import * as THREE from 'three';

const DEFAULT = { radius: 18, phi: 0.85, theta: 0.72 };

/**
 * iPad-friendly orbit + pinch + pan with tap discrimination.
 */
export class TriCameraControls {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} domElement
   */
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3(0, 3.6, 0);
    this.radius = DEFAULT.radius;
    this.phi = DEFAULT.phi;
    this.theta = DEFAULT.theta;

    /** @type {Map<number, { x: number, y: number }>} */
    this.pointers = new Map();
    this.lastPinchDistance = 0;
    this.tapMoved = false;
    this.enabled = true;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerUp.bind(this);

    domElement.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    domElement.addEventListener('pointermove', this.onPointerMove, { passive: false });
    domElement.addEventListener('pointerup', this.onPointerUp);
    domElement.addEventListener('pointercancel', this.onPointerCancel);
  }

  reset() {
    this.radius = DEFAULT.radius;
    this.phi = DEFAULT.phi;
    this.theta = DEFAULT.theta;
    this.target.set(0, 3.6, 0);
    this.updateCamera();
  }

  dispose() {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('pointercancel', this.onPointerCancel);
  }

  /** @returns {boolean} true if gesture was camera manipulation */
  consumeTapGesture() {
    const moved = this.tapMoved;
    this.tapMoved = false;
    return moved;
  }

  onPointerDown(event) {
    if (!this.enabled) return;
    this.domElement.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.tapMoved = false;
  }

  onPointerMove(event) {
    if (!this.enabled || !this.pointers.has(event.pointerId)) return;

    const prev = this.pointers.get(event.pointerId);
    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    if (Math.hypot(dx, dy) > 6) {
      this.tapMoved = true;
    }

    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 1) {
      this.theta -= dx * 0.005;
      this.phi = Math.min(1.45, Math.max(0.25, this.phi + dy * 0.005));
      this.updateCamera();
      return;
    }

    if (this.pointers.size >= 2) {
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.lastPinchDistance > 0) {
        this.radius = Math.min(34, Math.max(8, this.radius - (dist - this.lastPinchDistance) * 0.04));
      }
      this.lastPinchDistance = dist;

      this.target.x -= dx * 0.015;
      this.target.z += dy * 0.015;
      this.updateCamera();
    }
  }

  onPointerUp(event) {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) {
      this.lastPinchDistance = 0;
    }
    try {
      this.domElement.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  }

  updateCamera() {
    const x = this.target.x + this.radius * Math.sin(this.phi) * Math.sin(this.theta);
    const y = this.target.y + this.radius * Math.cos(this.phi);
    const z = this.target.z + this.radius * Math.sin(this.phi) * Math.cos(this.theta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  handleResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
