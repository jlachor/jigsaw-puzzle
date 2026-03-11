export type EdgeValue = -1 | 0 | 1

export interface EdgeData {
  hEdges: EdgeValue[][]  // (rows-1) × cols — horizontal edges between rows
  vEdges: EdgeValue[][]  // rows × (cols-1) — vertical edges between columns
}

export interface PieceEdges {
  top: EdgeValue
  right: EdgeValue
  bottom: EdgeValue
  left: EdgeValue
}

function randomDir(): EdgeValue {
  return Math.random() < 0.5 ? 1 : -1
}

export function generateEdges(cols: number, rows: number): EdgeData {
  const hEdges: EdgeValue[][] = []
  for (let row = 0; row < rows - 1; row++) {
    hEdges[row] = []
    for (let col = 0; col < cols; col++) {
      hEdges[row][col] = randomDir()
    }
  }

  const vEdges: EdgeValue[][] = []
  for (let row = 0; row < rows; row++) {
    vEdges[row] = []
    for (let col = 0; col < cols - 1; col++) {
      vEdges[row][col] = randomDir()
    }
  }

  return { hEdges, vEdges }
}

export function getPieceEdges(
  col: number,
  row: number,
  cols: number,
  rows: number,
  edges: EdgeData,
): PieceEdges {
  return {
    top: row === 0 ? 0 : -edges.hEdges[row - 1][col] as EdgeValue,
    bottom: row === rows - 1 ? 0 : edges.hEdges[row][col],
    left: col === 0 ? 0 : -edges.vEdges[row][col - 1] as EdgeValue,
    right: col === cols - 1 ? 0 : edges.vEdges[row][col],
  }
}

export function drawPieceOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  edges: PieceEdges,
): void {
  const tabW = cellW / 4
  const tabH = cellH / 4
  // Tab centered on edge: starts at 3/8, ends at 5/8
  const hStart = cellW * 3 / 8
  const hEnd = cellW * 5 / 8
  const vStart = cellH * 3 / 8
  const vEnd = cellH * 5 / 8

  ctx.beginPath()

  // Top edge: left to right
  ctx.moveTo(x, y)
  if (edges.top === 0) {
    ctx.lineTo(x + cellW, y)
  } else {
    const dir = -edges.top // top: outward is -Y, so +1 tab goes up (negative)
    ctx.lineTo(x + hStart, y)
    ctx.lineTo(x + hStart, y + dir * tabH)
    ctx.lineTo(x + hEnd, y + dir * tabH)
    ctx.lineTo(x + hEnd, y)
    ctx.lineTo(x + cellW, y)
  }

  // Right edge: top to bottom
  if (edges.right === 0) {
    ctx.lineTo(x + cellW, y + cellH)
  } else {
    const dir = edges.right // right: outward is +X
    ctx.lineTo(x + cellW, y + vStart)
    ctx.lineTo(x + cellW + dir * tabW, y + vStart)
    ctx.lineTo(x + cellW + dir * tabW, y + vEnd)
    ctx.lineTo(x + cellW, y + vEnd)
    ctx.lineTo(x + cellW, y + cellH)
  }

  // Bottom edge: right to left
  if (edges.bottom === 0) {
    ctx.lineTo(x, y + cellH)
  } else {
    const dir = edges.bottom // bottom: outward is +Y
    ctx.lineTo(x + hEnd, y + cellH)
    ctx.lineTo(x + hEnd, y + cellH + dir * tabH)
    ctx.lineTo(x + hStart, y + cellH + dir * tabH)
    ctx.lineTo(x + hStart, y + cellH)
    ctx.lineTo(x, y + cellH)
  }

  // Left edge: bottom to top
  if (edges.left === 0) {
    ctx.lineTo(x, y)
  } else {
    const dir = -edges.left // left: outward is -X, so +1 tab goes left (negative)
    ctx.lineTo(x, y + vEnd)
    ctx.lineTo(x + dir * tabW, y + vEnd)
    ctx.lineTo(x + dir * tabW, y + vStart)
    ctx.lineTo(x, y + vStart)
    ctx.lineTo(x, y)
  }

  ctx.closePath()
  ctx.stroke()
}
