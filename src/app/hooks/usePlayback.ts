import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Song } from '../../core/model/types';
import { BPM_RANGE } from '../../core/playback/schedule';
import { PlaybackController, type PlaybackStatus } from '../playback/PlaybackController';
import { useServices } from '../services';

export interface Playback {
  status: PlaybackStatus;
  playing: boolean;
  currentEventIndex: number | null;
  error: string | null;
  bpm: number;
  setBpm: (bpm: number) => void;
  play: (fromIndex?: number) => void;
  stop: () => void;
  preview: (note: string) => void;
  dismissError: () => void;
}

export function usePlayback(song: Song): Playback {
  const { player } = useServices();
  const controller = useMemo(() => new PlaybackController(player), [player]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [bpm, setBpm] = useState<number>(BPM_RANGE.default);

  // Any edit while playing stops playback (a title change is not an edit to the music).
  const music = useRef({ events: song.events, timeSignature: song.timeSignature });
  useEffect(() => {
    const before = music.current;
    if (before.events === song.events && before.timeSignature === song.timeSignature) return;
    music.current = { events: song.events, timeSignature: song.timeSignature };
    controller.stop();
  }, [song.events, song.timeSignature, controller]);

  // A new tempo while playing carries on from the note now sounding, at the new speed.
  const latest = useRef({ song, snapshot });
  useEffect(() => {
    latest.current = { song, snapshot };
  });
  const playedBpm = useRef(bpm);
  useEffect(() => {
    if (playedBpm.current === bpm) return;
    playedBpm.current = bpm;
    const { song: current, snapshot: now } = latest.current;
    if (now.status !== 'playing' || now.currentEventIndex === null) return;
    void controller.play(current, bpm, now.currentEventIndex);
  }, [bpm, controller]);

  useEffect(() => () => controller.stop(), [controller]);
  // Fetch Tone's code now (no sound yet), so the first Play can resume audio inside the gesture.
  useEffect(() => player.prefetch(), [player]);

  const play = useCallback(
    (fromIndex = 0) => void controller.play(song, bpm, fromIndex),
    [controller, song, bpm],
  );
  const stop = useCallback(() => controller.stop(), [controller]);
  const preview = useCallback((note: string) => controller.preview(note), [controller]);
  const dismissError = useCallback(() => controller.dismissError(), [controller]);

  return {
    status: snapshot.status,
    playing: snapshot.status === 'playing' || snapshot.status === 'loading',
    currentEventIndex: snapshot.currentEventIndex,
    error: snapshot.error,
    bpm,
    setBpm,
    play,
    stop,
    preview,
    dismissError,
  };
}
