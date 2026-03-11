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

### Step 8b: Snap detection
- On mouse-up, check all grid-adjacent neighbors of the dropped piece
- The dropped piece is the **anchor/reference** — it does not move
- Each neighbor within half a cell distance snaps to align with the dropped piece
  (multi-directional: can snap left AND top neighbor simultaneously)
- No group merging yet — neighbors teleport to correct offset but remain independent
- Verify: drop piece A between neighbors B and C → both B and C snap flush against A

### Step 8c: Group merging
- After a snap, merge the two pieces' groups into one
- All pieces in a group store positions relative to each other (internally rigid)
- Verify: snap A to B → they're now in the same group

### Step 8d: Group dragging
- Clicking any piece in a group starts dragging the entire group
- All member positions update together during mousemove
- Verify: snap two pieces → drag one → both move together

### Step 8e: Group z-ordering
- When a group is picked up, all its members move to the front of the draw order
- Verify: snap two pieces, drag them over a loose piece → the group draws on top

### Step 8f: Transitive merging + visual feedback
- On drop, check all group members against their neighbors (not just the dragged piece)
  — one drop can trigger multiple merges
- Brief visual feedback on snap (e.g. flash or settle animation)
- Verify: drag a piece that bridges two existing groups → all three merge

### Step 9: Marquee (RTS box) selection
- Click-drag on empty space draws a selection rectangle
- Selection uses **center point** test: a piece or group is selected if its center
  is inside the marquee rectangle
- Selected pieces/groups can be dragged together (temporary bulk move, not a permanent bond)
- Releasing without dragging clears the selection
- Verify: draw a box around several pieces → drag them all at once

### Step 10: Board boundaries
- Define a board area larger than the image (e.g. 2× in each dimension)
- Pieces/groups cannot be dragged outside the board bounds (clamp position on drop)
- Verify: try to drag a piece off-screen → it stops at the board edge

### Step 11: Win detection
- After each snap, check if all pieces belong to one group
- Show a simple "You win!" overlay
- Verify: complete a small puzzle → see win message

### Step 12: Scrollable/pannable board
- Middle-click or two-finger drag to pan the board
- Verify: pieces are scattered across a large area, can pan to find them

### Step 13: Polish & UI shell
- HUD: piece count, timer
- Win screen overlay
- Better visual feedback (highlight snap targets, drop shadows on dragged piece)

---

Each step builds on the previous one. We implement, test in the browser, then move to the next step.
