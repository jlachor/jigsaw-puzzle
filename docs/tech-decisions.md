# Jigsaw Puzzle App — Technical Decisions

## Overview

A browser-based jigsaw puzzle application that lets users create puzzles from any picture they upload. No backend required.

## Core Requirements

1. Runs entirely in the browser — no server needed
2. User uploads a custom picture
3. The app cuts the picture into jigsaw puzzle pieces
4. Drag-and-drop pieces on a board
5. Pieces snap together when placed close to their matching neighbor, forming a group
6. No rotation mechanic — pieces always have the correct orientation
7. The game ends when all pieces form a single connected group (the full picture)

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Build tool | **Vite** | Fast dev server, zero-config, great TS support |
| Language | **TypeScript** | Type safety for modeling pieces, groups, geometry |
| UI framework | **Preact** | Lightweight (~3KB) React-like framework for the UI shell around the canvas |
| Rendering | **HTML5 Canvas 2D** | Pixel-level control for clipping images into puzzle shapes, efficient drawing |
| Image handling | **Native Canvas API** + `URL.createObjectURL` | No library needed for loading and slicing user images |

## Architecture

- **Preact** manages the UI shell: file upload dialog, settings, HUD (piece count, timer), win screen, layout
- **Canvas 2D** handles all puzzle rendering, drag-and-drop, and snapping — fully outside Preact's render cycle
- Communication between the two via simple callbacks/events

## Performance Strategy

- Pre-render each puzzle piece to its own offscreen canvas at puzzle creation time (clip once, cache forever)
- During gameplay, drawing a piece is a single `drawImage()` from the cached canvas — very cheap
- For future scaling (500+ pieces): dirty rect rendering, layered canvases
- Upgrade path to PixiJS/WebGL exists if 1000+ pieces are ever needed

## Why Not...

| Option | Why rejected |
|---|---|
| React | Overkill for a thin UI shell, ~40KB vs Preact's ~3KB |
| Vue / Svelte | Full frameworks unnecessary for a few panels and buttons |
| Vanilla TS (no framework) | Fine for v1, but gets tedious once UI grows (settings, modals, notifications) |
| PixiJS / Phaser | Unnecessary abstraction for the piece counts we're targeting; Canvas 2D is sufficient |
| Physics engine (Matter.js) | We're snapping, not simulating physics |
| SVG / DOM-based rendering | Slow with many clipped image fragments; Canvas is the standard for this |

## Design Decisions

| Decision | Choice | Notes |
|---|---|---|
| Piece count | **User-configurable** | User picks grid size (e.g. 4×4 up to 20×20) |
| Board layout | **Scrollable/pannable board** | Board is larger than the viewport; user pans to find pieces |
| Persistence | **None in v1** | Closing the tab loses progress; localStorage save planned for v2 |

## Jigsaw Edge Specification

### Edge types
- Each internal edge between two pieces is either a **tab** (+1, protruding outward) or a **blank** (−1, indented inward)
- Adjacent pieces always have opposite values: if piece A's right edge is +1 (tab), piece B's left edge is −1 (blank)
- **Border edges** (top of top row, bottom of bottom row, left of left column, right of right column) are **straight lines** — no tabs or blanks

### Edge data model
- For a grid of `cols × rows`, there are:
  - `(cols - 1) × rows` vertical internal edges (between left/right neighbors)
  - `cols × (rows - 1)` horizontal internal edges (between top/bottom neighbors)
- Each internal edge stores a direction: +1 or −1 (randomly assigned)
- The piece on one side sees it as +1 (tab), the piece on the other side sees it as −1 (blank)

### Tab/blank geometry
- The tab protrusion (or blank indentation) is **1/4 of the edge length** in both dimensions
  - For a horizontal edge of length `cellW`: the tab is `cellW / 4` wide and `cellH / 4` tall
  - For a vertical edge of length `cellH`: the tab is `cellW / 4` wide and `cellH / 4` tall
- The tab is centered along the edge
- Shape is drawn with **cubic bezier curves** to create a smooth, round jigsaw profile
- The neck (where the tab connects to the piece body) is narrower than the head (the round part) — classic jigsaw shape

### Bezier curve construction (per edge)
Each edge is drawn as a path from point A to point B (e.g. top-left corner to top-right corner of a piece):

```
A ——— 1/3 ——— neck start
                 \
                  curve down into neck
                  curve out to form round head
                  curve back to neck
                 /
              neck end ——— 2/3 ——— B
```

- First straight segment: A to 1/3 of the edge
- Bezier curves forming the tab head (bulging outward for +1, inward for −1)
- Last straight segment: 2/3 of the edge to B
- Control points are tuned to produce a round, natural-looking tab — not too pointy, not too square

### Reshuffle
- "Reshuffle" regenerates all random +1/−1 assignments and redraws the preview
- The geometry (bezier control points) is deterministic given the direction — only the direction is random

## User Flow

Two screens:

1. **Setup screen** — Upload image → grid size controls + live jigsaw cut preview + reshuffle button → "Start"
2. **Board screen** — Scattered pieces on a pannable surface → drag, snap, group → win

Grid size controls and cut preview are on the same screen with live feedback (no wizard steps).

## Planned Project Structure

```
src/
  main.tsx           — entry, mounts App
  app.tsx            — root component, screen routing, canvas
  app.css            — UI overlay styles
  index.css          — global reset, body styles
  components/        — Preact UI components (as needed in later steps)
  puzzle/            — generator, piece model, group, board logic
  utils/             — geometry helpers, hit testing
```
