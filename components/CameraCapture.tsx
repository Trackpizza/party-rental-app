'use client'

import { useEffect, useRef, useState } from 'react'

// In-app camera: opens a live stream, captures a frame to canvas, lets the
// user review and confirm. The photo is never saved to the device gallery —
// it goes straight from canvas to the upload handler.
export default function CameraCapture({
  onConfirm,
  onCancel,
  label = 'Capture',
}: {
  onConfirm: (jpegDataUrl: string) => void
  onCancel: () => void
  label?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
      } catch (e: any) {
        setError(
          e?.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access.'
            : 'Could not open the camera on this device.',
        )
      }
    }
    start()
    return () => {
      cancelled = true
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function capture() {
    const video = videoRef.current
    if (!video) return
    const maxW = 1400
    const scale = Math.min(1, maxW / (video.videoWidth || maxW))
    const canvas = document.createElement('canvas')
    canvas.width = (video.videoWidth || 1280) * scale
    canvas.height = (video.videoHeight || 720) * scale
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setCaptured(canvas.toDataURL('image/jpeg', 0.82))
  }

  function retake() {
    setCaptured(null)
  }

  function confirm() {
    if (!captured) return
    stopStream()
    onConfirm(captured)
  }

  function cancel() {
    stopStream()
    onCancel()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center justify-between py-2 text-white">
          <span className="font-semibold">{label}</span>
          <button onClick={cancel} className="text-white/70 hover:text-white">
            ✕ Close
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden rounded-2xl bg-black">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-white">
              <p>{error}</p>
              <label className="mt-4 cursor-pointer rounded-lg bg-white px-4 py-2 font-semibold text-black">
                Use device camera instead
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => onConfirm(reader.result as string)
                    reader.readAsDataURL(file)
                  }}
                />
              </label>
            </div>
          ) : captured ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={captured} alt="preview" className="h-full w-full object-contain" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          )}
        </div>

        {!error && (
          <div className="flex items-center justify-center gap-4 py-4">
            {captured ? (
              <>
                <button
                  onClick={retake}
                  className="rounded-lg border border-white/40 px-5 py-2.5 font-semibold text-white"
                >
                  Retake
                </button>
                <button
                  onClick={confirm}
                  className="rounded-lg bg-brand px-6 py-2.5 font-semibold text-white"
                >
                  Use photo
                </button>
              </>
            ) : (
              <button
                onClick={capture}
                className="h-16 w-16 rounded-full border-4 border-white bg-white/20"
                aria-label="Take photo"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
