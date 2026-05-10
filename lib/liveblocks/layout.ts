export function defaultPanelSizes(n: number): number[] {
  if (n < 1 || n > 4) throw new Error(`Panel count must be 1–4, got ${n}`)
  if (n === 1) return [100]
  if (n === 2) return [50, 50]
  if (n === 3) return [33, 33, 34]
  return [25, 25, 25, 25]
}
