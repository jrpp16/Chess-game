import * as THREE from 'three';
import { coordKey } from '../board/coordinates.js';
import { coordToWorld, getAllBoardCells } from '../board/boardLayout.js';

/**
 * @param {import('../gameState/triGameState.js').Piece} piece
 * @param {boolean} selected
 */
export function createPieceMesh(piece, selected = false) {
  const group = new THREE.Group();
  const color = piece.color === 'w' ? 0xdde8ff : 0x1a2233;
  const accent = piece.color === 'w' ? 0x66ccff : 0x8844ff;
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.65,
    roughness: 0.28,
    emissive: selected ? accent : 0x000000,
    emissiveIntensity: selected ? 0.45 : 0,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.12, 20), material);
  base.position.y = 0.06;
  group.add(base);

  let body;
  switch (piece.type) {
    case 'k':
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.55, 16), material);
      body.position.y = 0.42;
      group.add(body);
      break;
    case 'q':
      body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), material);
      body.position.y = 0.42;
      group.add(body);
      break;
    case 'r':
      body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), material);
      body.position.y = 0.38;
      group.add(body);
      break;
    case 'b':
      body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.52, 16), material);
      body.position.y = 0.4;
      group.add(body);
      break;
    case 'n':
      body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.22), material);
      body.position.set(0.04, 0.36, 0);
      body.rotation.y = 0.45;
      group.add(body);
      break;
    default:
      body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), material);
      body.position.y = 0.28;
      group.add(body);
  }

  group.userData.selectable = true;
  return group;
}

export function createBoardMeshes(scene) {
  const lightSquare = new THREE.MeshStandardMaterial({
    color: 0x6eb5ff,
    metalness: 0.35,
    roughness: 0.45,
    transparent: true,
    opacity: 0.88,
  });
  const darkSquare = new THREE.MeshStandardMaterial({
    color: 0x1b3f72,
    metalness: 0.45,
    roughness: 0.38,
    transparent: true,
    opacity: 0.92,
  });
  const attackMat = new THREE.MeshStandardMaterial({
    color: 0x355f9c,
    metalness: 0.55,
    roughness: 0.35,
    transparent: true,
    opacity: 0.85,
  });

  const cellMeshes = new Map();

  for (const cell of getAllBoardCells()) {
    const world = coordToWorld(cell);
    const isAttack = cell.surface === 'attack';
    const isLight = (cell.x + cell.y + cell.z) % 2 === 0;
    const mat = isAttack ? attackMat : isLight ? lightSquare : darkSquare;
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.9), mat);
    tile.position.set(world.wx, world.wy, world.wz);
    tile.userData.cellKey = coordKey(cell);
    tile.userData.selectable = false;
    scene.add(tile);
    cellMeshes.set(coordKey(cell), tile);
  }

  return cellMeshes;
}

/**
 * @param {THREE.Group} group
 * @param {import('../board/coordinates.js').TriCoord} coord
 */
export function placeGroupAtCoord(group, coord) {
  const world = coordToWorld(coord);
  group.position.set(world.wx, world.wy + 0.08, world.wz);
}

export function pickWorldPoint(clientX, clientY, camera, renderer) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, target);
  return target;
}
