import { expect, it } from 'vitest';
import { SessionInitialization } from './sessionInitialization';

it('treats creation, delayed navigation and the assigned URL as one initialization', () => {
  const start = new SessionInitialization();
  start.observe('template', null);
  const attempt = start.begin()!;
  expect(start.begin()).toBeNull();
  start.resolved(attempt, 10);
  start.finish(attempt, 'ready');
  expect(start.begin()).toBeNull();
  start.observe('template', '10');
  expect(start.isCurrent(attempt)).toBe(true);
  expect(start.begin()).toBeNull();
  // Removing the ID after navigation represents a genuinely new production.
  start.observe('template', null);
  expect(start.begin()?.sessionId).toBeNull();
});

it('retries hydration using the assigned project and never creates another', () => {
  const start = new SessionInitialization();
  start.observe('template', null);
  const first = start.begin()!;
  start.resolved(first, 10);
  start.finish(first, 'failed');
  expect(start.begin()).toBeNull();
  const retry = start.begin('retry')!;
  expect(retry.sessionId).toBe('10');
  expect(start.begin('retry')).toBeNull();
  start.finish(first, 'ready'); // A late attempt cannot finish the retry.
  expect(start.begin('reload')).toBeNull();
});

it('does not automatically retry an ambiguous creation failure', () => {
  const start = new SessionInitialization();
  start.observe('template', null);
  const first = start.begin()!;
  start.finish(first, 'failed');
  start.observe('template', null);
  expect(start.begin()).toBeNull();
  expect(start.begin('retry')).not.toBeNull();
});

it('invalidates late results when another project or template is opened', () => {
  const start = new SessionInitialization();
  start.observe('template', '10');
  const old = start.begin()!;
  start.observe('template', '11');
  const current = start.begin()!;
  start.resolved(old, 10);
  start.finish(old, 'ready');
  expect(start.isCurrent(old)).toBe(false);
  expect(current.sessionId).toBe('11');
  expect(start.begin()).toBeNull();
  start.observe('other-template', null);
  expect(start.isCurrent(current)).toBe(false);
  expect(start.begin()?.templateId).toBe('other-template');
});

it('reloads a failed production using the existing project even before URL acknowledgment', () => {
  const start = new SessionInitialization();
  start.observe('template', null);
  const first = start.begin()!;
  start.resolved(first, 10);
  start.finish(first, 'ready');
  expect(start.begin('reload')?.sessionId).toBe('10');
});

it('can start another production explicitly before the previous URL was acknowledged', () => {
  const start = new SessionInitialization();
  start.observe('template', null);
  const first = start.begin()!;
  start.resolved(first, 10);
  start.finish(first, 'ready');
  start.reset();
  expect(start.begin()?.sessionId).toBeNull();
  expect(start.isCurrent(first)).toBe(false);
});
