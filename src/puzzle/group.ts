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
 * Try to snap neighbor groups to the anchor group.
 *
 * Checks are piece-to-piece: for each piece in the anchor group, we check each
 * of its grid neighbors individually. But when a match is found, we move the
 * neighbor's **entire group** rigidly so that specific neighbor aligns correctly.
 *
 * The anchor group stays put. Returns the indices of snapped neighbor pieces
 * (one per snapped group).
 */
export function trySnap(
  state: GroupState,
  positions: PiecePosition[],
  pieceIndex: number,
  cols: number,
  rows: number,
  cellW: number,
  cellH: number,
): number[] {
  const threshold = Math.min(cellW, cellH) / 2
  const anchorGid = state.groupOf[pieceIndex]
  const anchorMembers = getGroupMembers(state, pieceIndex)

  const snapped: number[] = []
  const snappedGids = new Set<number>()

  for (const ai of anchorMembers) {
    const aPos = positions[ai]
    const aCol = ai % cols
    const aRow = Math.floor(ai / cols)

    for (const ni of getGridNeighbors(ai, cols, rows)) {
      const nGid = state.groupOf[ni]
      // Skip pieces already in anchor group or in an already-snapped group
      if (nGid === anchorGid || snappedGids.has(nGid)) continue

      const nPos = positions[ni]
      const nCol = ni % cols
      const nRow = Math.floor(ni / cols)

      // Where the neighbor should be, relative to this anchor member
      const expectedX = aPos.x + (nCol - aCol) * cellW
      const expectedY = aPos.y + (nRow - aRow) * cellH

      const dx = nPos.x - expectedX
      const dy = nPos.y - expectedY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < threshold) {
        // Shift the entire neighbor group so this piece aligns
        const nMembers = getGroupMembers(state, ni)
        for (const mi of nMembers) {
          positions[mi] = { x: positions[mi].x - dx, y: positions[mi].y - dy }
        }
        snapped.push(ni)
        snappedGids.add(nGid)
      }
    }
  }

  return snapped
}

/** Check if all pieces belong to a single group (puzzle solved). */
export function isSolved(state: GroupState): boolean {
  if (state.groupOf.length === 0) return false
  const gid = state.groupOf[0]
  for (let i = 1; i < state.groupOf.length; i++) {
    if (state.groupOf[i] !== gid) return false
  }
  return true
}

/**
 * Merge the group of `otherPiece` into the group of `anchorPiece`.
 * All pieces that belonged to otherPiece's group now share anchorPiece's group ID.
 */
export function mergeGroups(
  state: GroupState,
  anchorPiece: number,
  otherPiece: number,
): void {
  const targetGid = state.groupOf[anchorPiece]
  const sourceGid = state.groupOf[otherPiece]
  if (targetGid === sourceGid) return
  for (let i = 0; i < state.groupOf.length; i++) {
    if (state.groupOf[i] === sourceGid) state.groupOf[i] = targetGid
  }
}
