import { describe, expect, it } from 'vitest';
import { note } from './factories';
import { validateSong } from './schema';

const base = { schemaVersion: 1, id: 'abc', title: 'Hot Cross Buns', timeSignature: '4/4' };

describe('validateSong', () => {
  it('accepts a valid song and trims the title', () => {
    const result = validateSong({
      ...base,
      title: '  Hot Cross Buns ',
      events: [note('E', 4, 'q')],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toBe('Hot Cross Buns');
  });

  it('rejects non-objects and wrong schema versions', () => {
    expect(validateSong(null).ok).toBe(false);
    expect(validateSong({ ...base, schemaVersion: 2, events: [] }).ok).toBe(false);
  });

  it('rejects an empty title', () => {
    const result = validateSong({ ...base, title: '   ', events: [] });
    expect(result.ok).toBe(false);
  });

  it('explains an over-long title or song in plain words', () => {
    const longTitle = validateSong({ ...base, title: 'x'.repeat(101), events: [] });
    expect(longTitle.ok || longTitle.error.map((i) => i.message)).toEqual([
      'The title is too long — keep it to 100 characters or fewer.',
    ]);
    const longSong = validateSong({ ...base, events: Array(2001).fill(note('C', 4, 'w')) });
    expect(longSong.ok || longSong.error.map((i) => i.message)).toEqual([
      'This song is too long — Note Chomp songs can have up to 2000 notes and rests.',
    ]);
  });

  it('rejects notes outside G3–C6 with a numbered message', () => {
    const result = validateSong({ ...base, events: [note('C', 4, 'q'), note('F', 3, 'q')] });
    expect(result).toEqual({
      ok: false,
      error: [
        {
          path: ['events', 1],
          message:
            "Note 2: F3 is outside Note Chomp's range (the G below middle C up to high C, G3–C6).",
        },
      ],
    });
  });

  it('rejects unsupported time signatures', () => {
    expect(validateSong({ ...base, timeSignature: '6/8', events: [] }).ok).toBe(false);
  });

  it('rejects bar-crossing notes', () => {
    const result = validateSong({ ...base, events: [note('C', 4, 'h', true), note('D', 4, 'h')] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error[0].path).toEqual(['events', 1]);
    expect(result.error[0].message).toMatch(/^Measure 1:/);
  });
});
