import { useEffect, type RefObject } from 'react'

// Smooth discrete mouse-wheel steps; leave touchpad gestures and native controls alone.
export function useSmoothWheel(root: RefObject<HTMLElement | null>, disabled: boolean): void {
  useEffect(() => {
    const host = root.current
    if (!host || disabled) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let scroller: HTMLElement | null = null
    let target = 0
    let lastTime = 0
    const cancel = (): void => {
      cancelAnimationFrame(frame)
      frame = 0
      scroller = null
    }
    const step = (now: number): void => {
      if (!scroller?.isConnected || reduced.matches) {
        cancel()
        return
      }
      const dt = Math.min(40, now - lastTime)
      lastTime = now
      target = Math.max(0, Math.min(target, scroller.scrollHeight - scroller.clientHeight))
      const distance = target - scroller.scrollTop
      scroller.scrollTo({
        top:
          Math.abs(distance) < 0.75
            ? target
            : scroller.scrollTop +
              Math.sign(distance) *
                Math.min(
                  Math.abs(distance),
                  Math.max(1, Math.abs(distance) * (1 - Math.exp(-dt / 65)))
                ),
        behavior: 'instant'
      })
      if (Math.abs(distance) < 0.75) {
        cancel()
        return
      }
      frame = requestAnimationFrame(step)
    }
    const wheel = (event: WheelEvent): void => {
      if (
        event.defaultPrevented ||
        reduced.matches ||
        event.ctrlKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return
      if (
        !(event.target instanceof Element) ||
        event.target.closest('textarea, input, select, .monaco-editor')
      )
        return
      // Pixel-precision trackpads already have smooth momentum from the OS.
      if (
        event.deltaMode === 0 &&
        (Math.abs(event.deltaY) < 40 || !Number.isInteger(event.deltaY))
      ) {
        cancel()
        return
      }
      let element =
        event.target instanceof HTMLElement
          ? event.target
          : event.target.closest<HTMLElement>('div, button, span')
      while (element && host.contains(element)) {
        const style = getComputedStyle(element)
        if (
          /(auto|scroll)/.test(style.overflowY) &&
          element.scrollHeight > element.clientHeight + 1
        ) {
          const rawDelta =
            event.deltaY *
            (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1)
          // A notch is a short step, even when Windows reports a large wheel delta.
          const delta = Math.sign(rawDelta) * Math.min(Math.abs(rawDelta) * 0.4, 64)
          const continuing =
            element === scroller && Math.sign(target - element.scrollTop) === Math.sign(delta)
          const start = continuing ? target : element.scrollTop
          const next = Math.max(
            0,
            Math.min(
              element.scrollHeight - element.clientHeight,
              Math.max(element.scrollTop - 160, Math.min(element.scrollTop + 160, start + delta))
            )
          )
          if (next !== element.scrollTop) {
            event.preventDefault()
            if (scroller !== element) cancel()
            scroller = element
            target = next
            if (!frame) {
              lastTime = performance.now()
              frame = requestAnimationFrame(step)
            }
            return
          }
        }
        element = element.parentElement
      }
    }
    host.addEventListener('wheel', wheel, { passive: false })
    host.addEventListener('pointerdown', cancel, true)
    host.addEventListener('keydown', cancel, true)
    return () => {
      cancel()
      host.removeEventListener('wheel', wheel)
      host.removeEventListener('pointerdown', cancel, true)
      host.removeEventListener('keydown', cancel, true)
    }
  }, [root, disabled])
}
