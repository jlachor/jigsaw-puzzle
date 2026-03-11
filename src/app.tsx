import { useRef, useEffect, useState, useMemo } from 'preact/hooks'
import { generateEdges, tracePieceOutline } from './puzzle/generator'
import {
  renderAllPieces,
  getGridPositions,
  getScatteredPositions,
  drawPieces,
  hitTestPieces,
  drawPieceHighlight,
} from './puzzle/piece'
import type { PieceCanvas, PiecePosition } from './puzzle/piece'
import { createGroups, getGroupMembers, moveGroup, bringGroupToFront, trySnap, mergeGroups } from './puzzle/group'
import type { GroupState } from './puzzle/group'
import './app.css'

interface DragState {
  pieceIndex: number
  /** Offset between mouse and piece position, in source-image coords */
  offsetX: number
  offsetY: number
}

interface PanState {
  startX: number
  startY: number
  startPanX: number
  startPanY: number
}

interface MarqueeState {
  /** Screen coordinates */
  startX: number
  startY: number
  endX: number
  endY: number
}

interface BulkDragState {
  /** Last mouse position in world (source-image) coords */
  lastWorldX: number
  lastWorldY: number
}

/** Get the center of a piece in world (source-image) coordinates. */
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
  const positionsRef = useRef<PiecePosition[]>([])
  const drawOrderRef = useRef<number[]>([])
  const groupsRef = useRef<GroupState>(createGroups(0))
  const dragRef = useRef<DragState | null>(null)
  const snapFlashRef = useRef<{ pieces: number[], startTime: number } | null>(null)
  const redrawRef = useRef<(() => void) | null>(null)

  // Zoom & pan state
  const zoomRef = useRef(1)
  /** Screen position of the world origin (0,0) */
  const panRef = useRef({ x: 0, y: 0 })
  const panningRef = useRef<PanState | null>(null)
  const spaceDownRef = useRef(false)

  // Marquee & selection state
  const marqueeRef = useRef<MarqueeState | null>(null)
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

    const getBaseScale = () => {
      if (!image) return 1
      return Math.min(
        canvas.width * 0.8 / image.naturalWidth,
        canvas.height * 0.8 / image.naturalHeight,
      )
    }

    /** Reset zoom to 1 and center the image */
    const resetView = () => {
      if (!image) return
      zoomRef.current = 1
      const baseScale = getBaseScale()
      const drawW = image.naturalWidth * baseScale
      const drawH = image.naturalHeight * baseScale
      panRef.current = {
        x: (canvas.width - drawW) / 2,
        y: (canvas.height - drawH) / 2,
      }
    }

    const getTransform = () => {
      if (!image) return null
      const baseScale = getBaseScale()
      const scale = baseScale * zoomRef.current
      return {
        scale,
        offsetX: panRef.current.x,
        offsetY: panRef.current.y,
      }
    }

    /** Convert screen coords to world (source-image) coords */
    const screenToWorld = (sx: number, sy: number) => {
      const t = getTransform()
      if (!t) return { x: 0, y: 0 }
      return {
        x: (sx - t.offsetX) / t.scale,
        y: (sy - t.offsetY) / t.scale,
      }
    }

    // Zoom limits: 0.25 → image at ~20% of viewport; 1.5 → slightly past default
    const MIN_ZOOM = 0.25
    const MAX_ZOOM = 1.5

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

      // During preview, always re-center (no zoom/pan)
      if (!started) {
        resetView()
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#2d5a3d'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (pieces && positionsRef.current.length > 0) {
        const t = getTransform()
        if (!t) return

        drawPieces(ctx, pieces, positionsRef.current, drawOrderRef.current, t.offsetX, t.offsetY, t.scale)

        // Highlight dragged piece/group
        if (dragRef.current) {
          const members = getGroupMembers(groupsRef.current, dragRef.current.pieceIndex)
          for (const mi of members) {
            drawPieceHighlight(
              ctx, pieces[mi], positionsRef.current[mi],
              t.offsetX, t.offsetY, t.scale,
            )
          }
        }

        // Highlight selected pieces (blue glow)
        const selected = selectedRef.current
        if (selected.size > 0) {
          for (const pi of selected) {
            const p = pieces[pi]
            const pos = positionsRef.current[pi]
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
        const flash = snapFlashRef.current
        if (flash) {
          const elapsed = performance.now() - flash.startTime
          const duration = 300
          if (elapsed < duration) {
            const alpha = 0.6 * (1 - elapsed / duration)
            for (const fi of flash.pieces) {
              const p = pieces[fi]
              const pos = positionsRef.current[fi]
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
            scheduleRedraw() // keep animating until fade completes
          } else {
            snapFlashRef.current = null
          }
        }
      }

      // Draw marquee rectangle
      const mq = marqueeRef.current
      if (mq) {
        const ctx2 = canvas.getContext('2d')
        if (ctx2) {
          const x = Math.min(mq.startX, mq.endX)
          const y = Math.min(mq.startY, mq.endY)
          const w = Math.abs(mq.endX - mq.startX)
          const h = Math.abs(mq.endY - mq.startY)
          ctx2.strokeStyle = 'rgba(255, 255, 255, 0.8)'
          ctx2.lineWidth = 1
          ctx2.setLineDash([6, 3])
          ctx2.strokeRect(x, y, w, h)
          ctx2.setLineDash([])
          ctx2.fillStyle = 'rgba(100, 180, 255, 0.1)'
          ctx2.fillRect(x, y, w, h)
        }
      }
    }

    redrawRef.current = redraw

    const handleMouseDown = (e: MouseEvent) => {
      // Middle button or Space + left click → pan
      if (e.button === 1 || (e.button === 0 && spaceDownRef.current)) {
        e.preventDefault()
        panningRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startPanX: panRef.current.x,
          startPanY: panRef.current.y,
        }
        canvas.style.cursor = 'grabbing'
        return
      }

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
        const selected = selectedRef.current

        // If we hit a selected piece, start bulk drag
        if (selected.has(hit)) {
          const world = screenToWorld(e.clientX, e.clientY)
          bulkDragRef.current = { lastWorldX: world.x, lastWorldY: world.y }

          // Bring all selected groups to front
          const seenGroups = new Set<number>()
          for (const pi of selected) {
            const gid = groupsRef.current.groupOf[pi]
            if (!seenGroups.has(gid)) {
              seenGroups.add(gid)
              bringGroupToFront(groupsRef.current, drawOrderRef.current, pi)
            }
          }

          scheduleRedraw()
          return
        }

        // Hit a non-selected piece — clear selection, start single drag
        selected.clear()

        const pos = positionsRef.current[hit]
        dragRef.current = {
          pieceIndex: hit,
          offsetX: pos.x - (e.clientX - t.offsetX) / t.scale,
          offsetY: pos.y - (e.clientY - t.offsetY) / t.scale,
        }

        bringGroupToFront(groupsRef.current, drawOrderRef.current, hit)
        scheduleRedraw()
      } else {
        // No hit — start marquee
        marqueeRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          endX: e.clientX,
          endY: e.clientY,
        }
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (panningRef.current) {
        panRef.current = {
          x: panningRef.current.startPanX + (e.clientX - panningRef.current.startX),
          y: panningRef.current.startPanY + (e.clientY - panningRef.current.startY),
        }
        scheduleRedraw()
        return
      }

      // Marquee drawing
      if (marqueeRef.current) {
        marqueeRef.current.endX = e.clientX
        marqueeRef.current.endY = e.clientY
        scheduleRedraw()
        return
      }

      // Bulk drag
      if (bulkDragRef.current && pieces) {
        const world = screenToWorld(e.clientX, e.clientY)
        const dx = world.x - bulkDragRef.current.lastWorldX
        const dy = world.y - bulkDragRef.current.lastWorldY
        bulkDragRef.current.lastWorldX = world.x
        bulkDragRef.current.lastWorldY = world.y

        // Move all selected groups (each group once)
        const movedGroups = new Set<number>()
        for (const pi of selectedRef.current) {
          const gid = groupsRef.current.groupOf[pi]
          if (!movedGroups.has(gid)) {
            movedGroups.add(gid)
            moveGroup(groupsRef.current, positionsRef.current, pi, dx, dy)
          }
        }
        scheduleRedraw()
        return
      }

      // Single piece drag
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
      if (panningRef.current) {
        panningRef.current = null
        canvas.style.cursor = spaceDownRef.current ? 'grab' : ''
        return
      }

      // Marquee release
      if (marqueeRef.current && pieces) {
        const mq = marqueeRef.current
        marqueeRef.current = null

        const dx = Math.abs(mq.endX - mq.startX)
        const dy = Math.abs(mq.endY - mq.startY)

        if (dx > 5 || dy > 5) {
          // Compute selection: pieces whose center is inside the marquee rect
          const t = getTransform()
          if (t) {
            const left = Math.min(mq.startX, mq.endX)
            const right = Math.max(mq.startX, mq.endX)
            const top = Math.min(mq.startY, mq.endY)
            const bottom = Math.max(mq.startY, mq.endY)

            const newSelection = new Set<number>()
            for (let i = 0; i < pieces.length; i++) {
              const center = getPieceCenter(pieces[i], positionsRef.current[i])
              const screenX = t.offsetX + center.x * t.scale
              const screenY = t.offsetY + center.y * t.scale
              if (screenX >= left && screenX <= right && screenY >= top && screenY <= bottom) {
                // Select this piece and all members of its group
                const members = getGroupMembers(groupsRef.current, i)
                for (const m of members) newSelection.add(m)
              }
            }
            selectedRef.current = newSelection
          }
        } else {
          // Just a click on empty space — clear selection
          selectedRef.current = new Set()
        }

        scheduleRedraw()
        return
      }

      // Bulk drag release — try snap for each group, then clear selection
      if (bulkDragRef.current && image) {
        bulkDragRef.current = null

        const cellW = image.naturalWidth / cols
        const cellH = image.naturalHeight / rows
        const snappedGroups = new Set<number>()
        const allFlashPieces: number[] = []

        for (const pi of selectedRef.current) {
          const gid = groupsRef.current.groupOf[pi]
          if (snappedGroups.has(gid)) continue
          snappedGroups.add(gid)

          const snapped = trySnap(groupsRef.current, positionsRef.current, pi, cols, rows, cellW, cellH)
          if (snapped.length > 0) {
            allFlashPieces.push(...getGroupMembers(groupsRef.current, pi))
            for (const ni of snapped) {
              allFlashPieces.push(...getGroupMembers(groupsRef.current, ni))
              mergeGroups(groupsRef.current, pi, ni)
            }
          }
        }

        if (allFlashPieces.length > 0) {
          snapFlashRef.current = { pieces: allFlashPieces, startTime: performance.now() }
        }

        selectedRef.current = new Set()
        scheduleRedraw()
        return
      }

      // Single piece drag release
      if (!dragRef.current || !image) return
      const { pieceIndex } = dragRef.current
      dragRef.current = null

      const cellW = image.naturalWidth / cols
      const cellH = image.naturalHeight / rows
      const snapped = trySnap(groupsRef.current, positionsRef.current, pieceIndex, cols, rows, cellW, cellH)
      if (snapped.length > 0) {
        const flashPieces = getGroupMembers(groupsRef.current, pieceIndex)
        for (const ni of snapped) {
          flashPieces.push(...getGroupMembers(groupsRef.current, ni))
          mergeGroups(groupsRef.current, pieceIndex, ni)
        }
        snapFlashRef.current = { pieces: flashPieces, startTime: performance.now() }
      }

      scheduleRedraw()
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!image) return

      const baseScale = getBaseScale()
      const oldZoom = zoomRef.current
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor))
      if (newZoom === oldZoom) return

      const oldScale = baseScale * oldZoom
      const newScale = baseScale * newZoom

      // Keep the world point under the cursor fixed
      const worldX = (e.clientX - panRef.current.x) / oldScale
      const worldY = (e.clientY - panRef.current.y) / oldScale
      panRef.current = {
        x: e.clientX - worldX * newScale,
        y: e.clientY - worldY * newScale,
      }
      zoomRef.current = newZoom

      scheduleRedraw()
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
