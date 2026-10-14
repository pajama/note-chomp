import { useEffect, useRef, useState } from 'react';

export const HELP_LINES: readonly string[] = [
  'Tap a fruit key (or type C–B) to add a note at the blinking line.',
  'Tap a note on the staff to choose it. Then tap a fruit key, or drag it up and down, to change it.',
  '← → move between notes. ↑ ↓ move the chosen note up or down. Shift + ↑ ↓ switches high and low notes.',
  '1–4 pick a note length, “.” adds a dot, R adds a rest, Backspace deletes, Esc lets go of a note.',
  'Space plays your song (from the chosen note) and stops it.',
];

export function HelpPopover() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrap.current && e.target instanceof Node && !wrap.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div
      className="help"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="secondary help-button"
        aria-label="Help"
        aria-expanded={open}
        aria-controls="editor-help"
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <div
          id="editor-help"
          className="help-popover panel"
          role="dialog"
          aria-label="How to use the editor"
        >
          <ul>
            {HELP_LINES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
