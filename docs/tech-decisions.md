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
| Image handling | **Native Canvas API** + `FileReader` | No library needed for loading and slicing user images |

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

## Planned Project Structure

```
src/
  main.ts            — entry, canvas setup, file upload
  components/        — Preact UI components
    Upload.tsx       — file upload dialog
    HUD.tsx          — piece count, timer
    WinScreen.tsx    — win screen overlay
  puzzle/
    generator.ts     — cut image into pieces (bezier paths)
    piece.ts         — piece model + rendering
    group.ts         — group of snapped pieces
    board.ts         — drag/drop, snap detection, win check
  utils/
    geometry.ts      — point/rect math, hit testing
```
