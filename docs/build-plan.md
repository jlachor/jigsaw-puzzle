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

### Step 6b: Hit testing (click to select a piece)
- Translate mouse click to canvas coordinates
- Iterate pieces in **reverse draw order** (last drawn = topmost) — stop at the first hit so overlapping pieces select only the top one
- Use `tracePieceOutline()` + `isPointInPath()` to test against the actual jigsaw shape
- Highlight the selected piece (e.g. glow or tint)
- Verify: clicking on a piece highlights it; clicking empty space or a blank/concave region does not; when pieces overlap, only the topmost piece is selected

### Step 7: Drag and drop
- Mouse down on a piece picks it up, mouse move drags, mouse up drops
- Bring dragged piece to front (draw order)
- Verify: can pick up and move jigsaw-shaped pieces around

### Step 8: Snap to correct position
- When a piece is dropped close to its correct position, snap it there
- Visual feedback on snap
- Verify: drag a piece near its home → it snaps into place

### Step 9: Group formation
- When a piece snaps next to an already-snapped neighbor, they form a group
- Dragging any piece in a group moves the whole group
- Verify: snap two adjacent pieces → they move together

### Step 10: Win detection
- After each snap, check if all pieces belong to one group
- Show a simple "You win!" overlay
- Verify: complete a small puzzle → see win message

### Step 11: Scrollable/pannable board
- Make the board larger than the viewport
- Middle-click or two-finger drag to pan the board
- Verify: pieces are scattered across a large area, can pan to find them

### Step 12: Polish & UI shell
- HUD: piece count, timer
- Win screen overlay
- Better visual feedback (highlight snap targets, drop shadows on dragged piece)

---

Each step builds on the previous one. We implement, test in the browser, then move to the next step.
