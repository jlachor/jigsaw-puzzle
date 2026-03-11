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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(3)
  const [seed, setSeed] = useState(0)
  const [started, setStarted] = useState(false)
  const [selectedPiece, setSelectedPiece] = useState(-1)
  const positionsRef = useRef<PiecePosition[]>([])

  const edges = useMemo(
    () => image ? generateEdges(cols, rows) : null,
    [cols, rows, seed, image],
  )

  const pieces = useMemo(
    () => (image && edges) ? renderAllPieces(image, cols, rows, edges) : null,
    [image, cols, rows, edges],
  )

  // Keep grid positions in sync during preview
  useEffect(() => {
    if (pieces && !started) {
      positionsRef.current = getGridPositions(pieces)
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
    setStarted(true)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const redraw = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#2d5a3d'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (image && pieces && positionsRef.current.length > 0) {
        const maxW = canvas.width * 0.8
        const maxH = canvas.height * 0.8
        const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight)
        const drawW = image.naturalWidth * scale
        const drawH = image.naturalHeight * scale
        const offsetX = (canvas.width - drawW) / 2
        const offsetY = (canvas.height - drawH) / 2

        drawPieces(ctx, pieces, positionsRef.current, offsetX, offsetY, scale)

        if (started && selectedPiece >= 0 && selectedPiece < pieces.length) {
          drawPieceHighlight(
            ctx, pieces[selectedPiece], positionsRef.current[selectedPiece],
            offsetX, offsetY, scale,
          )
        }
      }
    }

    redraw()
    window.addEventListener('resize', redraw)

    const handleClick = (e: MouseEvent) => {
      if (!started || !pieces) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const maxW = canvas.width * 0.8
      const maxH = canvas.height * 0.8
      const scale = Math.min(maxW / image!.naturalWidth, maxH / image!.naturalHeight)
      const drawW = image!.naturalWidth * scale
      const drawH = image!.naturalHeight * scale
      const offsetX = (canvas.width - drawW) / 2
      const offsetY = (canvas.height - drawH) / 2

      const hit = hitTestPieces(
        ctx, pieces, positionsRef.current,
        offsetX, offsetY, scale,
        e.clientX, e.clientY,
      )
      setSelectedPiece(hit)
    }

    canvas.addEventListener('click', handleClick)
    return () => {
      window.removeEventListener('resize', redraw)
      canvas.removeEventListener('click', handleClick)
    }
  }, [image, pieces, started, selectedPiece])

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
