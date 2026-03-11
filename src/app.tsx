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
import { createGroups, getGroupMembers, moveGroup, bringGroupToFront, trySnap } from './puzzle/group'
import type { GroupState } from './puzzle/group'
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
  const groupsRef = useRef<GroupState>(createGroups(0))
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

  // Keep grid positions, draw order, and groups in sync during preview
  useEffect(() => {
    if (pieces && !started) {
      positionsRef.current = getGridPositions(pieces)
      drawOrderRef.current = pieces.map((_, i) => i)
      groupsRef.current = createGroups(pieces.length)
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
    groupsRef.current = createGroups(pieces.length)
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

    let rafId = 0
    const scheduleRedraw = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0
          redraw()
        })
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
          const members = getGroupMembers(groupsRef.current, dragRef.current.pieceIndex)
          for (const mi of members) {
            drawPieceHighlight(
              ctx, pieces[mi], positionsRef.current[mi],
              t.offsetX, t.offsetY, t.scale,
            )
          }
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

        // Bring group to front (for single pieces this is the same as before)
        bringGroupToFront(groupsRef.current, drawOrderRef.current, hit)

        scheduleRedraw()
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const t = getTransform()
      if (!t) return

      const { pieceIndex, offsetX: ox, offsetY: oy } = dragRef.current
      const oldPos = positionsRef.current[pieceIndex]
      const newX = (e.clientX - t.offsetX) / t.scale + ox
      const newY = (e.clientY - t.offsetY) / t.scale + oy
      moveGroup(groupsRef.current, positionsRef.current, pieceIndex, newX - oldPos.x, newY - oldPos.y)
      scheduleRedraw()
    }

    const handleMouseUp = () => {
      if (!dragRef.current || !image) return
      const { pieceIndex } = dragRef.current
      dragRef.current = null

      const cellW = image.naturalWidth / cols
      const cellH = image.naturalHeight / rows
      trySnap(positionsRef.current, pieceIndex, cols, rows, cellW, cellH)

      scheduleRedraw()
    }

    redraw()
    window.addEventListener('resize', scheduleRedraw)
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', scheduleRedraw)
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
    img.onerror = () => {
      URL.revokeObjectURL(url)
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
