import { describe, expect, it } from 'vitest';
import { layoutSong, type LayoutItem, type SystemLayout } from '../core/layout';
import { METRICS } from '../core/layout/metrics';
import { BUNDLED_SONGS } from './index';

const S = 6.5; // default (Large) staff space in mm
const MIN_GAP = 0.3 * S;
const EPS = 1e-6;

interface NoteBox {
  label: string;
  /** Fruit bounding box (x ± size / 2). */
  fruitLeft: number;
  fruitRight: number;
  /** Including ledger lines, stem and dot. */
  left: number;
  right: number;
  /** Right end of an eighth-note flag (or of the stem if there is none). */
  flagRight: number;
}

/** Groups each fruit with the stem/flag/ledger/dot items that the layout emits for the same note. */
function noteBoxes(system: SystemLayout): NoteBox[] {
  const boxes: NoteBox[] = [];
  let pending: LayoutItem[] = [];
  for (const item of system.items) {
    if (item.kind === 'ledger' || item.kind === 'stem' || item.kind === 'flag') {
      pending.push(item);
      continue;
    }
    if (item.kind === 'fruit') {
      let left = item.x - item.size / 2;
      let right = item.x + item.size / 2;
      let flagRight = right;
      for (const part of pending) {
        if (part.kind === 'ledger') {
          left = Math.min(left, part.x1);
          right = Math.max(right, part.x2);
        } else if (part.kind === 'stem') {
          left = Math.min(left, part.x - part.width / 2);
          right = Math.max(right, part.x + part.width / 2);
        } else if (part.kind === 'flag') {
          flagRight = Math.max(flagRight, part.x + METRICS.flagReach * part.size);
        }
      }
      pending = [];
      boxes.push({
        label: `${item.pitch}${item.octave}#${item.eventIndex}`,
        fruitLeft: item.x - item.size / 2,
        fruitRight: item.x + item.size / 2,
        left,
        right,
        flagRight: Math.max(flagRight, right),
      });
      continue;
    }
    if (item.kind === 'dot' && boxes.length > 0 && pending.length === 0) {
      const last = boxes[boxes.length - 1];
      if (item.x > last.fruitLeft) last.right = Math.max(last.right, item.x + item.r);
    }
    if (item.kind !== 'label') pending = [];
  }
  return boxes;
}

describe('bundled songs at default options: fruit never collide', () => {
  for (const song of BUNDLED_SONGS) {
    it(`${song.title}: consecutive fruit boxes keep a ≥ 0.3-space gap`, () => {
      for (const page of layoutSong(song).pages) {
        for (const system of page.systems) {
          const boxes = noteBoxes(system);
          for (let i = 1; i < boxes.length; i++) {
            const gap = boxes[i].fruitLeft - boxes[i - 1].fruitRight;
            expect(gap + EPS, `${boxes[i - 1].label} → ${boxes[i].label}`).toBeGreaterThanOrEqual(
              MIN_GAP,
            );
          }
        }
      }
    });

    it(`${song.title}: ledgers, stems, flags and dots end ≥ 0.3 space before the next note`, () => {
      for (const page of layoutSong(song).pages) {
        for (const system of page.systems) {
          const boxes = noteBoxes(system);
          for (let i = 1; i < boxes.length; i++) {
            const [prev, next] = [boxes[i - 1], boxes[i]];
            const where = `${prev.label} → ${next.label}`;
            // ledger/stem/dot of one note vs ledger/stem/fruit of the next
            expect(next.left - prev.right + EPS, where).toBeGreaterThanOrEqual(MIN_GAP);
            // A flag hangs from the stem tip, inside the staff: it can only meet the next
            // note's fruit or stem, never its ledger lines (those are outside the staff).
            expect(next.fruitLeft - prev.flagRight + EPS, `${where} (flag)`).toBeGreaterThanOrEqual(
              MIN_GAP,
            );
          }
        }
      }
    });
  }
});
