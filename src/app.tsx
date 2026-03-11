import { useRef, useEffect, useState } from 'preact/hooks'
import './app.css'

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)

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
      }
    }

    redraw()
    window.addEventListener('resize', redraw)
    return () => window.removeEventListener('resize', redraw)
  }, [image])

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
    </>
  )
}
