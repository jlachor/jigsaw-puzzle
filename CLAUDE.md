# Jigsaw Puzzle

Browser-based jigsaw puzzle game. Upload an image, configure grid size, then drag pieces to assemble the puzzle.

## Tech Stack
- Vite + TypeScript + Preact + HTML5 Canvas 2D
- No backend — runs entirely in browser

## Project Structure
- `src/app.tsx` — main App component, canvas setup, event handling orchestration
- `src/puzzle/generator.ts` — edge data model, bezier piece outlines
- `src/puzzle/piece.ts` — piece rendering, hit testing, drawing helpers
- `src/puzzle/group.ts` — group state, merging, snapping, drag helpers
- `src/puzzle/viewport.ts` — zoom/pan camera state and coordinate transforms
- `src/puzzle/renderer.ts` — canvas drawing (pieces, highlights, marquee, snap flash)
- `docs/build-plan.md` — incremental build plan with step-by-step progress

## Architecture
- Positions stored in **source-image coordinates** (scale-independent)
- Pieces pre-rendered to offscreen canvases (clip once, cache forever)
- Viewport transform (zoom + pan) applied at draw time; all hit testing goes through the same transform
- Groups track which pieces are snapped together; dragging/snapping operates on groups
- Mutable state kept in refs (not React state) to avoid re-renders on mousemove
- `requestAnimationFrame`-based redraw scheduling (no React render loop for canvas)

## Key Design Decisions
- Neighbor snap only — pieces snap to adjacent neighbors anywhere on board (no grid snapping)
- Snap threshold: half cell width/height ("meet halfway")
- Marquee selection uses center-point test
- No piece rotation — always correct orientation
- No board boundaries — zoom out to find pieces
