# Chess-game Tri-Dimensional Chess – Rules (Phase 2)

This project implements **Chess-game Tri-Dimensional Chess (CG-TDC) v1**.

It is inspired by multi-level Tri-Dimensional Chess concepts (Star Trek / Andrew Bartmess lineage) but **is not** an official Bartmess rules implementation. The exact variant is defined in code: `src/tridimensional/rules/cgTdcV1Rules.js`.

## Board

- **3 main levels** (`z = 0..2`), each **8×8** (`x`, `y`).
- **4 attack boards** (`surface = attack`, index `z = 0..3`), each **2×2**.

## Start

- White: standard chess array on **main `z=0`** (ranks `y=0,1`).
- Black: standard chess array on **main `z=2`** (ranks `y=6,7`).
- Attack boards start **empty**.

## Movement (summary)

| Piece | Same main level | Vertical (main) | Attack board |
|------|-----------------|-----------------|--------------|
| Pawn | Orthodox | No | Via gateways only |
| Knight | Orthodox | No | Mini-board orthogonal jumps |
| Bishop | Diagonals on level | No | Mini diagonals |
| Rook | Orthogonal on level | Same `(x,y)` through `z` | Mini orthogonals |
| Queen | R+B on level | Same as rook vertical | Combined mini |
| King | 1 square (incl. diagonals) | ±1 `z` at same `(x,y)` | 1 square + gateways |

**Gateways** (one-step transfers) are listed in `GATEWAYS` inside `cgTdcV1Rules.js`.

**Castling / en passant:** disabled in v1.

**Promotion:** pawn reaching last rank on its main level becomes a queen.

## Attack board relocation

A player may relocate an attack board between **LOW/HIGH** slot on its mast as a full turn when the board contains **at least one friendly piece** and **no opponent pieces**.

## End conditions

- **Check / checkmate / stalemate** derived from the 3D move engine (king may not move into check).
- **Resignation** via UI.

## Engine separation

3D rules live in `src/tridimensional/rules/moveEngine.js` and are **independent from chess.js** (classic mode only).
