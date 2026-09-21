import React, { useEffect, useRef } from 'react'

const edges = [
  'top',
  'right',
  'bottom',
  'left',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
] as const

const WindowResizeHandles: React.FC = () => {
  const updateTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopResize = (): void => {
    if (updateTimer.current) {
      clearInterval(updateTimer.current)
      updateTimer.current = null
      window.electron.ipcRenderer.send('mainWindowResizeEnd')
    }
  }

  useEffect(() => {
    window.addEventListener('blur', stopResize)
    return () => {
      window.removeEventListener('blur', stopResize)
      stopResize()
    }
  }, [])

  return (
    <>
      {edges.map((edge) => (
        <div
          key={edge}
          className={`app-window-resize-handle app-window-resize-handle--${edge}`}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            stopResize()
            window.electron.ipcRenderer.send('mainWindowResizeStart', edge)
            updateTimer.current = setInterval(() => {
              window.electron.ipcRenderer.send('mainWindowResizeUpdate')
            }, 16)
          }}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          onLostPointerCapture={stopResize}
        />
      ))}
    </>
  )
}

export default WindowResizeHandles
