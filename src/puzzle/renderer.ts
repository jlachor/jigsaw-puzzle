import { tracePieceOutline } from './generator'
import { drawPieces, drawPieceHighlight } from './piece'
import type { PieceCanvas, PiecePosition } from './piece'
import type { ViewTransform } from './viewport'

export interface SnapFlash {
  pieces: number[]
  startTime: number
}

export interface MarqueeRect {
  startX: number
  startY: number
  endX: number
  endY: number
}

/** Draw the full board: background, pieces, highlights, selection, snap flash, marquee. */
export function drawBoard(
  ctx: CanvasRenderingContext2D,
  t: ViewTransform,
  pieces: PieceCanvas[],
  positions: PiecePosition[],
  drawOrder: number[],
  opts: {
    dragMembers?: number[]
    selectedPieces?: Set<number>
    snapFlash?: SnapFlash | null
    marquee?: MarqueeRect | null
    scheduleRedraw?: () => void
  },
): { flashExpired: boolean } {
  let flashExpired = false

  // Draw pieces
  drawPieces(ctx, pieces, positions, drawOrder, t.offsetX, t.offsetY, t.scale)

  // Highlight dragged piece/group (yellow)
  if (opts.dragMembers) {
    for (const mi of opts.dragMembers) {
      drawPieceHighlight(ctx, pieces[mi], positions[mi], t.offsetX, t.offsetY, t.scale)
    }
  }

  // Highlight selected pieces (blue glow)
  const selected = opts.selectedPieces
  if (selected && selected.size > 0) {
    for (const pi of selected) {
      const p = pieces[pi]
      const pos = positions[pi]
      const srcCellW = p.canvas.width - 2 * p.padX
      const srcCellH = p.canvas.height - 2 * p.padY
      tracePieceOutline(
        ctx,
        t.offsetX + pos.x * t.scale,
        t.offsetY + pos.y * t.scale,
        srcCellW * t.scale, srcCellH * t.scale,
        p.edges,
      )
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)'
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(100, 180, 255, 0.5)'
      ctx.shadowBlur = 10
      ctx.stroke()
    }
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }

  // Snap flash: green glow that fades over 300ms
  const flash = opts.snapFlash
  if (flash) {
    const elapsed = performance.now() - flash.startTime
    const duration = 300
    if (elapsed < duration) {
      const alpha = 0.6 * (1 - elapsed / duration)
      for (const fi of flash.pieces) {
        const p = pieces[fi]
        const pos = positions[fi]
        const srcCellW = p.canvas.width - 2 * p.padX
        const srcCellH = p.canvas.height - 2 * p.padY
        tracePieceOutline(
          ctx,
          t.offsetX + pos.x * t.scale,
          t.offsetY + pos.y * t.scale,
          srcCellW * t.scale, srcCellH * t.scale,
          p.edges,
        )
        ctx.strokeStyle = `rgba(100, 255, 100, ${alpha})`
        ctx.lineWidth = 3
        ctx.shadowColor = `rgba(100, 255, 100, ${alpha})`
        ctx.shadowBlur = 16
        ctx.stroke()
      }
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      opts.scheduleRedraw?.()
    } else {
      flashExpired = true
    }
  }

  // Draw marquee rectangle
  const mq = opts.marquee
  if (mq) {
    const x = Math.min(mq.startX, mq.endX)
    const y = Math.min(mq.startY, mq.endY)
    const w = Math.abs(mq.endX - mq.startX)
    const h = Math.abs(mq.endY - mq.startY)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.lineWidth = 1
    ctx.setLineDash([6, 3])
    ctx.strokeRect(x, y, w, h)
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(100, 180, 255, 0.1)'
    ctx.fillRect(x, y, w, h)
  }

  return { flashExpired }
}
