interface CleanupStep {
  name: string
  timeoutMs: number
  run: () => Promise<void>
}

// A failed or stalled cleanup step must not prevent the remaining shutdown work.
export async function cleanupForExit(
  steps: CleanupStep[],
  onError: (name: string, error: unknown) => void
): Promise<void> {
  for (const step of steps) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        Promise.resolve().then(step.run),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Shutdown cleanup timed out')), step.timeoutMs)
        })
      ])
    } catch (error) {
      onError(step.name, error)
    } finally {
      clearTimeout(timer)
    }
  }
}
