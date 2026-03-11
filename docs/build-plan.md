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

### Step 4: Jigsaw-shaped edges (bezier tabs)
- Generate edge data: each internal edge gets a random direction (+1 tab / −1 blank)
- Adjacent pieces always have opposite directions (one tab, one blank)
- Border edges remain straight lines
- Tab/blank size: 1/3 of edge length, centered on the edge
- Draw edges with cubic bezier curves: narrow neck, round head (classic jigsaw profile)
- Replace the straight grid lines in the preview with jigsaw-shaped paths
- "Reshuffle" button regenerates all random directions and redraws
- New file: `src/puzzle/generator.ts` — edge data generation + bezier path building
- Verify: see jigsaw-shaped cut preview; reshuffle changes the shapes
- See `tech-decisions.md` → "Jigsaw Edge Specification" for full geometry details

### Step 5: Piece rendering (pre-render to offscreen canvases)
- Clip each piece from the source image using its jigsaw outline
- Pre-render each piece to its own offscreen canvas (cache)
- Draw all pieces in their grid positions with jigsaw shapes
- "Start" button accepts the cut
- Verify: pieces look like real jigsaw pieces in place; click Start

### Step 6: Scatter pieces on the board
- After "Start", scatter pieces randomly on the canvas
- Implement point-in-piece hit testing (respecting the jigsaw outline)
- Verify: pieces are scattered; clicking a piece highlights it (or logs to console)

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
