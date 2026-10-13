// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setNavigationGuard, subscribeToRoute, currentHash } from './router';

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
