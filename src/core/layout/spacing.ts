import type { MusicEvent } from '../model/types';
import type { Measure } from '../theory/rhythm';
import { METRICS } from './metrics';

export function eventAdvance(e: MusicEvent): number {
  return METRICS.advance[e.duration] + (e.dotted ? METRICS.dottedExtra : 0);
}

export function measureWidth(m: Measure): number {
  const content = m.events.reduce((sum, placed) => sum + eventAdvance(placed.event), 0);
  return METRICS.barPadding + content + METRICS.measureEndPadding;
}

export function breakIntoSystems(widths: number[], available: number): number[][] {
  const systems: number[][] = [];
  let current: number[] = [];
  let used = 0;
  widths.forEach((width, index) => {
    if (current.length > 0 && used + width > available) {
      systems.push(current);
      current = [];
      used = 0;
    }
    current.push(index);
    used += width;
  });
  if (current.length > 0) systems.push(current);
  return systems;
}
