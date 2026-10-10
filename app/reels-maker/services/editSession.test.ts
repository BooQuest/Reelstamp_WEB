import { afterEach, expect, it, vi } from 'vitest';
import { authFetch } from '@/app/lib/auth/browser-session';
import { finishEditorSession, loadEditorSession, makerFetch, releaseEditorSession, stopEditorRequests } from './editSession';

vi.mock('@/app/lib/auth/browser-session', () => ({ authFetch: vi.fn() }));
const fetcher = vi.mocked(authFetch);
const reply = (data: unknown, status = 200) => new Response(JSON.stringify({ success: status < 400, data }), { status });
const saved = { sessionId: 10, templateId: 't', draftSavingEnabled: true, draftVersion: 7, status: 'CAPTURE' };
afterEach(() => { releaseEditorSession(10); sessionStorage.clear(); vi.resetAllMocks(); });

it('keeps the new project edit token through URL replacement and reload', async () => {
  fetcher.mockResolvedValueOnce(reply({ ...saved, newEdit: true }));
  await loadEditorSession('t', null);
  const token = new Headers(fetcher.mock.calls[0][1]?.headers).get('X-Reelstamp-Edit-Token');
  expect(token).toBeTruthy();
  fetcher.mockResolvedValueOnce(reply(saved)).mockResolvedValueOnce(reply({ ...saved, newEdit: true }));
  await loadEditorSession('t', '10');
  expect(new Headers(fetcher.mock.calls[2][1]?.headers).get('X-Reelstamp-Edit-Token')).toBe(token);
  expect(fetcher.mock.calls[2][0]).toBe('/api/reels-maker/sessions/10/edit');
});

it('starts existing projects with the server version and does not upload a client snapshot', async () => {
  fetcher.mockResolvedValueOnce(reply(saved)).mockResolvedValueOnce(reply(saved));
  await loadEditorSession('t', '10');
  expect(JSON.parse(fetcher.mock.calls[1][1]?.body as string)).toEqual({ version: 7 });
});

it('blocks queued writes after stopping while allowing discard and read requests', async () => {
  fetcher.mockResolvedValue(reply(saved));
  await loadEditorSession('t', null);
  stopEditorRequests(10);
  await expect(makerFetch('/api/reels-maker/sessions/10/draft', { method: 'PUT' })).rejects.toMatchObject({ name: 'AbortError' });
  await makerFetch('/api/reels-maker/sessions/10', { cache: 'no-store' });
  await finishEditorSession(10, 'discard', 7);
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe('/api/reels-maker/sessions/10/edit/discard');
  expect(sessionStorage.getItem('reelstamp:edit:10')).toBeNull();
});

it('retains the token when discard fails so the same operation can be retried', async () => {
  fetcher.mockResolvedValueOnce(reply(saved));
  await loadEditorSession('t', null);
  const token = sessionStorage.getItem('reelstamp:edit:10');
  fetcher.mockResolvedValueOnce(reply(null, 503));
  await expect(finishEditorSession(10, 'discard', 7)).rejects.toThrow();
  expect(sessionStorage.getItem('reelstamp:edit:10')).toBe(token);
  fetcher.mockResolvedValueOnce(reply({ outcome: 'DISCARDED' }));
  await finishEditorSession(10, 'discard', 7);
  expect(new Headers(fetcher.mock.calls.at(-1)?.[1]?.headers).get('X-Reelstamp-Edit-Token')).toBe(token);
});

it('never forwards an edit token to object storage', async () => {
  fetcher.mockResolvedValue(reply(saved));
  await loadEditorSession('t', null);
  await makerFetch('https://storage.example/upload', { method: 'PUT', body: new Blob(['video']) });
  expect(new Headers(fetcher.mock.calls.at(-1)?.[1]?.headers).has('X-Reelstamp-Edit-Token')).toBe(false);
});

it('does not begin editable sessions for processing or completed projects', async () => {
  fetcher.mockResolvedValueOnce(reply({ ...saved, status: 'PROCESSING' }));
  await loadEditorSession('t', '10');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('uses a new edit token when returning after a confirmed save', async () => {
  fetcher.mockResolvedValueOnce(reply(saved));
  await loadEditorSession('t', null);
  const original = sessionStorage.getItem('reelstamp:edit:10');
  fetcher.mockResolvedValueOnce(reply({ outcome: 'SAVED' }));
  await finishEditorSession(10, 'save', 7);
  fetcher.mockResolvedValueOnce(reply(saved)).mockResolvedValueOnce(reply(saved));
  await loadEditorSession('t', '10');
  expect(sessionStorage.getItem('reelstamp:edit:10')).not.toBe(original);
});
