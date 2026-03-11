# Jigsaw Puzzle — Incremental Build Plan

## Context
Build the jigsaw puzzle app iteratively, starting from the simplest possible working thing and adding one capability at a time. Each step should be small, testable, and visually verifiable in the browser.

## User Flow (two screens)

### Screen 1: Setup
1. User uploads an image
2. Image appears as a preview with grid size controls (columns × rows sliders/inputs) and a live cut preview showing where the pieces will be
3. A "Reshuffle" button regenerates all the random bezier tab shapes
4. An "Start" button accepts the configuration and moves to the board

### Screen 2: Board
1. Pieces are scattered on a large pannable surface
2. User drags pieces, snaps them into place, forms groups
3. Win detection when all pieces are joined

## Steps

### Step 1: Project scaffold ✅
- Vite + Preact + TypeScript project (preact-ts template)
- Full-screen `<canvas>` with dark green (`#2d5a3d`) background
- Canvas resizes on window resize
- Files: `src/app.tsx`, `src/index.css`

### Step 2: Image upload ✅
- Centered "Choose an image" label with hidden file input (`src/app.css` for overlay styles)
- `URL.createObjectURL()` → `HTMLImageElement` → `onload` → state update
- Image drawn on canvas scaled to 80% of viewport, centered, preserving aspect ratio
- Upload overlay hides once image is loaded; redraws on window resize
- Files: `src/app.tsx`, `src/app.css`

### Step 3: Grid size controls + rectangular cut preview ✅
- After image upload, show grid size controls (columns × rows) overlaid on the canvas
- Draw the image with dashed white grid lines overlaid to preview where cuts will be
- Grid size updates live as the user adjusts sliders (range 2–20)
- Piece count label: "4 × 3 = 12 pieces"
- Files: `src/app.tsx`, `src/app.css`

### Step 4a: Rectangular tabs (edge data model + simple rendering) ✅
- Edge data model: `0` (border), `+1` (tab), `−1` (blank) per piece edge
- `generateEdges(cols, rows)` → `{ hEdges, vEdges }` arrays with random +1/−1
- `getPieceEdges(col, row, ...)` derives per-piece edges; neighbors always opposite
- `drawPieceOutline()` draws piece outline with rectangular tab/blank shapes
- "Reshuffle" button via `seed` state counter + `useMemo` (avoids edge/grid desync bug)
- Bug fixed: edges computed via `useMemo` instead of `useEffect` to stay in sync with cols/rows
- New file: `src/puzzle/generator.ts`

### Step 4b: Bezier curves (upgrade rectangles to round jigsaw shape) ✅
- Replaced `lineTo` calls with `bezierCurveTo` in `drawPieceOutline()`
- 2 cubic bezier curves per tab: narrow neck (factor `0.4`) → wide round head
- Head spread: `headSpread = cellW * 0.15` makes head wider than neck (~1/3 at widest)
- Tab/blank size: 1/4 of edge length, centered at 3/8–5/8 of edge
- Only `drawPieceOutline()` changed — data model untouched
- Files: `src/puzzle/generator.ts`

### Step 5: Piece rendering (pre-render to offscreen canvases) ✅
- Extracted `tracePieceOutline()` from `drawPieceOutline()` (path-only, no stroke)
- `renderAllPieces()` clips source image through jigsaw outline per piece at source resolution
- Each piece cached on its own `HTMLCanvasElement` with padding for tabs (`cellW/4`, `cellH/4`)
- `drawPieces()` stamps cached canvases onto main canvas, scaled to viewport
- Subtle dark stroke (`rgba(0,0,0,0.3)`) around each piece for definition
- "Start" button hides grid controls and accepts the cut
- New file: `src/puzzle/piece.ts`

### Step 6a: Scatter pieces on the board ✅
- Positions stored in source-image coordinates (`PiecePosition`), scale-independent
- `getGridPositions()` for preview, `getScatteredPositions()` on Start (random within image bounds)
- `drawPieces()` now takes a positions array; `positionsRef` in app keeps mutable state
- Files: `src/puzzle/piece.ts`, `src/app.tsx`

### Step 6b: Hit testing (click to select a piece) ✅
- `hitTestPieces()` iterates reverse draw order, traces outline at display coords, uses `isPointInPath()`
- `PieceCanvas.edges` added to store shape data for hit testing
- `drawPieceHighlight()` draws yellow glow stroke with `shadowBlur` around selected piece
- `selectedPiece` state in app; click handler runs hit test, clicking empty space deselects
- Files: `src/puzzle/piece.ts`, `src/app.tsx`

### Step 7: Drag and drop ✅
- `drawOrder` array added to `drawPieces()` and `hitTestPieces()` for z-ordering
- Drag state kept in refs (not React state) to avoid re-renders on mousemove
- mousedown: hit test → start drag → bring piece to front of draw order
- mousemove: update position in source-image coords → redraw
- mouseup: clear drag → redraw (highlight removed)
- Replaced click-to-select with full drag; yellow highlight shown on dragged piece
- Files: `src/puzzle/piece.ts`, `src/app.tsx`

### Step 8a: Group data model ✅
- Introduced `GroupState` (piece index → group ID), every piece starts as its own group
- `moveGroup()`, `bringGroupToFront()`, `getGroupMembers()`, `getGridNeighbors()` helpers
- Dragging and drawing work through groups instead of raw piece indices
- No behavior change — game plays identically to before
- New file: `src/puzzle/group.ts`

### Step 8b: Snap detection ✅
- On mouse-up, check all grid-adjacent neighbors of the dropped piece
- The dropped piece is the **anchor/reference** — it does not move
- Each neighbor within half a cell distance snaps to align with the dropped piece
  (multi-directional: can snap left AND top neighbor simultaneously)
- `trySnap()` returns list of snapped neighbor indices
- Files: `src/puzzle/group.ts`, `src/app.tsx`

### Step 8c: Group merging ✅
- `mergeGroups()` called after each snap — absorbs snapped neighbor's group into anchor's group
- All pieces in a group maintain rigid relative positions
- Files: `src/puzzle/group.ts`, `src/app.tsx`

### Step 8d: Group dragging ✅
- Already wired in 8a: `moveGroup()` in `handleMouseMove` moves all group members by the same delta
- Clicking any piece in a group drags the entire group

### Step 8e: Group z-ordering ✅
- Already wired in 8a: `bringGroupToFront()` in `handleMouseDown` moves all group members to top
- Highlight loops over all group members during drag

### Step 8f: Transitive merging + visual feedback ✅
- `trySnap()` already checks all anchor group members — transitive merging works out of the box
- Bug fix: snapping moves the **entire neighbor group** rigidly (not just the matched piece)
- Green glow flash (300ms fade) on all pieces involved in a snap
- Files: `src/puzzle/group.ts`, `src/app.tsx`

### Step 9: Zoom & Pan ✅
- **Zoom**: mouse scroll zooms in/out, centered on the cursor position
  - Zoom-out limit: the puzzle image occupies at most ~20% of the viewport (lots of workspace around the board)
  - Zoom-in limit: slightly closer than the current default view (enough to inspect detail, not excessive)
- **Pan**: middle-click drag (or Space + left-click drag, Photoshop-style) moves the viewport
  - Cursor changes to a grab/hand icon while panning
- All coordinate transforms (hit testing, drag, snap, drawing) must account for current zoom level and pan offset
- Verify: scroll to zoom out → image shrinks to ~20% of screen; scroll to zoom in → stops just past default; middle-drag to pan around the board

### Step 10: Marquee (RTS box) selection
- Click-drag on empty space draws a selection rectangle
- Selection uses **center point** test: a piece or group is selected if its center
  is inside the marquee rectangle
- Selected pieces/groups can be dragged together (temporary bulk move, not a permanent bond)
- Releasing without dragging clears the selection
- Verify: draw a box around several pieces → drag them all at once

### Step 11: Win detection
- After each snap, check if all pieces belong to one group
- Show a simple "You win!" overlay
- Verify: complete a small puzzle → see win message

### Step 13: Polish & UI shell
- HUD: piece count, timer
- Win screen overlay
- Better visual feedback (highlight snap targets, drop shadows on dragged piece)

---

Each step builds on the previous one. We implement, test in the browser, then move to the next step.
