import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadClip } from './clipUpload';
import { jsonResponse, makeClip, makeSession } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('clip upload protocol', () => {
  it('keeps the existing presign, PUT, and completion payloads', async () => {
    const session = makeSession();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { uploadUrl: 'https://upload.test/clip', objectKey: 'clip-key' } }))
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce(jsonResponse({ success: true, data: session }));
    vi.stubGlobal('fetch', fetchMock);
    const clip = makeClip();
    expect(await uploadClip({ sessionId: 10, clipId: 101, clip })).toEqual(session);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/reels-maker/sessions/10/clips/presign', 'https://upload.test/clip',
      '/api/reels-maker/sessions/10/clips/101/upload-complete',
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ clipId: 101, contentType: 'video/webm' });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PUT', body: clip.blob, headers: { 'Content-Type': 'video/webm' } });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ objectKey: 'clip-key', actualDurationSeconds: 3 });
  });

  it.each([0, 1, 2])('stops the protocol when step %i fails', async (failureIndex) => {
    const results = [
      jsonResponse({ success: true, data: { uploadUrl: 'https://upload.test', objectKey: 'key' } }),
      { ok: true } as Response,
      jsonResponse({ success: true, data: makeSession() }),
    ];
    results[failureIndex] = jsonResponse({ success: false, message: 'failed' }, false);
    const fetchMock = vi.fn();
    results.forEach((result) => fetchMock.mockResolvedValueOnce(result));
    vi.stubGlobal('fetch', fetchMock);
    await expect(uploadClip({ sessionId: 10, clipId: 101, clip: makeClip() })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(failureIndex + 1);
  });
});
