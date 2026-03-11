import { useRef, useEffect, useState, useMemo } from 'preact/hooks'
import { generateEdges } from './puzzle/generator'
import {
  renderAllPieces,
  getGridPositions,
  getScatteredPositions,
  drawPieces,
  hitTestPieces,
  drawPieceHighlight,
} from './puzzle/piece'
import type { PiecePosition } from './puzzle/piece'
import './app.css'

interface DragState {
  pieceIndex: number
  /** Offset between mouse and piece position, in source-image coords */
  offsetX: number
  offsetY: number
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(3)
  const [seed, setSeed] = useState(0)
  const [started, setStarted] = useState(false)
  const positionsRef = useRef<PiecePosition[]>([])
  const drawOrderRef = useRef<number[]>([])
  const dragRef = useRef<DragState | null>(null)
  const redrawRef = useRef<(() => void) | null>(null)

  const edges = useMemo(
    () => image ? generateEdges(cols, rows) : null,
    [cols, rows, seed, image],
  )

  const pieces = useMemo(
    () => (image && edges) ? renderAllPieces(image, cols, rows, edges) : null,
    [image, cols, rows, edges],
  )

  // Keep grid positions and draw order in sync during preview
  useEffect(() => {
    if (pieces && !started) {
      positionsRef.current = getGridPositions(pieces)
      drawOrderRef.current = pieces.map((_, i) => i)
    }
  }, [pieces, started])

  const reshuffle = () => setSeed(s => s + 1)

  const handleStart = () => {
    if (!pieces || !image) return
    positionsRef.current = getScatteredPositions(
      pieces,
      image.naturalWidth,
      image.naturalHeight,
    )
    drawOrderRef.current = pieces.map((_, i) => i)
    setStarted(true)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const getTransform = () => {
      if (!image) return null
      const maxW = canvas.width * 0.8
      const maxH = canvas.height * 0.8
      const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight)
      const drawW = image.naturalWidth * scale
      const drawH = image.naturalHeight * scale
      return {
        scale,
        offsetX: (canvas.width - drawW) / 2,
        offsetY: (canvas.height - drawH) / 2,
      }
    }

    const redraw = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#2d5a3d'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (pieces && positionsRef.current.length > 0) {
        const t = getTransform()
        if (!t) return

        drawPieces(ctx, pieces, positionsRef.current, drawOrderRef.current, t.offsetX, t.offsetY, t.scale)

        if (dragRef.current) {
          const di = dragRef.current.pieceIndex
          drawPieceHighlight(
            ctx, pieces[di], positionsRef.current[di],
            t.offsetX, t.offsetY, t.scale,
          )
        }
      }
    }

    redrawRef.current = redraw

    const handleMouseDown = (e: MouseEvent) => {
      if (!started || !pieces) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const t = getTransform()
      if (!t) return

      const hit = hitTestPieces(
        ctx, pieces, positionsRef.current, drawOrderRef.current,
        t.offsetX, t.offsetY, t.scale,
        e.clientX, e.clientY,
      )

      if (hit >= 0) {
        const pos = positionsRef.current[hit]
        dragRef.current = {
          pieceIndex: hit,
          offsetX: pos.x - (e.clientX - t.offsetX) / t.scale,
          offsetY: pos.y - (e.clientY - t.offsetY) / t.scale,
        }

        // Bring to front
        const order = drawOrderRef.current
        const idx = order.indexOf(hit)
        if (idx >= 0) {
          order.splice(idx, 1)
          order.push(hit)
        }

        redraw()
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const t = getTransform()
      if (!t) return

      const { pieceIndex, offsetX: ox, offsetY: oy } = dragRef.current
      positionsRef.current[pieceIndex] = {
        x: (e.clientX - t.offsetX) / t.scale + ox,
        y: (e.clientY - t.offsetY) / t.scale + oy,
      }
      redraw()
    }

    const handleMouseUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      redraw()
    }

    redraw()
    window.addEventListener('resize', redraw)
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('resize', redraw)
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      redrawRef.current = null
    }
  }, [image, pieces, started])

  const handleFile = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      setImage(img)
    }
    img.src = url
  }

  return (
    <>
      <canvas ref={canvasRef} />
      {!image && (
        <div class="upload-overlay">
          <label class="upload-label">
            Choose an image
            <input type="file" accept="image/*" onChange={handleFile} />
          </label>
        </div>
      )}
      {image && !started && (
        <div class="grid-controls">
          <div class="grid-controls-row">
            <label>
              Columns: {cols}
              <input
                type="range"
                min={2}
                max={20}
                value={cols}
                onInput={(e) => setCols(Number((e.target as HTMLInputElement).value))}
              />
            </label>
            <label>
              Rows: {rows}
              <input
                type="range"
                min={2}
                max={20}
                value={rows}
                onInput={(e) => setRows(Number((e.target as HTMLInputElement).value))}
              />
            </label>
            <button class="reshuffle-btn" onClick={reshuffle}>
              Reshuffle
            </button>
            <button class="start-btn" onClick={handleStart}>
              Start
            </button>
          </div>
          <div class="grid-controls-info">
            {cols} &times; {rows} = {cols * rows} pieces
          </div>
        </div>
      )}
    </>
  )
}
