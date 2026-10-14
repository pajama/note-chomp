import { describe, expect, it } from 'vitest';
import { NOT_MUSIC_ERROR, parseAbc, skippedWarning } from './parseAbc';

const tune = (body: string) => `X:1\nT:Test Tune\nM:4/4\nL:1/4\nK:C\n${body}\n`;

describe('parseAbc with text that is not music', () => {
  it.each([
    'hello world',
    'Shopping list: milk, eggs, bread',
    'Dear Grandma, thank you for the cake!',
  ])('rejects %j instead of importing a few stray letters', (text) => {
    expect(parseAbc(text)).toEqual({ ok: false, errors: [{ message: NOT_MUSIC_ERROR }] });
  });

  it('rejects a tune whose body is mostly unreadable', () => {
    expect(parseAbc(tune('hello there, my friend'))).toEqual({
      ok: false,
      errors: [{ message: NOT_MUSIC_ERROR }],
    });
  });

  it('keeps the specific error when a real tune also has unreadable characters', () => {
    expect(parseAbc(tune('^C # & |]'))).toEqual({
      ok: false,
      errors: [
        { message: "Measure 1: C♯ isn't in the key of C. Only white keys are supported for now." },
      ],
    });
  });

  it('still imports a headerless body that reads cleanly', () => {
    const result = parseAbc('C D E F | G4 |]');
    expect(result.ok).toBe(true);
  });
});

describe('unrecognized symbols', () => {
  it('collapse into one warning with a count', () => {
    const result = parseAbc(tune('C D # E F | & G4 |]'));
    if (!result.ok) throw new Error(result.errors.map((e) => e.message).join('\n'));
    expect(result.warnings).toEqual([{ message: "Skipped 2 characters we didn't understand." }]);
  });

  it('says "character" for one', () => {
    expect(skippedWarning(1)).toBe("Skipped 1 character we didn't understand.");
    expect(skippedWarning(14)).toBe("Skipped 14 characters we didn't understand.");
  });
});
