import type { PiecePosition } from './piece'

/**
 * Group state: maps each piece index to its group ID.
 * Initially every piece is its own group (groupOf[i] === i).
 */
export interface GroupState {
  /** piece index → group ID */
  groupOf: number[]
}

/** Create initial state where every piece is its own group. */
export function createGroups(count: number): GroupState {
  return { groupOf: Array.from({ length: count }, (_, i) => i) }
}

/** Get the group ID for a piece. */
export function groupOf(state: GroupState, pieceIndex: number): number {
  return state.groupOf[pieceIndex]
}

/** Get all piece indices that belong to the same group as the given piece. */
export function getGroupMembers(state: GroupState, pieceIndex: number): number[] {
  const gid = state.groupOf[pieceIndex]
  const members: number[] = []
  for (let i = 0; i < state.groupOf.length; i++) {
    if (state.groupOf[i] === gid) members.push(i)
  }
  return members
}

/** Move all pieces in a group by a delta in source-image coordinates. */
export function moveGroup(
  state: GroupState,
  positions: PiecePosition[],
  pieceIndex: number,
  dx: number,
  dy: number,
): void {
  const members = getGroupMembers(state, pieceIndex)
  for (const i of members) {
    positions[i] = { x: positions[i].x + dx, y: positions[i].y + dy }
  }
}

/** Bring all pieces in a group to the front of the draw order. */
export function bringGroupToFront(
  state: GroupState,
  drawOrder: number[],
  pieceIndex: number,
): void {
  const members = new Set(getGroupMembers(state, pieceIndex))
  const rest: number[] = []
  const grouped: number[] = []
  for (const i of drawOrder) {
    if (members.has(i)) grouped.push(i)
    else rest.push(i)
  }
  drawOrder.length = 0
  drawOrder.push(...rest, ...grouped)
}

/**
 * Get the grid neighbors of a single piece.
 * Returns piece indices of the up/down/left/right neighbors (only those that exist).
 *
 * Snap checks are always piece-to-piece: for each piece in a group, we check
 * whether each of its individual grid neighbors is close enough to snap.
 * We never check distance to a group as a whole.
 */
export function getGridNeighbors(
  pieceIndex: number,
  cols: number,
  rows: number,
): number[] {
  const col = pieceIndex % cols
  const row = Math.floor(pieceIndex / cols)
  const neighbors: number[] = []
  if (col > 0) neighbors.push(pieceIndex - 1)       // left
  if (col < cols - 1) neighbors.push(pieceIndex + 1) // right
  if (row > 0) neighbors.push(pieceIndex - cols)     // top
  if (row < rows - 1) neighbors.push(pieceIndex + cols) // bottom
  return neighbors
}

/**
 * Try to snap neighbors to the dropped piece (anchor).
 * The dropped piece stays put. Each grid-adjacent neighbor within half a cell
 * distance is moved to align with the anchor. Supports multi-directional snap
 * (e.g. left AND top neighbor can both snap at once).
 *
 * Returns the indices of all neighbors that were snapped.
 */
export function trySnap(
  positions: PiecePosition[],
  pieceIndex: number,
  cols: number,
  rows: number,
  cellW: number,
  cellH: number,
): number[] {
  const pos = positions[pieceIndex]
  const col = pieceIndex % cols
  const row = Math.floor(pieceIndex / cols)
  const threshold = Math.min(cellW, cellH) / 2

  const neighbors = getGridNeighbors(pieceIndex, cols, rows)
  const snapped: number[] = []

  for (const ni of neighbors) {
    const nPos = positions[ni]
    const nCol = ni % cols
    const nRow = Math.floor(ni / cols)

    // Where the neighbor should be, relative to the anchor piece
    const expectedX = pos.x + (nCol - col) * cellW
    const expectedY = pos.y + (nRow - row) * cellH

    const dx = nPos.x - expectedX
    const dy = nPos.y - expectedY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < threshold) {
      positions[ni] = { x: expectedX, y: expectedY }
      snapped.push(ni)
    }
  }

  return snapped
}
