import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AUDIO_UNAVAILABLE_MESSAGE } from '../playback/PlaybackController';
import { PlaybackControls, type PlaybackControlsProps } from './PlaybackControls';

const props: PlaybackControlsProps = {
  status: 'idle',
  canPlay: true,
  bpm: 90,
  onPlay: () => {},
  onStop: () => {},
  onBpm: () => {},
};
const render = (p: Partial<PlaybackControlsProps> = {}) =>
  renderToStaticMarkup(<PlaybackControls {...props} {...p} />);

describe('PlaybackControls', () => {
  it('offers Play and a 60–160 tempo slider', () => {
    const html = render();
    expect(html).toContain('aria-label="Play"');
    expect(html).toContain('min="60"');
    expect(html).toContain('max="160"');
    expect(html).toContain('value="90"');
  });
  it('shows Stop while playing and a loading label while the piano loads', () => {
    expect(render({ status: 'playing' })).toContain('■ Stop');
    expect(render({ status: 'loading' })).toContain('Loading piano…');
    expect(render({ status: 'loading' })).toContain('aria-label="Loading piano, press to cancel"');
  });
  it('disables Play with an explanation when audio is unavailable', () => {
    const html = render({ status: 'unavailable' });
    expect(html).toContain('disabled=""');
    expect(html).toContain(`title="${AUDIO_UNAVAILABLE_MESSAGE.replace("'", '&#x27;')}"`);
  });
});
