import type { Duration, TimeSignature } from '../../core/model/types';
import { dotUnavailable, durationTooLong } from './durationChoices';

const OPTIONS: { duration: Duration; label: string; hint: string }[] = [
  { duration: 'w', label: 'Whole', hint: '4 beats (key 1)' },
  { duration: 'h', label: 'Half', hint: '2 beats (key 2)' },
  { duration: 'q', label: 'Quarter', hint: '1 beat (key 3)' },
  { duration: 'e', label: 'Eighth', hint: '½ beat (key 4)' },
];

export interface DurationPickerProps {
  duration: Duration;
  dotted: boolean;
  timeSignature: TimeSignature;
  onDuration: (duration: Duration) => void;
  onToggleDot: () => void;
  onRest: () => void;
  onBackspace: () => void;
}

export function DurationPicker({
  duration,
  dotted,
  timeSignature,
  onDuration,
  onToggleDot,
  onRest,
  onBackspace,
}: DurationPickerProps) {
  // A pressed Dot is never disabled, so it can always be switched off.
  const dotReason = dotted ? null : dotUnavailable(duration, timeSignature);
  // Rest and Delete are their own group so phone docks can put them beside the octave buttons,
  // where they always show instead of being pushed off the end of the length row.
  return (
    <>
      <div className="toolbar duration-picker" role="group" aria-label="Note length">
        {OPTIONS.map((o) => {
          const tooLong = durationTooLong(o.duration, timeSignature);
          return (
            <button
              key={o.duration}
              type="button"
              className="secondary"
              aria-pressed={duration === o.duration}
              disabled={tooLong}
              title={tooLong ? `Too long for ${timeSignature}` : o.hint}
              onClick={() => onDuration(o.duration)}
            >
              {o.label}
            </button>
          );
        })}
        <button
          type="button"
          className="secondary"
          aria-pressed={dotted}
          disabled={dotReason !== null}
          title={dotReason ?? 'Dotted: 1½ times as long (key .)'}
          onClick={onToggleDot}
        >
          Dot
        </button>
      </div>
      <div className="toolbar edit-actions" role="group" aria-label="Rest and delete">
        <button type="button" className="secondary" title="Add a rest (key R)" onClick={onRest}>
          Rest
        </button>
        <button
          type="button"
          className="secondary"
          aria-label="Delete note"
          title="Delete (Backspace)"
          onClick={onBackspace}
        >
          ⌫
        </button>
      </div>
    </>
  );
}
