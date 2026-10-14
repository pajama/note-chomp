import { FakeNotePlayer, type PlayerCall } from '../audio/FakeNotePlayer';
import type { NotePlayer } from '../audio/NotePlayer';
import { ToneNotePlayer } from '../audio/ToneNotePlayer';

/** Set before the app loads (Playwright addInitScript) to swap the real piano for a fake. */
export type FakeAudioFlag = true | 'fail-load';

declare global {
  interface Window {
    __NOTE_CHOMP_FAKE_AUDIO__?: FakeAudioFlag;
    /** The fake player's call log, for e2e assertions. */
    __NOTE_CHOMP_AUDIO_LOG__?: PlayerCall[];
  }
}

export type AudioSwitch = Pick<Window, '__NOTE_CHOMP_FAKE_AUDIO__' | '__NOTE_CHOMP_AUDIO_LOG__'>;

export function createNotePlayer(win: AudioSwitch): NotePlayer {
  const flag = win.__NOTE_CHOMP_FAKE_AUDIO__;
  if (flag === true || flag === 'fail-load') {
    const fake = new FakeNotePlayer({ failLoad: flag === 'fail-load' });
    win.__NOTE_CHOMP_AUDIO_LOG__ = fake.calls;
    return fake;
  }
  return new ToneNotePlayer();
}
