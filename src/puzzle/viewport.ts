export interface ViewTransform {
  scale: number
  offsetX: number
  offsetY: number
}

export interface Viewport {
  zoom: number
  /** Screen position of the world origin (0,0) */
  panX: number
  panY: number
}

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 1.5

export function createViewport(): Viewport {
  return { zoom: 1, panX: 0, panY: 0 }
}

export function getBaseScale(
  canvasW: number,
  canvasH: number,
  imageW: number,
  imageH: number,
): number {
  return Math.min(canvasW * 0.8 / imageW, canvasH * 0.8 / imageH)
}

export function resetView(
  vp: Viewport,
  canvasW: number,
  canvasH: number,
  imageW: number,
  imageH: number,
): void {
  vp.zoom = 1
  const base = getBaseScale(canvasW, canvasH, imageW, imageH)
  const drawW = imageW * base
  const drawH = imageH * base
  vp.panX = (canvasW - drawW) / 2
  vp.panY = (canvasH - drawH) / 2
}

export function getTransform(
  vp: Viewport,
  canvasW: number,
  canvasH: number,
  imageW: number,
  imageH: number,
): ViewTransform {
  const base = getBaseScale(canvasW, canvasH, imageW, imageH)
  return {
    scale: base * vp.zoom,
    offsetX: vp.panX,
    offsetY: vp.panY,
  }
}

export function screenToWorld(
  vp: Viewport,
  canvasW: number,
  canvasH: number,
  imageW: number,
  imageH: number,
  sx: number,
  sy: number,
): { x: number, y: number } {
  const t = getTransform(vp, canvasW, canvasH, imageW, imageH)
  return {
    x: (sx - t.offsetX) / t.scale,
    y: (sy - t.offsetY) / t.scale,
  }
}

/** Apply zoom centered on a screen point. Mutates vp in place. */
export function applyZoom(
  vp: Viewport,
  canvasW: number,
  canvasH: number,
  imageW: number,
  imageH: number,
  screenX: number,
  screenY: number,
  deltaY: number,
): boolean {
  const base = getBaseScale(canvasW, canvasH, imageW, imageH)
  const oldZoom = vp.zoom
  const factor = deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor))
  if (newZoom === oldZoom) return false

  const oldScale = base * oldZoom
  const newScale = base * newZoom

  const worldX = (screenX - vp.panX) / oldScale
  const worldY = (screenY - vp.panY) / oldScale
  vp.panX = screenX - worldX * newScale
  vp.panY = screenY - worldY * newScale
  vp.zoom = newZoom
  return true
}
