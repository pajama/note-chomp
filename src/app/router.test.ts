import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash, type Route } from './router';

describe('router', () => {
  it.each<[string, Route]>([
    ['', { name: 'songbook' }],
    ['#/', { name: 'songbook' }],
    ['#/new', { name: 'new' }],
    ['#/import', { name: 'import' }],
    ['#/edit/abc-123', { name: 'edit', id: 'abc-123' }],
    ['#/print/builtin-ode-to-joy', { name: 'print', id: 'builtin-ode-to-joy' }],
    ['#/edit', { name: 'notFound' }],
    ['#/whatever/else/here', { name: 'notFound' }],
    ['#/edit/%E0%A4%A', { name: 'notFound' }],
  ])('parses %s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it('round-trips routes with ids that need encoding', () => {
    const route: Route = { name: 'edit', id: 'a b/c' };
    expect(parseHash(routeToHash(route))).toEqual(route);
  });
});
