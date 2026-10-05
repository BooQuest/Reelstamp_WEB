import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReelsMakerPage from './page';
import { createPosterFromClip, generateTimelineThumbnails } from './utils/media/previews';
import { imageToVideoBlob } from './utils/media/imageVideo';
import { loadVideoMetadataFromUrl } from './utils/media/metadata';
import { captureVideoSegmentToBlob } from './utils/media/videoSegment';
import { downloadFixedClip } from './services/fixedClip';
import { FakeMediaRecorder, installObjectUrls, jsonResponse, makeClip, makeCut, makeSession } from './test/fixtures';
import type { ReelsMakerSessionResponse } from './types';
import { makeStream } from './test/fixtures';

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams('templateId=template'),
  router: { push: vi.fn(), replace: vi.fn() },
  auth: { isAuthenticated: true, user: { id: 1, role: 'USER', guest: true, provider: 'GUEST' }, setUser: vi.fn() },
}));
vi.mock('next/navigation', () => ({ useRouter: () => navigation.router, useSearchParams: () => navigation.params }));
vi.mock('@/app/components/providers/AuthProvider', () => ({ useAuth: () => navigation.auth }));
// jsdom has no media decoder; keep the production coordinator, controls, hooks and HTTP protocol.
vi.mock('./components/CameraPreviewVideo', () => ({ default: () => <div data-testid="camera-preview" /> }));
vi.mock('./components/CapturedClipPreview', () => ({ default: () => <div data-testid="clip-preview" /> }));
vi.mock('./components/FixedClipVideo', () => ({ default: () => <div data-testid="fixed-preview" /> }));
vi.mock('./utils/media/previews', () => ({
  createPosterFromClip: vi.fn(), generateTimelineThumbnails: vi.fn(),
  revokeBlobUrl: (url: string | null) => { if (url?.startsWith('blob:')) URL.revokeObjectURL(url); },
}));
vi.mock('./utils/media/imageVideo', () => ({ imageToVideoBlob: vi.fn() }));
vi.mock('./utils/media/metadata', () => ({ loadVideoMetadataFromUrl: vi.fn() }));
vi.mock('./utils/media/videoSegment', () => ({ captureVideoSegmentToBlob: vi.fn() }));
vi.mock('./services/fixedClip', () => ({ downloadFixedClip: vi.fn() }));

let session: ReelsMakerSessionResponse;
let fetchMock: ReturnType<typeof vi.fn>;
let failUpload: boolean;
let templateCuts: ReturnType<typeof makeCut>[];
let getUserMedia: ReturnType<typeof vi.fn>;
beforeEach(() => {
  installObjectUrls();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => { });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  navigation.params = new URLSearchParams('templateId=template');
  session = makeSession();
  templateCuts = [makeCut()];
  failUpload = false;
  FakeMediaRecorder.instances = [];
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  getUserMedia = vi.fn().mockImplementation(async () => makeStream());
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia, enumerateDevices: async () => [] } });
  vi.stubGlobal('alert', vi.fn());
  vi.mocked(createPosterFromClip).mockResolvedValue('data:image/jpeg;base64,poster');
  vi.mocked(imageToVideoBlob).mockResolvedValue(makeClip());
  vi.mocked(loadVideoMetadataFromUrl).mockResolvedValue({ duration: 10, width: 1080, height: 1920 });
  vi.mocked(generateTimelineThumbnails).mockResolvedValue([]);
  vi.mocked(captureVideoSegmentToBlob).mockResolvedValue(makeClip());
  vi.mocked(downloadFixedClip).mockResolvedValue({ ...makeClip(), url: 'blob:fixed' });
  fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === '/api/templates/template') return jsonResponse({ success: true, data: { id: 'template', title: '테스트 템플릿', cuts: templateCuts } });
    if (url === '/api/reels-maker/sessions' || url === '/api/reels-maker/sessions/10') return jsonResponse({ success: true, data: session });
    if (url.endsWith('/clips/presign')) {
      const { clipId } = JSON.parse(String(init?.body));
      return jsonResponse({ success: true, data: { uploadUrl: `https://upload.test/${clipId}`, objectKey: `clip-${clipId}` } });
    }
    if (url.startsWith('https://upload.test/')) return { ok: !failUpload };
    if (url.endsWith('/upload-complete')) {
      const clipId = Number(url.split('/').at(-2));
      session = { ...session, clips: session.clips.map((clip) => clip.clipId === clipId ? { ...clip, status: 'UPLOADED' } : clip) };
      return jsonResponse({ success: true, data: session });
    }
    if (url.endsWith('/complete')) return jsonResponse({ success: true, data: { sessionId: 10, status: 'PROCESSING' } });
    if (url.endsWith('/status')) return jsonResponse({ success: true, data: { sessionId: 10, status: 'COMPLETED', finalVideoUrl: 'https://media.test/final.mp4' } });
    if (url.startsWith('/api/reels-maker/download?')) return { ok: true, blob: async () => makeClip().blob };
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

async function openMaker() {
  render(<ReelsMakerPage />);
  const guest = await screen.findByRole('button', { name: '저장 없이 계속하기' });
  fireEvent.click(guest);
  const guideClose = screen.queryByRole('button', { name: '템플릿 가이드 닫기' });
  if (guideClose) fireEvent.click(guideClose);
  await waitFor(() => expect(screen.getByRole('button', { name: '현재 컷 촬영' })).toBeEnabled());
  await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
}

async function importFile(type = 'image/jpeg') {
  const file = new File(['media'], type.startsWith('image') ? 'photo.jpg' : 'clip.mp4', { type });
  vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([{ getFile: async () => file }]));
  fireEvent.click(screen.getByRole('button', { name: '갤러리' }));
  if (type.startsWith('video')) {
    await screen.findByText('영상 구간 선택');
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
  }
}

async function recordClip() {
  fireEvent.click(screen.getByRole('button', { name: '현재 컷 촬영' }));
  fireEvent.click(await screen.findByRole('button', { name: '촬영 종료' }));
  await screen.findByTestId('clip-preview');
}

describe('reels maker input integration', () => {
  it('keeps camera and gallery controls and completes a camera clip through the existing API', async () => {
    await openMaker();
    expect(screen.getByRole('button', { name: '갤러리' })).toBeEnabled();
    await recordClip();
    fireEvent.click(await screen.findByRole('button', { name: '완료하기' }));
    fireEvent.click(screen.getByRole('button', { name: '편집 없이 완료' }));
    await screen.findByText('릴스 제작 완료');
    const completion = fetchMock.mock.calls.find(([url]) => url.endsWith('/sessions/10/complete'));
    expect(JSON.parse(completion?.[1].body)).toEqual({ captionItems: [], captionsEnabled: true, acceptedStaleAutoCaptionClipIds: [] });
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/clips/presign'))).toHaveLength(1);
  });

  it.each(['image/jpeg', 'video/mp4'])('imports %s through the same clip upload protocol', async (type) => {
    await openMaker();
    await importFile(type);
    await waitFor(() => expect(screen.getByRole('button', { name: '완료하기' })).toBeEnabled());
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/upload-complete'))).toHaveLength(1);
    expect(screen.getByTestId('clip-preview')).toBeInTheDocument();
  });

  it('asks before replacing a recording and retains its preview when gallery upload fails', async () => {
    await openMaker();
    await recordClip();
    failUpload = true;
    await importFile();
    expect(screen.getByText('파일로 교체할까요?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '파일 선택' }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('클립 업로드에 실패했습니다.'));
    expect(screen.getByTestId('clip-preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '완료하기' })).toBeEnabled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:test-1');
  });

  it('advances over fixed cuts to the next incomplete cut after import', async () => {
    templateCuts = [makeCut(), makeCut({ order: 2, captureType: 'FIXED', isFixed: true, fixedVideoUrl: 'https://fixed.test' }), makeCut({ order: 3 })];
    session = makeSession({
      clips: [
        { clipId: 101, order: 1, durationSeconds: 3 },
        { clipId: 102, order: 2, durationSeconds: 3, fixed: true },
        { clipId: 103, order: 3, durationSeconds: 3 },
      ]
    });
    await openMaker();
    await importFile();
    await screen.findByRole('button', { name: '3컷 촬영하기' });
    expect(screen.queryByRole('button', { name: '완료하기' })).not.toBeInTheDocument();
    expect(downloadFixedClip).toHaveBeenCalledTimes(1);
  });

  it('restores an uploaded project without uploading it again', async () => {
    navigation.params = new URLSearchParams('templateId=template&sessionId=10');
    session = makeSession({ lastActiveClipOrder: 1, clips: [{ clipId: 101, order: 1, durationSeconds: 3, status: 'UPLOADED', downloadUrl: 'https://saved.test/clip' }] });
    render(<ReelsMakerPage />);
    await screen.findByTestId('clip-preview');
    expect(screen.getByRole('button', { name: '완료하기' })).toBeEnabled();
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/clips/presign'))).toBe(false);
    expect(screen.queryByRole('button', { name: '템플릿 가이드 닫기' })).not.toBeInTheDocument();
  });
});
