import type { LabelItem } from './types';

export function labelItem(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: string,
  anchor: LabelItem['anchor'],
  weight: LabelItem['weight'],
): LabelItem {
  return { kind: 'label', text, x, y, fontSize, color, anchor, weight };
}
