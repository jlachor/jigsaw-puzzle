import { useRef, useEffect, useState, useMemo } from 'preact/hooks'
import { generateEdges } from './puzzle/generator'
import {
  renderAllPieces,
  getGridPositions,
  getScatteredPositions,
  hitTestPieces,
} from './puzzle/piece'
import type { PieceCanvas, PiecePosition } from './puzzle/piece'
import { createGroups, getGroupMembers, moveGroup, bringGroupToFront, trySnap, mergeGroups, isSolved } from './puzzle/group'
import type { GroupState } from './puzzle/group'
import {
  createViewport,
  resetView,
  getTransform,
  screenToWorld,
  applyZoom,
} from './puzzle/viewport'
import type { Viewport } from './puzzle/viewport'
import { drawBoard } from './puzzle/renderer'
import type { SnapFlash, MarqueeRect } from './puzzle/renderer'
import './app.css'

interface DragState {
  pieceIndex: number
  offsetX: number
  offsetY: number
}

interface PanState {
  startX: number
  startY: number
  startPanX: number
  startPanY: number
}

interface BulkDragState {
  lastWorldX: number
  lastWorldY: number
}

function getPieceCenter(piece: PieceCanvas, pos: PiecePosition): { x: number, y: number } {
  const cellW = piece.canvas.width - 2 * piece.padX
  const cellH = piece.canvas.height - 2 * piece.padY
  return { x: pos.x + cellW / 2, y: pos.y + cellH / 2 }
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(3)
  const [seed, setSeed] = useState(0)
  const [started, setStarted] = useState(false)
  const [won, setWon] = useState(false)

  // Mutable game state (refs to avoid re-renders)
  const positionsRef = useRef<PiecePosition[]>([])
  const drawOrderRef = useRef<number[]>([])
  const groupsRef = useRef<GroupState>(createGroups(0))
  const dragRef = useRef<DragState | null>(null)
  const snapFlashRef = useRef<SnapFlash | null>(null)

  // Viewport state
  const vpRef = useRef<Viewport>(createViewport())
  const panningRef = useRef<PanState | null>(null)
  const spaceDownRef = useRef(false)

  // Marquee & selection state
  const marqueeRef = useRef<MarqueeRect | null>(null)
  const selectedRef = useRef<Set<number>>(new Set())
  const bulkDragRef = useRef<BulkDragState | null>(null)

  const edges = useMemo(
    () => image ? generateEdges(cols, rows) : null,
    [cols, rows, seed, image],
  )

  const pieces = useMemo(
    () => (image && edges) ? renderAllPieces(image, cols, rows, edges) : null,
    [image, cols, rows, edges],
  )

  useEffect(() => {
    if (pieces && !started) {
      positionsRef.current = getGridPositions(pieces)
      drawOrderRef.current = pieces.map((_, i) => i)
      groupsRef.current = createGroups(pieces.length)
    }
  }, [pieces, started])

  const reshuffle = () => setSeed(s => s + 1)

  const handlePlayAgain = () => {
    setImage(null)
    setStarted(false)
    setWon(false)
  }

  const handleStart = () => {
    if (!pieces || !image) return
    positionsRef.current = getScatteredPositions(pieces, image.naturalWidth, image.naturalHeight)
    drawOrderRef.current = pieces.map((_, i) => i)
    groupsRef.current = createGroups(pieces.length)
    // Zoom out to 0.5 so scattered pieces are visible
    const vp = vpRef.current
    const canvas = canvasRef.current
    if (canvas) {
      resetView(vp, canvas.width, canvas.height, image.naturalWidth, image.naturalHeight)
      vp.zoom = 0.5
      const base = Math.min(canvas.width * 0.8 / image.naturalWidth, canvas.height * 0.8 / image.naturalHeight)
      const scale = base * vp.zoom
      const drawW = image.naturalWidth * scale
      const drawH = image.naturalHeight * scale
      vp.panX = (canvas.width - drawW) / 2
      vp.panY = (canvas.height - drawH) / 2
    }
    setStarted(true)
  }

  // --- Canvas effect: rendering + event handlers ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const vp = vpRef.current

    const imgW = image?.naturalWidth ?? 1
    const imgH = image?.naturalHeight ?? 1

    const vt = () => image ? getTransform(vp, canvas.width, canvas.height, imgW, imgH) : null
    const toWorld = (sx: number, sy: number) =>
      screenToWorld(vp, canvas.width, canvas.height, imgW, imgH, sx, sy)

    let rafId = 0
    const scheduleRedraw = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(() => { rafId = 0; redraw() })
      }
    }

    const redraw = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      if (!started) resetView(vp, canvas.width, canvas.height, imgW, imgH)

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#2d5a3d'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (!pieces || positionsRef.current.length === 0) return
      const t = vt()
      if (!t) return

      const dragMembers = dragRef.current
        ? getGroupMembers(groupsRef.current, dragRef.current.pieceIndex)
        : undefined

      const { flashExpired } = drawBoard(ctx, t, pieces, positionsRef.current, drawOrderRef.current, {
        dragMembers,
        selectedPieces: selectedRef.current,
        snapFlash: snapFlashRef.current,
        marquee: marqueeRef.current,
        scheduleRedraw,
      })

      if (flashExpired) snapFlashRef.current = null
    }

    // --- Mouse handlers ---

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && spaceDownRef.current)) {
        e.preventDefault()
        panningRef.current = { startX: e.clientX, startY: e.clientY, startPanX: vp.panX, startPanY: vp.panY }
        canvas.style.cursor = 'grabbing'
        return
      }

      if (!started || !pieces) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const t = vt()
      if (!t) return

      const hit = hitTestPieces(ctx, pieces, positionsRef.current, drawOrderRef.current, t.offsetX, t.offsetY, t.scale, e.clientX, e.clientY)

      if (hit >= 0) {
        if (selectedRef.current.has(hit)) {
          // Bulk drag selected pieces
          const world = toWorld(e.clientX, e.clientY)
          bulkDragRef.current = { lastWorldX: world.x, lastWorldY: world.y }
          const seenGroups = new Set<number>()
          for (const pi of selectedRef.current) {
            const gid = groupsRef.current.groupOf[pi]
            if (!seenGroups.has(gid)) { seenGroups.add(gid); bringGroupToFront(groupsRef.current, drawOrderRef.current, pi) }
          }
        } else {
          // Single piece drag
          selectedRef.current.clear()
          const pos = positionsRef.current[hit]
          dragRef.current = {
            pieceIndex: hit,
            offsetX: pos.x - (e.clientX - t.offsetX) / t.scale,
            offsetY: pos.y - (e.clientY - t.offsetY) / t.scale,
          }
          bringGroupToFront(groupsRef.current, drawOrderRef.current, hit)
        }
        scheduleRedraw()
      } else {
        marqueeRef.current = { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY }
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (panningRef.current) {
        vp.panX = panningRef.current.startPanX + (e.clientX - panningRef.current.startX)
        vp.panY = panningRef.current.startPanY + (e.clientY - panningRef.current.startY)
        scheduleRedraw()
        return
      }

      if (marqueeRef.current) {
        marqueeRef.current.endX = e.clientX
        marqueeRef.current.endY = e.clientY
        scheduleRedraw()
        return
      }

      if (bulkDragRef.current && pieces) {
        const world = toWorld(e.clientX, e.clientY)
        const dx = world.x - bulkDragRef.current.lastWorldX
        const dy = world.y - bulkDragRef.current.lastWorldY
        bulkDragRef.current.lastWorldX = world.x
        bulkDragRef.current.lastWorldY = world.y
        const movedGroups = new Set<number>()
        for (const pi of selectedRef.current) {
          const gid = groupsRef.current.groupOf[pi]
          if (!movedGroups.has(gid)) { movedGroups.add(gid); moveGroup(groupsRef.current, positionsRef.current, pi, dx, dy) }
        }
        scheduleRedraw()
        return
      }

      if (!dragRef.current) return
      const t = vt()
      if (!t) return
      const { pieceIndex, offsetX: ox, offsetY: oy } = dragRef.current
      const oldPos = positionsRef.current[pieceIndex]
      const newX = (e.clientX - t.offsetX) / t.scale + ox
      const newY = (e.clientY - t.offsetY) / t.scale + oy
      moveGroup(groupsRef.current, positionsRef.current, pieceIndex, newX - oldPos.x, newY - oldPos.y)
      scheduleRedraw()
    }

    const handleMouseUp = () => {
      if (panningRef.current) {
        panningRef.current = null
        canvas.style.cursor = spaceDownRef.current ? 'grab' : ''
        return
      }

      if (marqueeRef.current && pieces) {
        const mq = marqueeRef.current
        marqueeRef.current = null
        if (Math.abs(mq.endX - mq.startX) > 5 || Math.abs(mq.endY - mq.startY) > 5) {
          const t = vt()
          if (t) {
            const left = Math.min(mq.startX, mq.endX), right = Math.max(mq.startX, mq.endX)
            const top = Math.min(mq.startY, mq.endY), bottom = Math.max(mq.startY, mq.endY)
            const sel = new Set<number>()
            for (let i = 0; i < pieces.length; i++) {
              const c = getPieceCenter(pieces[i], positionsRef.current[i])
              const sx = t.offsetX + c.x * t.scale, sy = t.offsetY + c.y * t.scale
              if (sx >= left && sx <= right && sy >= top && sy <= bottom) {
                for (const m of getGroupMembers(groupsRef.current, i)) sel.add(m)
              }
            }
            selectedRef.current = sel
          }
        } else {
          selectedRef.current = new Set()
        }
        scheduleRedraw()
        return
      }

      if (bulkDragRef.current && image) {
        bulkDragRef.current = null
        const cellW = imgW / cols, cellH = imgH / rows
        const snappedGroups = new Set<number>()
        const allFlash: number[] = []
        for (const pi of selectedRef.current) {
          const gid = groupsRef.current.groupOf[pi]
          if (snappedGroups.has(gid)) continue
          snappedGroups.add(gid)
          const snapped = trySnap(groupsRef.current, positionsRef.current, pi, cols, rows, cellW, cellH)
          if (snapped.length > 0) {
            allFlash.push(...getGroupMembers(groupsRef.current, pi))
            for (const ni of snapped) { allFlash.push(...getGroupMembers(groupsRef.current, ni)); mergeGroups(groupsRef.current, pi, ni) }
          }
        }
        if (allFlash.length > 0) {
          snapFlashRef.current = { pieces: allFlash, startTime: performance.now() }
          if (isSolved(groupsRef.current)) setWon(true)
        }
        selectedRef.current = new Set()
        scheduleRedraw()
        return
      }

      if (!dragRef.current || !image) return
      const { pieceIndex } = dragRef.current
      dragRef.current = null
      const cellW = imgW / cols, cellH = imgH / rows
      const snapped = trySnap(groupsRef.current, positionsRef.current, pieceIndex, cols, rows, cellW, cellH)
      if (snapped.length > 0) {
        const flash = getGroupMembers(groupsRef.current, pieceIndex)
        for (const ni of snapped) { flash.push(...getGroupMembers(groupsRef.current, ni)); mergeGroups(groupsRef.current, pieceIndex, ni) }
        snapFlashRef.current = { pieces: flash, startTime: performance.now() }
        if (isSolved(groupsRef.current)) setWon(true)
      }
      scheduleRedraw()
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!image) return
      if (applyZoom(vp, canvas.width, canvas.height, imgW, imgH, e.clientX, e.clientY, e.deltaY)) {
        scheduleRedraw()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        spaceDownRef.current = true
        if (!panningRef.current) canvas.style.cursor = 'grab'
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false
        if (!panningRef.current) canvas.style.cursor = ''
      }
    }

    redraw()
    window.addEventListener('resize', scheduleRedraw)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', scheduleRedraw)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [image, pieces, started])

  const handleFile = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); setImage(img) }
    img.onerror = () => { URL.revokeObjectURL(url) }
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
              <input type="range" min={2} max={20} value={cols}
                onInput={(e) => setCols(Number((e.target as HTMLInputElement).value))} />
            </label>
            <label>
              Rows: {rows}
              <input type="range" min={2} max={20} value={rows}
                onInput={(e) => setRows(Number((e.target as HTMLInputElement).value))} />
            </label>
            <button class="reshuffle-btn" onClick={reshuffle}>Reshuffle</button>
            <button class="start-btn" onClick={handleStart}>Start</button>
          </div>
          <div class="grid-controls-info">
            {cols} &times; {rows} = {cols * rows} pieces
          </div>
        </div>
      )}
      {won && (
        <div class="win-overlay">
          <div class="win-message">
            <h1>You win!</h1>
            <button class="start-btn" onClick={handlePlayAgain}>Play Again</button>
          </div>
        </div>
      )}
    </>
  )
}
