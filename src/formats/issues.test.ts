import { describe, expect, it } from 'vitest';
import { finalizeImport } from './finalize';
import { IssueCollector } from './issues';

describe('IssueCollector', () => {
  it('de-duplicates messages and tracks errors', () => {
    const issues = new IssueCollector();
    issues.warn('Lyrics were ignored.');
    issues.warn('Lyrics were ignored.');
    expect(issues.warnings).toEqual([{ message: 'Lyrics were ignored.' }]);
    expect(issues.hasErrors).toBe(false);
    issues.error('Bad');
    expect(issues.hasErrors).toBe(true);
  });
});

describe('finalizeImport', () => {
  const draft = (events: unknown[]) => ({
    schemaVersion: 1,
    id: 'x',
    title: 'T',
    timeSignature: '4/4',
    events,
  });

  it('fails when errors were collected', () => {
    const issues = new IssueCollector();
    issues.error("Measure 1: chords aren't supported.");
    expect(finalizeImport(draft([]), issues)).toEqual({
      ok: false,
      errors: [{ message: "Measure 1: chords aren't supported." }],
    });
  });

  it('fails when there are no notes', () => {
    expect(finalizeImport(draft([]), new IssueCollector())).toEqual({
      ok: false,
      errors: [{ message: 'No notes were found in this file.' }],
    });
  });

  it('treats a file with only rests as having no notes', () => {
    const restsOnly = draft([
      { kind: 'rest', duration: 'w' },
      { kind: 'rest', duration: 'h' },
    ]);
    expect(finalizeImport(restsOnly, new IssueCollector())).toEqual({
      ok: false,
      errors: [{ message: 'No notes were found in this file.' }],
    });
  });

  it('returns the validated song and warnings', () => {
    const issues = new IssueCollector();
    issues.warn('Lyrics were ignored.');
    const result = finalizeImport(
      draft([{ kind: 'note', pitch: 'C', octave: 4, duration: 'q' }]),
      issues,
    );
    expect(result).toMatchObject({ ok: true, warnings: [{ message: 'Lyrics were ignored.' }] });
  });
});
