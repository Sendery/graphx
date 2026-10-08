/* El panel del terminal como texto plano: el mismo lienzo (hooks/canvas.tsx) pintado sobre una superficie quieta,
 * sin color ni movimiento. Es lo que `view` le enseña a Claude para que compruebe cómo se lee lo que ha dibujado. */
import Canvas from '../canvas'
import type { Caps, Scene } from '../../types'
import { Grid } from './grid'

export function textFrame(scene: Scene, caps: Caps, cols: number, rows: number): string {
  const surface = {
    elements: { Box: () => null, Text: () => null }, state: undefined, setState() { }, columns: cols, rows,
    every: () => () => { }, onPointer: () => () => { }, onKey: () => () => { }, post() { }, grid: true,
  }
  const still: Caps = { ...caps, motion: 'off' }
  const out = (Canvas as unknown as (p: unknown, s: unknown) => unknown)({ scene: { ...scene, fresh: false }, caps: still, detail: null, height: rows, width: cols, pane: 'dock' }, surface)
  return out instanceof Grid ? out.plain() : '(el lienzo no ha dibujado nada)'
}
