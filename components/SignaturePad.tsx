'use client'

import { useRef, useEffect, useState } from 'react'

export default function SignaturePad({
  onChange,
  disabled,
}: {
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasDrawn = useRef(false)
  const [empty, setEmpty] = useState(true)

  // Size the canvas to its container, accounting for device pixel ratio.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a1a1a'
  }, [])

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent) {
    if (disabled) return
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    canvasRef.current!.setPointerCapture(e.pointerId)
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current || disabled) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasDrawn.current = true
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    if (hasDrawn.current) {
      setEmpty(false)
      onChange(canvasRef.current!.toDataURL('image/png'))
    }
  }

  function clear() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawn.current = false
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <div
        className={`relative rounded-lg border-2 ${
          disabled ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-white'
        }`}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-40 w-full touch-none"
          style={{ cursor: disabled ? 'not-allowed' : 'crosshair' }}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-300">
            {disabled ? 'Agree to the waiver first' : 'Sign here'}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        disabled={disabled || empty}
        className="mt-2 text-sm text-gray-400 hover:text-gray-600 disabled:opacity-40"
      >
        Clear signature
      </button>
    </div>
  )
}
