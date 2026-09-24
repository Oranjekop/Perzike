// Critically damped motion keeps velocity continuous when another wheel step arrives.
// Integrate using elapsed time so 60 Hz and high-refresh displays follow the same curve.
export function advanceScroll(
  position: number,
  velocity: number,
  target: number,
  seconds: number
): { position: number; velocity: number } {
  const frequency = 32
  const offset = position - target
  const coefficient = velocity + frequency * offset
  const decay = Math.exp(-frequency * seconds)
  return {
    position: target + (offset + coefficient * seconds) * decay,
    velocity: (velocity - frequency * coefficient * seconds) * decay
  }
}
