import * as THREE from 'three';
import { coordKey, parseCoordKey } from '../board/coordinates.js';
import { coordToWorld, worldToNearestCell } from '../board/boardLayout.js';
import { TriGameState } from '../gameState/triGameState.js';
import { isInCheck } from '../rules/moveEngine.js';
import { RULESET_NAME } from '../rules/cgTdcV1Rules.js';
import { renderTriCapturedDisplay, renderTriMoveList } from '../ui/triHud.js';
import {
  applyValidatedTriMove,
  beginTriSearchToken,
  cancelTriSearch,
  chooseTriComputerMove,
  isTriSearchTokenCurrent,
} from '../ai/searchClient.js';
import { TriCameraControls } from './cameraControls.js';
import { createBoardMeshes, createPieceMesh, pickWorldPoint, placeGroupAtCoord } from './pieceMeshes.js';

const HIGHLIGHT = {
  selected: { color: 0x33aaff, intensity: 0.35 },
  move: { color: 0x44ff88, intensity: 0.28 },
  capture: { color: 0xff6644, intensity: 0.38 },
  last: { color: 0xffcc44, intensity: 0.22 },
  check: { color: 0xff2244, intensity: 0.55 },
};

/**
 * @param {Map<string, THREE.Mesh>} cellMeshes
 * @param {number[]} attackSlots
 */
function syncAttackBoardGeometry(cellMeshes, attackSlots) {
  for (const [key, tile] of cellMeshes.entries()) {
    const coord = parseCoordKey(key);
    if (!coord || coord.surface !== 'attack') continue;
    const world = coordToWorld(coord, attackSlots);
    tile.position.set(world.wx, world.wy, world.wz);
  }
}

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
    /** @type {Map<string, 'move'|'capture'>} */
    this.legalTargets = new Map();
    this.relocateMode = false;
    this.raf = 0;
    this.clock = new THREE.Clock();
    /** @type {{ group: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, elapsed: number, duration: number, onDone?: () => void }[]} */
    this.animations = [];

    this.playMode = 'human';
    /** @type {'w'|'b'} */
    this.humanColor = 'w';
    this.difficulty = 'medium';
    this.thinking = false;
    this.searchToken = 0;

    this.statusEl = root.querySelector('#tri-status');
    this.thinkingEl = root.querySelector('#tri-thinking');
    this.computerOptionsEl = root.querySelector('#tri-computer-options');
    this.difficultyEl = root.querySelector('#tri-difficulty');
    this.resetBtn = root.querySelector('#tri-reset-camera');
    this.newGameBtn = root.querySelector('#tri-new-game');
    this.undoBtn = root.querySelector('#tri-undo');
    this.resignBtn = root.querySelector('#tri-resign');
    this.relocateBtn = root.querySelector('#tri-relocate');
    this.hud = {
      topPiecesEl: root.querySelector('#tri-captured-by-black'),
      bottomPiecesEl: root.querySelector('#tri-captured-by-white'),
      topAdvantageEl: root.querySelector('#tri-material-top'),
      bottomAdvantageEl: root.querySelector('#tri-material-bottom'),
      moveListEl: root.querySelector('#tri-move-list'),
    };

    this.onResize = this.onResize.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.animate = this.animate.bind(this);
  }

  mount() {
    document.body.classList.add('tri-mode');

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

    this.cellMeshes = createBoardMeshes(this.scene, this.state.attackSlots);
    this.controls = new TriCameraControls(this.camera, this.renderer.domElement);
    this.controls.updateCamera();

    this.syncPieces(false);
    this.refreshHud();
    this.setStatus(`${RULESET_NAME} · Weiß am Zug`);

    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.resetBtn?.addEventListener('click', () => this.controls?.reset());
    this.newGameBtn?.addEventListener('click', () => this.resetGame());
    this.undoBtn?.addEventListener('click', () => this.handleUndo());
    this.resignBtn?.addEventListener('click', () => this.handleResign());
    this.relocateBtn?.addEventListener('click', () => this.toggleRelocateMode());

    this.root.querySelectorAll('input[name="tri-mode"]').forEach((input) => {
      input.addEventListener('change', () => this.onModeSettingsChanged());
    });
    this.root.querySelectorAll('input[name="tri-player-color"]').forEach((input) => {
      input.addEventListener('change', () => this.onModeSettingsChanged());
    });
    this.difficultyEl?.addEventListener('change', () => {
      this.difficulty = this.difficultyEl?.value ?? 'medium';
    });
    this.onModeSettingsChanged(false);

    this.raf = requestAnimationFrame(this.animate);
    this.maybeRunComputer();
  }

  onModeSettingsChanged(triggerReset = true) {
    const modeInput = this.root.querySelector('input[name="tri-mode"]:checked');
    this.playMode = modeInput?.value === 'computer' ? 'computer' : 'human';
    this.computerOptionsEl?.classList.toggle('hidden', this.playMode !== 'computer');
    this.difficulty = this.difficultyEl?.value ?? 'medium';
    if (this.playMode === 'human') {
      this.setThinking(false);
      cancelTriSearch();
      return;
    }
    const colorInput = this.root.querySelector('input[name="tri-player-color"]:checked');
    const picked = colorInput?.value;
    if (picked === 'w' || picked === 'b') {
      this.humanColor = picked;
    }
    if (triggerReset) {
      this.resetGame();
    }
  }

  isComputerEnabled() {
    return this.playMode === 'computer';
  }

  engineColor() {
    return this.humanColor === 'w' ? 'b' : 'w';
  }

  isHumanTurn() {
    return this.state.turn === this.humanColor;
  }

  isInputLocked() {
    return this.thinking || (this.isComputerEnabled() && !this.isHumanTurn()) || this.state.status !== 'active';
  }

  setThinking(active) {
    this.thinking = active;
    this.thinkingEl?.classList.toggle('hidden', !active);
    this.root.classList.toggle('tri-thinking', active);
    if (this.undoBtn) this.undoBtn.disabled = active || this.state.position.history.length === 0;
    if (this.newGameBtn) this.newGameBtn.disabled = active;
    if (this.resignBtn) this.resignBtn.disabled = active;
    if (this.relocateBtn) this.relocateBtn.disabled = active;
  }

  pickHumanColorForNewGame() {
    const colorInput = this.root.querySelector('input[name="tri-player-color"]:checked');
    if (colorInput?.value === 'random') {
      this.humanColor = Math.random() < 0.5 ? 'w' : 'b';
    } else if (colorInput?.value === 'b') {
      this.humanColor = 'b';
    } else {
      this.humanColor = 'w';
    }
  }

  async maybeRunComputer() {
    if (!this.isComputerEnabled()) return;
    if (this.state.status !== 'active') return;
    if (this.state.turn !== this.engineColor()) return;
    if (this.thinking) return;

    this.searchToken = beginTriSearchToken();
    const token = this.searchToken;
    this.setThinking(true);
    this.state.clearSelection();
    this.legalTargets.clear();
    this.applyHighlights();

    let moveResult;
    try {
      moveResult = await chooseTriComputerMove(
        this.state,
        this.difficulty,
        this.engineColor(),
        token,
      );
    } catch {
      if (isTriSearchTokenCurrent(token)) this.setThinking(false);
      return;
    }

    const { move, stale } = moveResult;

    if (!isTriSearchTokenCurrent(token) || stale) {
      if (isTriSearchTokenCurrent(token)) this.setThinking(false);
      return;
    }

    if (!move || this.state.status !== 'active') {
      this.setThinking(false);
      return;
    }

    if (!applyValidatedTriMove(this.state, move)) {
      this.setThinking(false);
      this.setStatus('Computer-Zug ungültig – bitte erneut versuchen.');
      return;
    }

    if (move.kind === 'relocate_attack') {
      syncAttackBoardGeometry(this.cellMeshes, this.state.attackSlots);
      this.syncPieces(true, { relocatedBoard: move.boardIndex });
    } else {
      this.syncPieces(true, { fromKey: move.from, toKey: move.to });
    }
    this.refreshHud();
    this.setThinking(false);
    this.setStatus(this.turnStatusText());
    if (this.isComputerEnabled() && this.state.status === 'active' && this.state.turn === this.engineColor()) {
      this.maybeRunComputer();
    }
  }

  executeHumanMoveSideEffects(result) {
    if (result.kind !== 'moved' && result.kind !== 'relocated') return;
    this.refreshHud();
    this.setStatus(this.turnStatusText());
    if (result.kind === 'relocated') {
      syncAttackBoardGeometry(this.cellMeshes, this.state.attackSlots);
      this.syncPieces(true, { relocatedBoard: result.move.boardIndex });
    } else if (result.kind === 'moved') {
      this.syncPieces(true, { fromKey: result.move.from, toKey: result.move.to });
    }
    this.maybeRunComputer();
  }

  toggleRelocateMode() {
    if (this.isInputLocked()) return;
    this.relocateMode = !this.relocateMode;
    this.state.clearSelection();
    this.legalTargets.clear();
    this.applyHighlights();
    this.setStatus(
      this.relocateMode
        ? 'Angriffsbrett antippen (LOW ↔ HIGH). Nur wenn keine gegnerischen Figuren darauf stehen.'
        : this.turnStatusText(),
    );
    this.relocateBtn?.classList.toggle('btn-active', this.relocateMode);
  }

  handleUndo() {
    if (this.thinking) return;
    cancelTriSearch();
    this.searchToken = beginTriSearchToken();
    if (!this.state.undo()) return;
    this.relocateMode = false;
    this.relocateBtn?.classList.remove('btn-active');
    syncAttackBoardGeometry(this.cellMeshes, this.state.attackSlots);
    this.syncPieces(false);
    this.refreshHud();
    this.setStatus('Zug zurückgenommen.');
    this.maybeRunComputer();
  }

  handleResign() {
    if (this.isInputLocked()) return;
    cancelTriSearch();
    this.searchToken = beginTriSearchToken();
    if (this.state.status !== 'active') return;
    const side = this.state.turn;
    this.state.resignSide(side);
    this.relocateMode = false;
    this.syncPieces(false);
    this.refreshHud();
    this.setStatus(side === 'w' ? 'Weiß gibt auf. Schwarz gewinnt.' : 'Schwarz gibt auf. Weiß gewinnt.');
  }

  resetGame() {
    cancelTriSearch();
    this.searchToken = beginTriSearchToken();
    this.setThinking(false);
    if (this.isComputerEnabled()) {
      this.pickHumanColorForNewGame();
    }
    this.state.reset();
    this.relocateMode = false;
    this.relocateBtn?.classList.remove('btn-active');
    this.animations = [];
    syncAttackBoardGeometry(this.cellMeshes, this.state.attackSlots);
    this.syncPieces(false);
    this.refreshHud();
    const side = this.isComputerEnabled()
      ? `Neue Partie · Du spielst ${this.humanColor === 'w' ? 'Weiß' : 'Schwarz'}.`
      : 'Neue 3D-Partie gestartet. Weiß am Zug.';
    this.setStatus(side);
    this.maybeRunComputer();
  }

  dispose() {
    cancelTriSearch();
    document.body.classList.remove('tri-mode');
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
    const dt = this.clock.getDelta();
    for (let i = this.animations.length - 1; i >= 0; i -= 1) {
      const anim = this.animations[i];
      anim.elapsed += dt;
      const t = Math.min(1, anim.elapsed / anim.duration);
      const eased = t * t * (3 - 2 * t);
      anim.group.position.lerpVectors(anim.from, anim.to, eased);
      if (t >= 1) {
        anim.onDone?.();
        this.animations.splice(i, 1);
      }
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * @param {boolean} animateMoves
   * @param {{ fromKey?: string, toKey?: string, relocatedBoard?: number }} animHint
   */
  syncPieces(animateMoves = false, animHint = {}) {
    const slots = this.state.attackSlots;
    const nextKeys = new Set(this.state.pieces.keys());

    if (animateMoves && animHint.fromKey && animHint.toKey && this.pieceMeshes.has(animHint.fromKey)) {
      const group = this.pieceMeshes.get(animHint.fromKey);
      this.pieceMeshes.delete(animHint.fromKey);
      if (group) {
        group.userData.cellKey = animHint.toKey;
        this.pieceMeshes.set(animHint.toKey, group);
      }
    }

    for (const key of [...this.pieceMeshes.keys()]) {
      if (!nextKeys.has(key)) {
        const mesh = this.pieceMeshes.get(key);
        if (mesh) this.scene?.remove(mesh);
        this.pieceMeshes.delete(key);
      }
    }

    for (const [key, piece] of this.state.pieces.entries()) {
      const coord = parseCoordKey(key);
      if (!coord) continue;
      const selected = this.state.selectedKey === key;
      let group = this.pieceMeshes.get(key);

      if (!group) {
        group = createPieceMesh(piece, selected);
        group.userData.cellKey = key;
        placeGroupAtCoord(group, coord, slots);
        this.scene?.add(group);
        this.pieceMeshes.set(key, group);
        continue;
      }

      this.updatePieceSelectionVisual(group, piece, selected);
      const target = new THREE.Vector3();
      const world = coordToWorld(coord, slots);
      target.set(world.wx, world.wy + 0.08, world.wz);

      const shouldAnimate =
        animateMoves &&
        ((animHint.fromKey === key && animHint.toKey) ||
          (animHint.relocatedBoard != null && coord.surface === 'attack' && coord.z === animHint.relocatedBoard));

      if (shouldAnimate && animHint.fromKey === key && animHint.toKey) {
        const from = group.position.clone();
        this.animations.push({
          group,
          from,
          to: target.clone(),
          elapsed: 0,
          duration: 0.28,
        });
      } else if (shouldAnimate && animHint.relocatedBoard != null) {
        const from = group.position.clone();
        this.animations.push({
          group,
          from,
          to: target.clone(),
          elapsed: 0,
          duration: 0.35,
        });
      } else {
        group.position.copy(target);
      }
    }

    this.applyHighlights();
  }

  updatePieceSelectionVisual(group, piece, selected) {
    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || !(obj.material instanceof THREE.MeshStandardMaterial)) return;
      const accent = piece.color === 'w' ? 0x66ccff : 0x8844ff;
      obj.material.emissive.setHex(selected ? accent : 0x000000);
      obj.material.emissiveIntensity = selected ? 0.45 : 0;
    });
  }

  applyHighlights() {
    for (const tile of this.cellMeshes.values()) {
      if (tile.material instanceof THREE.MeshStandardMaterial) {
        tile.material.emissive.setHex(0x000000);
        tile.material.emissiveIntensity = 0;
      }
    }

    const paint = (key, kind) => {
      const tile = this.cellMeshes.get(key);
      const spec = HIGHLIGHT[kind];
      if (tile && tile.material instanceof THREE.MeshStandardMaterial && spec) {
        tile.material.emissive.setHex(spec.color);
        tile.material.emissiveIntensity = spec.intensity;
      }
    };

    const last = this.state.lastMove;
    if (last && last.from && last.to) {
      paint(last.from, 'last');
      paint(last.to, 'last');
    }

    if (this.state.selectedKey) {
      paint(this.state.selectedKey, 'selected');
    }

    for (const [key, kind] of this.legalTargets.entries()) {
      paint(key, kind);
    }

    for (const color of ['w', 'b']) {
      if (!isInCheck(this.state.position, color)) continue;
      for (const [key, piece] of this.state.pieces.entries()) {
        if (piece.type === 'k' && piece.color === color) {
          paint(key, 'check');
        }
      }
    }
  }

  refreshHud() {
    if (this.hud.topPiecesEl && this.hud.bottomPiecesEl) {
      renderTriCapturedDisplay(this.state, this.hud);
    }
    if (this.hud.moveListEl) {
      renderTriMoveList(this.state, this.hud.moveListEl);
    }
    if (this.undoBtn) {
      this.undoBtn.disabled =
        this.thinking || this.state.position.history.length === 0 || this.state.status !== 'active';
    }
  }

  turnStatusText() {
    if (this.state.status === 'checkmate') {
      return `Schachmatt. ${this.state.winner === 'w' ? 'Weiß' : 'Schwarz'} gewinnt.`;
    }
    if (this.state.status === 'stalemate') {
      return 'Patt · Remis.';
    }
    if (this.state.status === 'resigned') {
      return `${this.state.winner === 'w' ? 'Weiß' : 'Schwarz'} gewinnt durch Aufgabe.`;
    }
    const side = this.state.turn === 'w' ? 'Weiß' : 'Schwarz';
    const check = isInCheck(this.state.position, this.state.turn);
    return check ? `${side} am Zug · Schach!` : `${side} am Zug`;
  }

  onPointerUp(event) {
    if (!this.controls || !this.camera || !this.renderer) return;
    if (this.controls.consumeTapGesture()) return;
    if (this.isInputLocked() && !this.relocateMode) return;
    if (this.state.status !== 'active' && !this.relocateMode) return;

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
      const nearest = worldToNearestCell(
        { wx: world.x, wy: world.y, wz: world.z },
        this.state.attackSlots,
      );
      if (nearest) {
        cellKey = coordKey(nearest);
      }
    }

    if (!cellKey) return;
    const coord = parseCoordKey(cellKey);
    if (!coord) return;

    if (this.relocateMode && coord.surface === 'attack') {
      const result = this.state.relocateAttackBoard(coord.z);
      if (result.kind === 'relocated') {
        this.relocateMode = false;
        this.relocateBtn?.classList.remove('btn-active');
        this.executeHumanMoveSideEffects(result);
      } else {
        this.setStatus('Angriffsbrett kann jetzt nicht bewegt werden.');
      }
      return;
    }

    if (this.isInputLocked()) return;
    const result = this.state.selectOrMove(coord);

    if (result.kind === 'selected') {
      this.legalTargets.clear();
      for (const move of result.legal ?? []) {
        if (move.to) {
          this.legalTargets.set(move.to, move.capture ? 'capture' : 'move');
        }
      }
      this.syncPieces(false);
      this.setStatus(this.turnStatusText());
      return;
    }

    if (result.kind === 'cleared') {
      this.legalTargets.clear();
      this.syncPieces(false);
      this.setStatus(this.turnStatusText());
      return;
    }

    if (result.kind === 'illegal' || result.kind === 'ignored') {
      return;
    }

    if (result.kind === 'moved') {
      this.legalTargets.clear();
      this.executeHumanMoveSideEffects(result);
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
