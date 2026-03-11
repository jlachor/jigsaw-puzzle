# Jigsaw Puzzle — Incremental Build Plan

## Context
Build the jigsaw puzzle app iteratively, starting from the simplest possible working thing and adding one capability at a time. Each step should be small, testable, and visually verifiable in the browser.

## Steps

### Step 1: Project scaffold
- Init Vite + Preact + TypeScript project
- Minimal `App.tsx` that renders "Hello World"
- Verify: `npm run dev` shows the page

### Step 2: Image upload & display
- File input to pick an image
- Load it onto a `<canvas>` element, scaled to fit the viewport
- Verify: pick a photo, see it on screen

### Step 3: Cut image into a rectangular grid
- User picks grid size (e.g. 4×3)
- Slice into rectangular pieces (one offscreen canvas per piece)
- Draw all pieces in their grid positions (no scatter yet)
- Verify: image appears cut into rectangles with small gaps between them

### Step 4: Jigsaw-shaped edges (bezier tabs)
- Generate interlocking bezier tab/blank shapes along each internal edge
- Clip each piece's offscreen canvas to its jigsaw outline (with tab/blank overflow)
- Draw pieces in grid positions with jigsaw shapes
- Verify: pieces look like real jigsaw pieces, tabs interlock visually

### Step 5: Scatter pieces & hit testing
- Scatter pieces randomly on the board
- Implement point-in-piece hit testing (respecting the jigsaw outline, not just bounding box)
- Verify: pieces are scattered; clicking on a piece highlights it (or logs to console)

### Step 6: Drag and drop
- Mouse down on a piece picks it up, mouse move drags, mouse up drops
- Bring dragged piece to front (draw order)
- Verify: can pick up and move jigsaw-shaped pieces around

### Step 7: Snap to correct position
- When a piece is dropped close to its correct position, snap it there
- Visual feedback on snap
- Verify: drag a piece near its home → it snaps into place

### Step 8: Group formation
- When a piece snaps next to an already-snapped neighbor, they form a group
- Dragging any piece in a group moves the whole group
- Verify: snap two adjacent pieces → they move together

### Step 9: Win detection
- After each snap, check if all pieces belong to one group
- Show a simple "You win!" alert or overlay
- Verify: complete a small puzzle → see win message

### Step 10: Scrollable/pannable board
- Make the board larger than the viewport
- Middle-click or two-finger drag to pan the board
- Verify: pieces are scattered across a large area, can pan to find them

### Step 11: Polish & UI shell
- HUD: piece count, timer
- Settings panel: grid size picker before starting
- Win screen overlay
- Better visual feedback (highlight snap targets, drop shadows on dragged piece)

---

Each step builds on the previous one. We implement, test in the browser, then move to the next step.
