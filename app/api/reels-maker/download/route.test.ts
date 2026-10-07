// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
const { get }=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('@/app/lib/api/server-client',()=>({getMutableServerApiClient:async()=>({get})}));
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>vi.unstubAllGlobals());
it('does not fetch files for another users session',async()=>{
  get.mockRejectedValue({response:{status:404}});
  const result=await GET(new NextRequest('https://web.test/api/reels-maker/download?sessionId=2&url=https://evil.test/file'));
  expect(result.status).toBe(404);expect(fetch).not.toHaveBeenCalled();
});
it('selects the server-owned result and ignores URL tampering',async()=>{
  const own='https://objectstorage.test.oraclecloud.com/p/object-only/n/ns/b/bucket/o/own.mp4';
  get.mockResolvedValue({data:{data:{finalVideoUrl:own}}});
  vi.mocked(fetch).mockResolvedValue(new Response('video',{headers:{'Content-Type':'video/mp4'}}));
  expect((await GET(new NextRequest('https://web.test/api/reels-maker/download?sessionId=1&url=https://evil.test/file'))).status).toBe(200);
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(own);
  expect(vi.mocked(fetch).mock.calls[0][1]?.redirect).toBe('error');
});
