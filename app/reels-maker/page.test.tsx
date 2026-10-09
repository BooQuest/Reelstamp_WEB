import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReelsMakerPage from './page';
import {
  createPosterFromClip,
  generateTimelineThumbnails,
} from './utils/media/previews';
import { loadVideoMetadataFromUrl } from './utils/media/metadata';
import { downloadFixedClip } from './services/fixedClip';
import {
  FakeMediaRecorder,
  installObjectUrls,
  jsonResponse,
  makeClip,
  makeCut,
  makeSession,
} from './test/fixtures';
import type { ReelsMakerSessionResponse } from './types';
import { makeStream } from './test/fixtures';

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams('templateId=template'),
  router: { push: vi.fn(), replace: vi.fn() },
  auth: {
    isAuthenticated: true,
    user: { id: 1, role: 'USER', guest: true, provider: 'GUEST' },
    setUser: vi.fn(),
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.params,
}));
vi.mock('@/app/components/providers/AuthProvider', () => ({
  useAuth: () => navigation.auth,
}));
// jsdom has no media decoder; keep the production coordinator, controls, hooks and HTTP protocol.
vi.mock('./components/CameraPreviewVideo', () => ({
  default: () => <div data-testid="camera-preview" />,
}));
vi.mock('./components/CapturedClipPreview', () => ({
  default: () => <div data-testid="clip-preview" />,
}));
vi.mock('./components/FixedClipVideo', () => ({
  default: () => <div data-testid="fixed-preview" />,
}));
vi.mock('./utils/media/previews', () => ({
  createPosterFromClip: vi.fn(),
  generateTimelineThumbnails: vi.fn(),
  revokeBlobUrl: (url: string | null) => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  },
}));
vi.mock('./utils/media/metadata', () => ({
  loadVideoMetadataFromUrl: vi.fn(),
}));
vi.mock('./services/fixedClip', () => ({ downloadFixedClip: vi.fn() }));

let session: ReelsMakerSessionResponse;
let fetchMock: ReturnType<typeof vi.fn>;
let failUpload: boolean;
let revisionCount: number;
let revisionEdit = {
  start: 0,
  duration: 3,
  crop: { x: 0, y: 0, width: 1, height: 1 },
};
let templateCuts: ReturnType<typeof makeCut>[];
let getUserMedia: ReturnType<typeof vi.fn>;
let pickerClick: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  installObjectUrls();
  pickerClick = vi
    .spyOn(HTMLInputElement.prototype, 'click')
    .mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  navigation.params = new URLSearchParams('templateId=template');
  session = makeSession();
  templateCuts = [makeCut()];
  failUpload = false;
  revisionCount = 0;
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
    configurable: true,
    get: () => 1080,
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
    configurable: true,
    get: () => 1920,
  });
  FakeMediaRecorder.instances = [];
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  getUserMedia = vi.fn().mockImplementation(async () => makeStream());
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia, enumerateDevices: async () => [] },
  });
  vi.stubGlobal('alert', vi.fn());
  vi.mocked(createPosterFromClip).mockResolvedValue(
    'data:image/jpeg;base64,poster',
  );
  vi.mocked(loadVideoMetadataFromUrl).mockResolvedValue({
    duration: 10,
    width: 1080,
    height: 1920,
  });
  vi.mocked(generateTimelineThumbnails).mockResolvedValue([]);
  vi.mocked(downloadFixedClip).mockResolvedValue({
    ...makeClip(),
    url: 'blob:fixed',
  });
  fetchMock = vi
    .fn()
    .mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/templates/template')
        return jsonResponse({
          success: true,
          data: { id: 'template', title: '테스트 템플릿', cuts: templateCuts },
        });
      if (
        url === '/api/reels-maker/sessions' ||
        url === '/api/reels-maker/sessions/10'
      )
        return jsonResponse({ success: true, data: session });
      if (url.endsWith('/media-assets/presign'))
        return jsonResponse({
          success: true,
          data: {
            id: 'asset-1',
            uploadUrl: 'https://upload.test/source',
            objectKey: 'source-1',
          },
        });
      if (url.endsWith('/media-assets/asset-1/upload-complete'))
        return jsonResponse({
          success: true,
          data: {
            id: 'asset-1',
            name: 'media',
            kind: 'video',
            contentType: 'video/mp4',
            width: 1080,
            height: 1920,
            duration: 10,
            sizeBytes: 5,
            downloadUrl: 'https://media.test/source',
          },
        });
      if (url.endsWith('/revisions')) {
        const body = JSON.parse(String(init?.body));
        revisionEdit = body.edit;
        revisionCount++;
        return jsonResponse({
          success: true,
          data: {
            id: body.id,
            assetId: body.assetId,
            edit: body.edit,
            renderMode: 'SOURCE_EDIT',
            uploadUrl: 'https://upload.test/result',
            objectKey: `result-${revisionCount}`,
          },
        });
      }
      if (url.startsWith('https://upload.test/')) return { ok: !failUpload };
      if (url.endsWith('/upload-complete'))
        return jsonResponse({
          success: true,
          data: {
            id: `revision-${revisionCount}`,
            assetId: 'asset-1',
            edit: revisionEdit,
          },
        });
      if (url.endsWith('/edit-state')) {
        const body = JSON.parse(String(init?.body));
        session = {
          ...session,
          draftVersion: (session.draftVersion ?? 0) + 1,
          captionItems: body.captionItems,
          mediaAssets: [
            {
              id: 'asset-1',
              name: 'media',
              kind: 'video',
              contentType: 'video/mp4',
              width: 1080,
              height: 1920,
              duration: 10,
              sizeBytes: 5,
              downloadUrl: 'https://media.test/source',
            },
          ],
          clips: session.clips.map((clip) => {
            const selected = body.clips.find(
              (c: { clipId: number }) => c.clipId === clip.clipId,
            );
            if (!selected) return clip;
            return {
              ...clip,
              status: selected.revisionId ? 'UPLOADED' : 'PENDING',
              objectKey: selected.revisionId,
              downloadUrl: selected.revisionId
                ? `https://media.test/${selected.revisionId}`
                : null,
              actualDurationSeconds: revisionEdit.duration,
              revision: selected.revisionId
                ? {
                    id: selected.revisionId,
                    assetId: 'asset-1',
                    edit: revisionEdit,
                    renderMode: 'SOURCE_EDIT',
                  }
                : null,
            };
          }),
        };
        return jsonResponse({ success: true, data: session });
      }
      if (url.endsWith('/complete'))
        return jsonResponse({
          success: true,
          data: { sessionId: 10, status: 'PROCESSING' },
        });
      if (url.endsWith('/status'))
        return jsonResponse({
          success: true,
          data: {
            sessionId: 10,
            status: 'COMPLETED',
            finalVideoUrl: 'https://media.test/final.mp4',
          },
        });
      if (url.startsWith('/api/reels-maker/download?'))
        return { ok: true, blob: async () => makeClip().blob };
      throw new Error(`Unexpected request: ${url}`);
    });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function openMaker() {
  render(<ReelsMakerPage />);
  fireEvent.click(
    await screen.findByRole('button', { name: '저장 없이 계속하기' }),
  );
  const guideClose = screen.queryByRole('button', {
    name: '템플릿 가이드 닫기',
  });
  if (guideClose) fireEvent.click(guideClose);
  await screen.findByRole('button', { name: '사진·영상 불러오기' });
}
async function importFile(type = 'video/mp4', name = 'clip.mp4') {
  fireEvent.click(
    screen.getByRole('button', {
      name: screen.queryByRole('button', { name: '사진·영상 불러오기' })
        ? '사진·영상 불러오기'
        : '교체',
    }),
  );
  const file = new File(['media'], name, { type });
  fireEvent.change(screen.getByLabelText('사진·영상 선택'), {
    target: { files: [file] },
  });
  await screen.findByRole('dialog', { name: '길이 및 화면 조정' });
}
async function applyFile(type = 'video/mp4', name = 'clip.mp4') {
  await importFile(type, name);
  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: '길이 및 화면 조정' }),
    ).not.toBeInTheDocument(),
  );
  await screen.findByLabelText(type.startsWith('image/') ? '컷 사진 미리보기' : '컷 영상 미리보기');
}

describe('gallery-only maker integration', () => {
  it('never initializes the camera and opens the system picker only on request', async () => {
    await openMaker();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(pickerClick).not.toHaveBeenCalled();
    expect(screen.getByLabelText('사진·영상 선택')).not.toHaveAttribute(
      'multiple',
    );
    expect(
      screen.queryByRole('button', { name: '현재 컷 촬영' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '길이 다듬기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '완료' })).toBeDisabled();
  });
  it.each(['image/jpeg', 'video/mp4'])(
    'applies %s as an original and revision, then completes the existing production flow',
    async (type) => {
      await openMaker();
      await applyFile(type);
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          url.endsWith('/media-assets/presign'),
        ),
      ).toHaveLength(1);
      await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/revisions'))).toHaveLength(1));
      expect(getUserMedia).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: '완료' }));
      expect(
        screen.queryByRole('dialog', { name: '자막을 편집할까요?' }),
      ).not.toBeInTheDocument();
      await screen.findByText('릴스 제작 완료');
    },
  );
  it('applies and allows undo during a blocked upload, then waits in preparation before completing', async () => {
    const original = fetchMock.getMockImplementation()!;
    let release!: () => void;
    const upload = new Promise<void>(resolve => { release = resolve; });
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === 'https://upload.test/source') await upload;
      return original(url, init);
    });
    await openMaker(); await applyFile();
    expect(screen.getByLabelText('컷 영상 미리보기')).toHaveAttribute('src', expect.stringContaining('blob:'));
    expect(session.clips[0].objectKey).toBeFalsy();
    await waitFor(() => expect(screen.getByRole('button', { name: '실행 취소' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
    await screen.findByRole('button', { name: '사진·영상 불러오기' });
    fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
    await screen.findByLabelText('컷 영상 미리보기');
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    await screen.findByText('원본을 업로드하고 있어요');
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/complete'))).toBe(false);
    release(); await screen.findByText('릴스 제작 완료');
    const complete = fetchMock.mock.calls.find(([url]) => url.endsWith('/complete'))!;
    expect(JSON.parse(complete[1].body).version).toBe(session.draftVersion);
  });
  it('does not overlap slow completion status requests and aborts on unmount', async () => {
    const original = fetchMock.getMockImplementation()!;
    let release!: () => void;
    let signal: AbortSignal | undefined;
    let statusCalls = 0;
    const pending = new Promise<void>(resolve => { release = resolve; });
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/status')) {
        statusCalls += 1;
        signal = init?.signal as AbortSignal;
        await pending;
      }
      return original(url, init);
    });
    await openMaker();
    await applyFile();
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    await waitFor(() => expect(statusCalls).toBe(1));
    await new Promise(resolve => setTimeout(resolve, 2100));
    expect(statusCalls).toBe(1);
    cleanup();
    expect(signal?.aborted).toBe(true);
    release();
  });
  it('keeps the current cut after apply, including templates with fixed cuts', async () => {
    templateCuts = [
      makeCut(),
      makeCut({
        order: 2,
        captureType: 'FIXED',
        isFixed: true,
        fixedVideoUrl: 'https://fixed.test',
      }),
      makeCut({ order: 3 }),
    ];
    session = makeSession({
      clips: [
        { clipId: 101, order: 1, durationSeconds: 3 },
        { clipId: 102, order: 2, durationSeconds: 3, fixed: true },
        { clipId: 103, order: 3, durationSeconds: 3 },
      ],
    });
    await openMaker();
    await applyFile();
    expect(screen.getByRole('button', { name: '1번 컷 선택' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(
      screen.queryByRole('button', { name: '템플릿 가이드 닫기' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2번 컷 선택' }));
    expect(screen.getByRole('button', { name: '교체' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '길이 다듬기' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '3번 컷 선택' }));
    expect(
      screen.getByRole('button', { name: '사진·영상 불러오기' }),
    ).toBeInTheDocument();
  });
  it('opens each empty cut and the guide target synchronously, without a list', async () => {
    templateCuts = [makeCut(), makeCut({ id: 'cut-2', order: 2 })];
    session = makeSession({
      clips: [
        { clipId: 101, order: 1, durationSeconds: 3 },
        { clipId: 102, order: 2, durationSeconds: 3 },
      ],
    });
    await openMaker();
    fireEvent.click(screen.getByRole('button', { name: '1번 컷 선택' }));
    expect(pickerClick).toHaveBeenCalledTimes(1);
    fireEvent(screen.getByLabelText('사진·영상 선택'), new Event('cancel'));
    fireEvent.click(screen.getByRole('button', { name: '2번 컷 선택' }));
    expect(pickerClick).toHaveBeenCalledTimes(2);
    fireEvent(screen.getByLabelText('사진·영상 선택'), new Event('cancel'));
    fireEvent.click(screen.getByRole('button', { name: '가이드' }));
    fireEvent.click(screen.getByRole('button', { name: '컷2' }));
    fireEvent.click(screen.getByRole('button', { name: '갤러리 불러오기' }));
    expect(pickerClick).toHaveBeenCalledTimes(3);
    fireEvent.change(screen.getByLabelText('사진·영상 선택'), {
      target: {
        files: [new File(['video'], 'clip.mp4', { type: 'video/mp4' })],
      },
    });
    await screen.findByRole('dialog', { name: '길이 및 화면 조정' });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await screen.findByLabelText('컷 영상 미리보기');
    expect(session.clips[0].objectKey).toBeFalsy();
    await waitFor(() => expect(session.clips[1].revision?.renderMode).toBe('SOURCE_EDIT'));
    expect(screen.getByRole('button', { name: '2번 컷 선택' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: '2번 컷 선택' }));
    expect(pickerClick).toHaveBeenCalledTimes(3);
  });
  it('keeps replacement preview and history through picker cancel, decode failure, and edit cancel', async () => {
    await openMaker();
    await applyFile();
    await waitFor(() => expect(session.clips[0].revision).toBeTruthy());
    const key = session.clips[0].objectKey;
    const select = () =>
      fireEvent.click(screen.getByRole('button', { name: '교체' }));
    select();
    expect(pickerClick).toHaveBeenCalledTimes(2);
    fireEvent(screen.getByLabelText('사진·영상 선택'), new Event('cancel'));
    expect(screen.getByLabelText('컷 영상 미리보기')).toBeInTheDocument();
    vi.mocked(loadVideoMetadataFromUrl).mockRejectedValueOnce(
      new Error('Unreadable video'),
    );
    select();
    fireEvent.change(screen.getByLabelText('사진·영상 선택'), {
      target: { files: [new File(['bad'], 'bad.mp4', { type: 'video/mp4' })] },
    });
    await screen.findByText('Unreadable video');
    expect(
      screen.queryByRole('dialog', { name: '길이 및 화면 조정' }),
    ).not.toBeInTheDocument();
    await importFile();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(session.clips[0].objectKey).toBe(key);
    expect(screen.getByRole('button', { name: '완료' })).toBeEnabled();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalled());
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        url.endsWith('/revisions'),
      ),
    ).toHaveLength(1);
  });
  it('keeps prior media when replacement upload fails', async () => {
    await openMaker();
    await applyFile();
    await waitFor(() => expect(session.clips[0].revision).toBeTruthy());
    const key = session.clips[0].objectKey;
    failUpload = true;
    await importFile('video/mp4', 'replacement.mp4');
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await screen.findAllByText(
      '미디어 업로드에 실패했습니다. 다시 시도해 주세요.',
    );
    expect(session.clips[0].objectKey).toBe(key);
    fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(screen.getByLabelText('컷 영상 미리보기')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '완료' })).toBeEnabled();
  });
  it('undoes and redoes media without uploading or converting again', async () => {
    await openMaker();
    await applyFile();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '실행 취소' })).toBeEnabled(),
    );
    const uploads = fetchMock.mock.calls.filter(([url]) =>
      url.endsWith('/presign'),
    ).length;
    const pickerCalls = pickerClick.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
    await waitFor(() => expect(session.clips[0].status).toBe('PENDING'));
    expect(pickerClick).toHaveBeenCalledTimes(pickerCalls);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '다시 실행' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
    await screen.findByLabelText('컷 영상 미리보기');
    expect(
      fetchMock.mock.calls.filter(([url]) => url.endsWith('/presign')),
    ).toHaveLength(uploads);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });
  it('cancels a replacement editor without changing the current cut or generating a video', async () => {
    await openMaker(); await applyFile();
    const before = screen.getByLabelText('컷 영상 미리보기').getAttribute('src');
    await importFile('video/mp4', 'cancel.mp4');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog', { name: '길이 및 화면 조정' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('컷 영상 미리보기')).toHaveAttribute('src', before);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });
  it('re-edits a persisted source without uploading the original again', async () => {
    await openMaker();
    await applyFile();
    await waitFor(() => expect(session.clips[0].revision).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '길이 다듬기' }));
    await screen.findByRole('dialog', { name: '길이 및 화면 조정' });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/revisions'))).toHaveLength(2),
    );
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        url.endsWith('/media-assets/presign'),
      ),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        url.endsWith('/revisions'),
      ),
    ).toHaveLength(2);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });
  it('restores an existing project without re-uploading or requesting camera access', async () => {
    navigation.params = new URLSearchParams('templateId=template&sessionId=10');
    session = makeSession({
      lastActiveClipOrder: 1,
      clips: [
        {
          clipId: 101,
          order: 1,
          durationSeconds: 3,
          status: 'UPLOADED',
          objectKey: 'legacy',
          downloadUrl: 'https://saved.test/clip',
        },
      ],
    });
    render(<ReelsMakerPage />);
    await screen.findByLabelText('컷 영상 미리보기');
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/presign'))).toBe(
      false,
    );
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: '템플릿 가이드 닫기' }),
    ).not.toBeInTheDocument();
  });
});
