import type { EdgeData } from './generator'
import { getPieceEdges, tracePieceOutline } from './generator'

export interface PieceCanvas {
  canvas: HTMLCanvasElement
  col: number
  row: number
  /** Padding around the cell in source-image pixels (space for tabs) */
  padX: number
  padY: number
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

      pieces.push({ canvas, col, row, padX, padY })
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

/** Scatter pieces randomly within the image bounds. */
export function getScatteredPositions(
  pieces: PieceCanvas[],
  imageW: number,
  imageH: number,
): PiecePosition[] {
  const margin = Math.min(imageW, imageH) * 0.03
  return pieces.map(p => {
    const srcCellW = p.canvas.width - 2 * p.padX
    const srcCellH = p.canvas.height - 2 * p.padY
    return {
      x: margin + Math.random() * (imageW - srcCellW - 2 * margin),
      y: margin + Math.random() * (imageH - srcCellH - 2 * margin),
    }
  })
}

/** Draw all pre-rendered pieces at given positions on the main canvas. */
export function drawPieces(
  ctx: CanvasRenderingContext2D,
  pieces: PieceCanvas[],
  positions: PiecePosition[],
  offsetX: number,
  offsetY: number,
  scale: number,
): void {
  for (let i = 0; i < pieces.length; i++) {
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
