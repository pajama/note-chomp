import { BPM_RANGE } from '../../core/playback/schedule';
import type { PlaybackStatus } from '../playback/PlaybackController';
import { AUDIO_UNAVAILABLE_MESSAGE } from '../playback/PlaybackController';

export interface PlaybackControlsProps {
  status: PlaybackStatus;
  canPlay: boolean;
  bpm: number;
  onPlay: () => void;
  onStop: () => void;
  onBpm: (bpm: number) => void;
}

export function PlaybackControls({
  status,
  canPlay,
  bpm,
  onPlay,
  onStop,
  onBpm,
}: PlaybackControlsProps) {
  const busy = status === 'playing' || status === 'loading';
  return (
    <div className="playback-controls" role="group" aria-label="Playback">
      {busy ? (
        <button
          type="button"
          className="play-button"
          onClick={onStop}
          aria-label={status === 'loading' ? 'Loading piano, press to cancel' : 'Stop'}
        >
          {status === 'loading' ? 'Loading piano…' : '■ Stop'}
        </button>
      ) : (
        <button
          type="button"
          className="play-button"
          aria-label="Play"
          disabled={!canPlay || status === 'unavailable'}
          title={status === 'unavailable' ? AUDIO_UNAVAILABLE_MESSAGE : 'Play (Space)'}
          onClick={onPlay}
        >
          ▶ Play
        </button>
      )}
      <label className="tempo">
        <span aria-hidden="true">🐢</span>
        <input
          type="range"
          aria-label="Tempo"
          min={BPM_RANGE.min}
          max={BPM_RANGE.max}
          step={5}
          value={bpm}
          aria-valuetext={`${bpm} beats per minute`}
          onChange={(e) => onBpm(Number(e.target.value))}
        />
        <span aria-hidden="true">🐇</span>
      </label>
    </div>
  );
}
