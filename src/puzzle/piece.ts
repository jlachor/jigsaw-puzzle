import type { EdgeData, PieceEdges } from './generator'
import { getPieceEdges, tracePieceOutline } from './generator'

export interface PieceCanvas {
  canvas: HTMLCanvasElement
  col: number
  row: number
  /** Padding around the cell in source-image pixels (space for tabs) */
  padX: number
  padY: number
  /** Edge shape data, needed for hit testing */
  edges: PieceEdges
}

/**
 * Pre-render every piece to its own offscreen canvas at source-image resolution.
 * Each canvas is sized to the cell + padding for tabs on all sides.
 */
export function renderAllPieces(
  image: HTMLImageElement,
  cols: number,
  rows: number,
  edgeData: EdgeData,
): PieceCanvas[] {
  const srcCellW = image.naturalWidth / cols
  const srcCellH = image.naturalHeight / rows
  const padX = srcCellW / 4
  const padY = srcCellH / 4

  const pieces: PieceCanvas[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const edges = getPieceEdges(col, row, cols, rows, edgeData)

      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(srcCellW + 2 * padX)
      canvas.height = Math.ceil(srcCellH + 2 * padY)
      const ctx = canvas.getContext('2d')!

      // Clip to jigsaw outline
      tracePieceOutline(ctx, padX, padY, srcCellW, srcCellH, edges)
      ctx.save()
      ctx.clip()

      // Draw source image positioned so this cell aligns with (padX, padY)
      ctx.drawImage(image, padX - col * srcCellW, padY - row * srcCellH)
      ctx.restore()

      // Stroke outline for definition
      tracePieceOutline(ctx, padX, padY, srcCellW, srcCellH, edges)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.lineWidth = 2
      ctx.stroke()

      pieces.push({ canvas, col, row, padX, padY, edges })
    }
  }

  return pieces
}

export interface PiecePosition {
  /** X of the cell top-left in source-image pixels */
  x: number
  /** Y of the cell top-left in source-image pixels */
  y: number
}

/** Compute assembled grid positions (for preview mode). */
export function getGridPositions(pieces: PieceCanvas[]): PiecePosition[] {
  return pieces.map(p => {
    const srcCellW = p.canvas.width - 2 * p.padX
    const srcCellH = p.canvas.height - 2 * p.padY
    return { x: p.col * srcCellW, y: p.row * srcCellH }
  })
}

/** Scatter pieces randomly over an area 3x the image size. */
export function getScatteredPositions(
  pieces: PieceCanvas[],
  imageW: number,
  imageH: number,
): PiecePosition[] {
  const areaW = imageW * 3
  const areaH = imageH * 3
  const originX = -imageW  // center the 3x area around the image
  const originY = -imageH
  const margin = Math.min(imageW, imageH) * 0.03
  return pieces.map(p => {
    const srcCellW = p.canvas.width - 2 * p.padX
    const srcCellH = p.canvas.height - 2 * p.padY
    return {
      x: originX + margin + Math.random() * (areaW - srcCellW - 2 * margin),
      y: originY + margin + Math.random() * (areaH - srcCellH - 2 * margin),
    }
  })
}

/**
 * Hit-test pieces in reverse draw order (topmost first).
 * Returns the index of the hit piece, or -1 if none.
 */
export function hitTestPieces(
  ctx: CanvasRenderingContext2D,
  pieces: PieceCanvas[],
  positions: PiecePosition[],
  drawOrder: number[],
  offsetX: number,
  offsetY: number,
  scale: number,
  mouseX: number,
  mouseY: number,
): number {
  for (let j = drawOrder.length - 1; j >= 0; j--) {
    const i = drawOrder[j]
    const p = pieces[i]
    const pos = positions[i]
    const srcCellW = p.canvas.width - 2 * p.padX
    const srcCellH = p.canvas.height - 2 * p.padY
    const cellX = offsetX + pos.x * scale
    const cellY = offsetY + pos.y * scale

    tracePieceOutline(ctx, cellX, cellY, srcCellW * scale, srcCellH * scale, p.edges)
    if (ctx.isPointInPath(mouseX, mouseY)) {
      return i
    }
  }
  return -1
}

/** Draw a highlight glow around a piece. */
export function drawPieceHighlight(
  ctx: CanvasRenderingContext2D,
  piece: PieceCanvas,
  pos: PiecePosition,
  offsetX: number,
  offsetY: number,
  scale: number,
): void {
  const srcCellW = piece.canvas.width - 2 * piece.padX
  const srcCellH = piece.canvas.height - 2 * piece.padY
  const cellX = offsetX + pos.x * scale
  const cellY = offsetY + pos.y * scale

  tracePieceOutline(ctx, cellX, cellY, srcCellW * scale, srcCellH * scale, piece.edges)
  ctx.strokeStyle = 'rgba(255, 255, 100, 0.8)'
  ctx.lineWidth = 3
  ctx.shadowColor = 'rgba(255, 255, 100, 0.6)'
  ctx.shadowBlur = 12
  ctx.stroke()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
}

/** Draw all pre-rendered pieces at given positions on the main canvas. */
export function drawPieces(
  ctx: CanvasRenderingContext2D,
  pieces: PieceCanvas[],
  positions: PiecePosition[],
  drawOrder: number[],
  offsetX: number,
  offsetY: number,
  scale: number,
): void {
  for (const i of drawOrder) {
    const p = pieces[i]
    const pos = positions[i]
    ctx.drawImage(
      p.canvas,
      offsetX + pos.x * scale - p.padX * scale,
      offsetY + pos.y * scale - p.padY * scale,
      p.canvas.width * scale,
      p.canvas.height * scale,
    )
  }
}
