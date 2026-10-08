import { useCallback, useEffect, useRef, useState } from 'react'

export function useSidebarExpansion(enabled: boolean): {
  expanded: boolean
  scheduleExpansion: () => void
  expandImmediately: () => void
  collapse: () => void
} {
  const [expanded, setExpanded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = undefined
  }, [])
  const collapse = useCallback(() => {
    cancel()
    setExpanded(false)
  }, [cancel])
  const expandImmediately = useCallback(() => {
    cancel()
    if (enabled) setExpanded(true)
  }, [cancel, enabled])
  const scheduleExpansion = useCallback(() => {
    cancel()
    if (!enabled) return
    timer.current = setTimeout(() => {
      timer.current = undefined
      setExpanded(true)
    }, 2000)
  }, [cancel, enabled])
  useEffect(() => {
    if (!enabled) collapse()
    return cancel
  }, [enabled, collapse, cancel])
  return { expanded, scheduleExpansion, expandImmediately, collapse }
}
