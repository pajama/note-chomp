// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmLeave,
  currentHash,
  setNavigationGuard,
  subscribeToRoute,
  type LeaveReason,
} from './router';

const hashChange = () =>
  new Promise<void>((resolve) =>
    window.addEventListener('hashchange', () => resolve(), { once: true }),
  );

describe('navigation guard', () => {
  let cleanups: (() => void)[] = [];
  afterEach(() => {
    cleanups.forEach((c) => c());
    cleanups = [];
    window.history.replaceState(null, '', '#/');
  });

  it('lets navigation through when there is no guard', async () => {
    const onChange = vi.fn();
    cleanups.push(subscribeToRoute(onChange));
    window.location.hash = '#/import';
    await hashChange();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(currentHash()).toBe('#/import');
  });

  it('puts the old address back when the guard says no', async () => {
    window.history.replaceState(null, '', '#/new');
    const onChange = vi.fn();
    cleanups.push(subscribeToRoute(onChange));
    const guard = vi.fn(() => false);
    cleanups.push(setNavigationGuard(guard));
    window.location.hash = '#/import';
    await hashChange();
    expect(guard).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/new');
    expect(currentHash()).toBe('#/new');
  });

  it('asks once per navigation however many components listen', async () => {
    cleanups.push(subscribeToRoute(vi.fn()), subscribeToRoute(vi.fn()));
    const guard = vi.fn(() => true);
    cleanups.push(setNavigationGuard(guard));
    window.location.hash = '#/import';
    await hashChange();
    expect(guard).toHaveBeenCalledTimes(1);
    expect(currentHash()).toBe('#/import');
  });

  it('stops asking once the guard is removed', async () => {
    cleanups.push(subscribeToRoute(vi.fn()));
    const guard = vi.fn(() => false);
    setNavigationGuard(guard)();
    window.location.hash = '#/import';
    await hashChange();
    expect(guard).not.toHaveBeenCalled();
    expect(currentHash()).toBe('#/import');
  });
});

describe('confirmLeave', () => {
  it('says yes without a guard and asks the guard with the reason otherwise', () => {
    expect(confirmLeave('new-song')).toBe(true);
    const guard = vi.fn((reason: LeaveReason) => reason === 'navigate');
    const remove = setNavigationGuard(guard);
    expect(confirmLeave('new-song')).toBe(false);
    expect(confirmLeave('navigate')).toBe(true);
    expect(guard).toHaveBeenCalledWith('new-song');
    remove();
    expect(confirmLeave('new-song')).toBe(true);
  });

  it('passes "navigate" for hash changes', async () => {
    const guard = vi.fn(() => true);
    const cleanups = [subscribeToRoute(vi.fn()), setNavigationGuard(guard)];
    window.location.hash = '#/import';
    await hashChange();
    expect(guard).toHaveBeenCalledWith('navigate');
    cleanups.forEach((c) => c());
    window.history.replaceState(null, '', '#/');
  });
});
