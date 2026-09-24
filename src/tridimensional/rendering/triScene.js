import * as THREE from 'three';
import { coordKey, parseCoordKey } from '../board/coordinates.js';
import { worldToNearestCell } from '../board/boardLayout.js';
import { TriGameState } from '../gameState/triGameState.js';
import { TriCameraControls } from './cameraControls.js';
import { createBoardMeshes, createPieceMesh, pickWorldPoint } from './pieceMeshes.js';

export class TriSceneController {
  /**
   * @param {HTMLElement} root
   */
  constructor(root) {
    this.root = root;
    this.state = new TriGameState();
    /** @type {THREE.WebGLRenderer | null} */
    this.renderer = null;
    /** @type {THREE.Scene | null} */
    this.scene = null;
    /** @type {THREE.PerspectiveCamera | null} */
    this.camera = null;
    /** @type {TriCameraControls | null} */
    this.controls = null;
    /** @type {Map<string, THREE.Group>} */
    this.pieceMeshes = new Map();
    /** @type {Map<string, THREE.Mesh>} */
    this.cellMeshes = new Map();
    this.raf = 0;
    this.statusEl = root.querySelector('#tri-status');
    this.resetBtn = root.querySelector('#tri-reset-camera');
    this.newGameBtn = root.querySelector('#tri-new-game');

    this.onResize = this.onResize.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.animate = this.animate.bind(this);
  }

  mount() {
    const canvasHost = this.root.querySelector('#tri-canvas-host');
    if (!canvasHost) {
      throw new Error('tri canvas host missing');
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(canvasHost.clientWidth, canvasHost.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasHost.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b12);
    this.scene.fog = new THREE.Fog(0x070b12, 24, 70);

    this.camera = new THREE.PerspectiveCamera(
      48,
      canvasHost.clientWidth / canvasHost.clientHeight,
      0.1,
      200,
    );

    this.scene.add(new THREE.AmbientLight(0x8cb8ff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(8, 18, 10);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x4da3ff, 0.45);
    rim.position.set(-10, 8, -12);
    this.scene.add(rim);

    this.cellMeshes = createBoardMeshes(this.scene);
    this.controls = new TriCameraControls(this.camera, this.renderer.domElement);
    this.controls.updateCamera();

    this.syncPieces();
    this.setStatus('Figur antippen, dann Zielfeld (Phase 1: ohne Regelprüfung).');

    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.resetBtn?.addEventListener('click', () => this.controls?.reset());
    this.newGameBtn?.addEventListener('click', () => this.resetGame());

    this.raf = requestAnimationFrame(this.animate);
  }

  resetGame() {
    this.state.reset();
    this.syncPieces();
    this.clearHighlights();
    this.setStatus('Neue 3D-Partie gestartet.');
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.renderer?.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.controls?.dispose();

    for (const mesh of this.pieceMeshes.values()) {
      mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }

    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.pieceMeshes.clear();
    this.cellMeshes.clear();
  }

  onResize() {
    const canvasHost = this.root.querySelector('#tri-canvas-host');
    if (!canvasHost || !this.renderer || !this.camera || !this.controls) return;
    const { clientWidth, clientHeight } = canvasHost;
    this.renderer.setSize(clientWidth, clientHeight);
    this.controls.handleResize(clientWidth, clientHeight);
  }

  animate() {
    this.raf = requestAnimationFrame(this.animate);
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  syncPieces() {
    for (const mesh of this.pieceMeshes.values()) {
      this.scene?.remove(mesh);
    }
    this.pieceMeshes.clear();

    for (const [key, piece] of this.state.pieces.entries()) {
      const coord = parseCoordKey(key);
      if (!coord) continue;
      const selected = this.state.selectedKey === key;
      const group = createPieceMesh(piece, selected);
      group.userData.cellKey = key;
      const worldMesh = this.cellMeshes.get(key);
      if (worldMesh) {
        group.position.copy(worldMesh.position);
        group.position.y += 0.08;
      }
      this.scene?.add(group);
      this.pieceMeshes.set(key, group);
    }

    this.highlightSelection();
  }

  highlightSelection() {
    this.clearHighlights();
    if (!this.state.selectedKey) return;
    const tile = this.cellMeshes.get(this.state.selectedKey);
    if (tile && tile.material instanceof THREE.MeshStandardMaterial) {
      tile.material.emissive = new THREE.Color(0x33aaff);
      tile.material.emissiveIntensity = 0.35;
    }
  }

  clearHighlights() {
    for (const tile of this.cellMeshes.values()) {
      if (tile.material instanceof THREE.MeshStandardMaterial) {
        tile.material.emissive = new THREE.Color(0x000000);
        tile.material.emissiveIntensity = 0;
      }
    }
  }

  onPointerUp(event) {
    if (!this.controls || !this.camera || !this.renderer) return;
    if (this.controls.consumeTapGesture()) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const hits = raycaster.intersectObjects(this.scene.children, true);

    let cellKey = null;
    for (const hit of hits) {
      let obj = hit.object;
      while (obj) {
        if (obj.userData?.cellKey) {
          cellKey = obj.userData.cellKey;
          break;
        }
        obj = obj.parent;
      }
      if (cellKey) break;
    }

    if (!cellKey) {
      const world = pickWorldPoint(event.clientX, event.clientY, this.camera, this.renderer);
      const nearest = worldToNearestCell({ wx: world.x, wy: world.y, wz: world.z });
      if (nearest) {
        cellKey = coordKey(nearest);
      }
    }

    if (!cellKey) return;
    const coord = parseCoordKey(cellKey);
    if (!coord) return;

    const result = this.state.selectOrMove(coord);
    this.syncPieces();

    if (result.kind === 'selected') {
      this.setStatus(`${result.piece.color === 'w' ? 'Weiß' : 'Schwarz'} ${result.piece.type.toUpperCase()} ausgewählt`);
    } else if (result.kind === 'moved') {
      this.setStatus('Figur bewegt (Phase 1 – ohne Regelprüfung).');
    } else if (result.kind === 'cleared') {
      this.setStatus('Auswahl aufgehoben.');
    }
  }

  setStatus(text) {
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }
}

/**
 * @param {HTMLElement} root
 */
export function initTriApp(root) {
  const app = new TriSceneController(root);
  app.mount();
  return app;
}

export function destroyTriApp(app) {
  app?.dispose();
}
