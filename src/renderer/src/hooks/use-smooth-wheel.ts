import { useEffect, type RefObject } from 'react'
import { advanceScroll } from './smooth-scroll-motion'

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
    let lastWritten = 0
    let position = 0
    let velocity = 0
    const cancel = (): void => {
      cancelAnimationFrame(frame)
      frame = 0
      scroller = null
      velocity = 0
    }
    const step = (now: number): void => {
      if (!scroller?.isConnected || reduced.matches) {
        cancel()
        return
      }
      const dt = Math.min(64, now - lastTime) / 1000
      lastTime = now
      target = Math.max(0, Math.min(target, scroller.scrollHeight - scroller.clientHeight))
      // Retain fractional positions instead of feeding rounded DOM pixels back into motion.
      const next = advanceScroll(position, velocity, target, dt)
      position = Math.max(0, Math.min(next.position, scroller.scrollHeight - scroller.clientHeight))
      velocity = next.velocity
      const settled = Math.abs(target - position) < 0.5 && Math.abs(velocity) < 8
      scroller.scrollTo({ top: settled ? target : position, behavior: 'instant' })
      lastWritten = scroller.scrollTop
      if (settled) {
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
        event.target.closest(
          'textarea, select, input[type="number"], input[type="range"], .monaco-editor'
        )
      ) {
        cancel()
        return
      }
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
            if (scroller !== element) {
              cancel()
              position = element.scrollTop
            } else if (!continuing) {
              // A reversal cancels outstanding travel without jumping the current position.
              velocity = 0
            }
            scroller = element
            target = next
            lastWritten = element.scrollTop
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
    const onScroll = (event: Event): void => {
      if (scroller && event.target === scroller && Math.abs(scroller.scrollTop - lastWritten) > 1)
        cancel()
    }
    host.addEventListener('wheel', wheel, { passive: false })
    host.addEventListener('scroll', onScroll, true)
    host.addEventListener('pointerdown', cancel, true)
    host.addEventListener('keydown', cancel, true)
    return () => {
      cancel()
      host.removeEventListener('wheel', wheel)
      host.removeEventListener('scroll', onScroll, true)
      host.removeEventListener('pointerdown', cancel, true)
      host.removeEventListener('keydown', cancel, true)
    }
  }, [root, disabled])
}
