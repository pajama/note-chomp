import { describe, expect, it } from 'vitest';
import { FakeNotePlayer } from '../audio/FakeNotePlayer';
import { ToneNotePlayer } from '../audio/ToneNotePlayer';
import { createNotePlayer, type AudioSwitch } from './audio';

describe('createNotePlayer', () => {
  it('uses the real piano by default', () => {
    expect(createNotePlayer({})).toBeInstanceOf(ToneNotePlayer);
  });

  it('uses a fake player and exposes its log when the e2e switch is on', () => {
    const win: AudioSwitch = { __NOTE_CHOMP_FAKE_AUDIO__: true };
    const player = createNotePlayer(win);
    expect(player).toBeInstanceOf(FakeNotePlayer);
    player.preview('C4');
    expect(win.__NOTE_CHOMP_AUDIO_LOG__).toEqual([{ kind: 'preview', note: 'C4' }]);
  });

  it('can simulate audio that fails to load', async () => {
    const player = createNotePlayer({ __NOTE_CHOMP_FAKE_AUDIO__: 'fail-load' });
    await expect(player.load()).rejects.toThrow();
  });
});
