// @vitest-environment node
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { NextRequest } from 'next/server';
import { GET } from './route';
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/app/lib/api/server-client', () => ({
  getMutableServerApiClient: async () => ({ get }),
}));
const realFetch = globalThis.fetch;
const own =
  'https://objectstorage.test.oraclecloud.com/p/owned/n/ns/b/media/o/video.mp4';
let server: Server;
let address: string;
let receivedRange: string | undefined;
beforeAll(async () => {
  server = createServer((request, response) => {
    receivedRange = request.headers.range;
    if (receivedRange === 'bytes=2-5') {
      response.writeHead(206, {
        'Content-Type': 'video/mp4',
        'Content-Range': 'bytes 2-5/10',
        'Content-Length': '4',
        'Accept-Ranges': 'bytes',
      });
      response.end('2345');
    } else {
      response.writeHead(416, { 'Content-Range': 'bytes */10' });
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  address = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({
    data: { data: { mediaAssets: [{ id: 'a', downloadUrl: own }], clips: [] } },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: unknown, options?: RequestInit) =>
      realFetch(address, options),
    ),
  );
});
const request = (query = 'assetId=a', range = 'bytes=2-5') =>
  GET(
    new NextRequest(
      `https://web.test/api/reels-maker/sessions/1/media?${query}`,
      { headers: { range } },
    ),
    { params: Promise.resolve({ sessionId: '1' }) },
  );
it('streams actual partial bytes and Range headers from storage', async () => {
  const result = await request();
  expect(result.status).toBe(206);
  expect(await result.text()).toBe('2345');
  expect(receivedRange).toBe('bytes=2-5');
  expect(result.headers.get('content-range')).toBe('bytes 2-5/10');
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(own);
});
it('preserves storage range errors rather than reporting a successful video', async () => {
  const result = await request('assetId=a', 'bytes=30-40');
  expect(result.status).toBe(416);
  expect(result.headers.get('content-range')).toBe('bytes */10');
});
it('rejects unowned assets and arbitrary URLs without storage access', async () => {
  expect((await request('assetId=someone-elses')).status).toBe(404);
  expect((await request('url=https://evil.test')).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
it('checks session ownership before accessing assets', async () => {
  get.mockRejectedValue({ response: { status: 404 } });
  expect((await request()).status).toBe(404);
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects a non-storage redirect target supplied by upstream data', async () => {
  get.mockResolvedValue({
    data: {
      data: {
        mediaAssets: [{ id: 'a', downloadUrl: 'https://evil.test/movie' }],
      },
    },
  });
  expect((await request()).status).toBe(502);
  expect(fetch).not.toHaveBeenCalled();
});
