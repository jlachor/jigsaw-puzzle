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

/** Traces the jigsaw piece outline as a path (beginPath → closePath), without stroking or filling. */
export function tracePieceOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  edges: PieceEdges,
): void {
  const tabW = cellW / 4
  const tabH = cellH / 4
  const hStart = cellW * 3 / 8
  const hEnd = cellW * 5 / 8
  const vStart = cellH * 3 / 8
  const vEnd = cellH * 5 / 8
  const neck = 0.4
  const headSpread = cellW * 0.15
  const headSpreadV = cellH * 0.15

  ctx.beginPath()

  // Top edge: left to right
  ctx.moveTo(x, y)
  if (edges.top === 0) {
    ctx.lineTo(x + cellW, y)
  } else {
    const d = -edges.top * tabH
    ctx.lineTo(x + hStart, y)
    ctx.bezierCurveTo(
      x + hStart, y + d * neck,
      x + hStart - headSpread, y + d,
      x + cellW * 0.5, y + d,
    )
    ctx.bezierCurveTo(
      x + hEnd + headSpread, y + d,
      x + hEnd, y + d * neck,
      x + hEnd, y,
    )
    ctx.lineTo(x + cellW, y)
  }

  // Right edge: top to bottom
  if (edges.right === 0) {
    ctx.lineTo(x + cellW, y + cellH)
  } else {
    const d = edges.right * tabW
    ctx.lineTo(x + cellW, y + vStart)
    ctx.bezierCurveTo(
      x + cellW + d * neck, y + vStart,
      x + cellW + d, y + vStart - headSpreadV,
      x + cellW + d, y + cellH * 0.5,
    )
    ctx.bezierCurveTo(
      x + cellW + d, y + vEnd + headSpreadV,
      x + cellW + d * neck, y + vEnd,
      x + cellW, y + vEnd,
    )
    ctx.lineTo(x + cellW, y + cellH)
  }

  // Bottom edge: right to left
  if (edges.bottom === 0) {
    ctx.lineTo(x, y + cellH)
  } else {
    const d = edges.bottom * tabH
    ctx.lineTo(x + hEnd, y + cellH)
    ctx.bezierCurveTo(
      x + hEnd, y + cellH + d * neck,
      x + hEnd + headSpread, y + cellH + d,
      x + cellW * 0.5, y + cellH + d,
    )
    ctx.bezierCurveTo(
      x + hStart - headSpread, y + cellH + d,
      x + hStart, y + cellH + d * neck,
      x + hStart, y + cellH,
    )
    ctx.lineTo(x, y + cellH)
  }

  // Left edge: bottom to top
  if (edges.left === 0) {
    ctx.lineTo(x, y)
  } else {
    const d = -edges.left * tabW
    ctx.lineTo(x, y + vEnd)
    ctx.bezierCurveTo(
      x + d * neck, y + vEnd,
      x + d, y + vEnd + headSpreadV,
      x + d, y + cellH * 0.5,
    )
    ctx.bezierCurveTo(
      x + d, y + vStart - headSpreadV,
      x + d * neck, y + vStart,
      x, y + vStart,
    )
    ctx.lineTo(x, y)
  }

  ctx.closePath()
}

export function drawPieceOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  edges: PieceEdges,
): void {
  tracePieceOutline(ctx, x, y, cellW, cellH, edges)
  ctx.stroke()
}
