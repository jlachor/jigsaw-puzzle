import { useRef, useEffect, useState } from 'preact/hooks'
import './app.css'

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(3)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const redraw = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#2d5a3d'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (image) {
        const maxW = canvas.width * 0.8
        const maxH = canvas.height * 0.8
        const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight)
        const drawW = image.naturalWidth * scale
        const drawH = image.naturalHeight * scale
        const offsetX = (canvas.width - drawW) / 2
        const offsetY = (canvas.height - drawH) / 2

        ctx.drawImage(image, offsetX, offsetY, drawW, drawH)

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])

        const cellW = drawW / cols
        const cellH = drawH / rows

        for (let i = 1; i < cols; i++) {
          const x = offsetX + i * cellW
          ctx.beginPath()
          ctx.moveTo(x, offsetY)
          ctx.lineTo(x, offsetY + drawH)
          ctx.stroke()
        }

        for (let j = 1; j < rows; j++) {
          const y = offsetY + j * cellH
          ctx.beginPath()
          ctx.moveTo(offsetX, y)
          ctx.lineTo(offsetX + drawW, y)
          ctx.stroke()
        }

        ctx.setLineDash([])
      }
    }

    redraw()
    window.addEventListener('resize', redraw)
    return () => window.removeEventListener('resize', redraw)
  }, [image, cols, rows])

  const handleFile = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      setImage(img)
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
      {image && (
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
          </div>
          <div class="grid-controls-info">
            {cols} × {rows} = {cols * rows} pieces
          </div>
        </div>
      )}
    </>
  )
}
