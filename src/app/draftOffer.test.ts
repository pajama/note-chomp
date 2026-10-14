import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../core/model/factories';
import { draftToOffer } from './draftOffer';

const saved = { ...createEmptySong('Mine'), id: 'saved-1', events: [note('C', 4, 'q')] };
const blank = { ...createEmptySong(), id: 'new-1' };
const isSaved = (id: string) => id === saved.id;

describe('draftToOffer', () => {
  it('offers an unsaved song on #/new', () => {
    const draft = { ...createEmptySong('Lost'), id: 'lost-1', events: [note('E', 4, 'q')] };
    expect(draftToOffer(draft, blank, 'new', isSaved)).toBe(draft);
  });

  it('does not offer an empty draft or a saved song’s draft on #/new', () => {
    expect(draftToOffer({ ...blank, id: 'other' }, blank, 'new', isSaved)).toBeUndefined();
    const ofSaved = { ...saved, events: [note('G', 4, 'q')] };
    expect(draftToOffer(ofSaved, blank, 'new', isSaved)).toBeUndefined();
  });

  it('offers a saved song its own changed draft', () => {
    const draft = { ...saved, events: [note('G', 4, 'q')] };
    expect(draftToOffer(draft, saved, 'saved', isSaved)).toBe(draft);
    expect(draftToOffer({ ...saved }, saved, 'saved', isSaved)).toBeUndefined();
    const otherSong = { ...draft, id: 'saved-2' };
    expect(draftToOffer(otherSong, saved, 'saved', isSaved)).toBeUndefined();
  });

  it('never offers a draft over a starter copy, or when there is none', () => {
    const draft = { ...createEmptySong('Lost'), events: [note('E', 4, 'q')] };
    expect(draftToOffer(draft, blank, 'copy', isSaved)).toBeUndefined();
    expect(draftToOffer(undefined, blank, 'new', isSaved)).toBeUndefined();
  });
});
