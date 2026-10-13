import type { OctaveShift } from '../../core/editor/editorReducer';
import { PITCHES, type Pitch } from '../../core/model/types';
import { isInRange } from '../../core/theory/pitch';
import { FruitArt } from '../../render/art/fruits';

const KEYS: { pitch: Pitch; baseOctave: 4 | 5 }[] = [
  ...PITCHES.map((pitch) => ({ pitch, baseOctave: 4 as const })),
  { pitch: 'C', baseOctave: 5 },
];

const OCTAVE_LABELS: Record<OctaveShift, string> = { [-1]: 'Low', 0: 'Middle', 1: 'High' };

export interface FruitKeyboardProps {
  octaveShift: OctaveShift;
  onNote: (pitch: Pitch, baseOctave: 4 | 5) => void;
  onShift: (delta: 1 | -1) => void;
}

export function FruitKeyboard({ octaveShift, onNote, onShift }: FruitKeyboardProps) {
  return (
    <div className="fruit-keyboard-wrap">
      <div className="octave-controls">
        <button
          type="button"
          className="secondary"
          aria-label="Lower notes"
          disabled={octaveShift === -1}
          onClick={() => onShift(-1)}
        >
          ▼
        </button>
        <span>{OCTAVE_LABELS[octaveShift]} notes</span>
        <button
          type="button"
          className="secondary"
          aria-label="Higher notes"
          disabled={octaveShift === 1}
          onClick={() => onShift(1)}
        >
          ▲
        </button>
      </div>
      <div className="fruit-keyboard">
        {KEYS.map(({ pitch, baseOctave }) => {
          const octave = baseOctave + octaveShift;
          return (
            <button
              key={`${pitch}${baseOctave}`}
              type="button"
              className="fruit-key"
              aria-label={`Add ${pitch}${octave}`}
              disabled={!isInRange(pitch, octave)}
              onClick={() => onNote(pitch, baseOctave)}
            >
              <svg viewBox="-0.6 -0.75 1.2 1.35" aria-hidden="true">
                {baseOctave === 5 && (
                  <circle data-testid="high-dot" cx={0} cy={-0.64} r={0.08} fill="currentColor" />
                )}
                <FruitArt pitch={pitch} hollow={false} />
              </svg>
              <span>{baseOctave === 5 ? `${pitch}↑` : pitch}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
