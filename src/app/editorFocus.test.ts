import { describe, expect, it } from 'vitest';
import { note, rest } from '../core/model/factories';
import { scrollAnchorSelector, selectionAnnouncement } from './editorFocus';

describe('scrollAnchorSelector', () => {
  it('follows the playing note first, then the selection, then the cursor', () => {
    expect(scrollAnchorSelector(4, 1)).toBe('[data-kind="note-target"][data-event-index="4"]');
    expect(scrollAnchorSelector(null, 1)).toBe('[data-kind="note-target"][data-event-index="1"]');
    expect(scrollAnchorSelector(null, null)).toBe('[data-kind="cursor"]');
  });
});

describe('selectionAnnouncement', () => {
  const events = [note('G', 4, 'q'), rest('h')];
  it('describes the selected event', () => {
    expect(selectionAnnouncement(events, 0)).toBe('Selected Note 1: G, quarter note');
    expect(selectionAnnouncement(events, 1)).toBe('Selected Note 2: half rest');
  });
  it('is empty without a selection', () => {
    expect(selectionAnnouncement(events, null)).toBe('');
    expect(selectionAnnouncement(events, 7)).toBe('');
  });
});
