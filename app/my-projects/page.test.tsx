import { beforeEach, describe, expect, it, vi } from 'vitest';
import MyProjectsPage from './page';
import CompletedReelsPage from '../completed-reels/page';

const { getUser, redirect, getApiClient, get } = vi.hoisted(() => ({
  getUser: vi.fn(),
  redirect: vi.fn(),
  getApiClient: vi.fn(),
  get: vi.fn(),
}));

vi.mock('@/app/lib/api/auth', () => ({ getCurrentUser: getUser }));
vi.mock('@/app/lib/api/server-client', () => ({ getServerApiClient: getApiClient }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('./MyProjectsClient', () => ({ default: () => null }));

beforeEach(() => {
  vi.resetAllMocks();
  redirect.mockImplementation(() => { throw new Error('redirect'); });
  getApiClient.mockResolvedValue({ get });
  get.mockResolvedValue({ data: { success: true, data: { reels: [] } } });
});

describe('project navigation', () => {
  it('redirects the retired page without loading user or project data', () => {
    expect(() => CompletedReelsPage()).toThrow('redirect');
    expect(redirect).toHaveBeenCalledWith('/my-projects?status=COMPLETED');
    expect(getUser).not.toHaveBeenCalled();
    expect(getApiClient).not.toHaveBeenCalled();
  });

  it.each([
    ['COMPLETED', '/my-projects?status=COMPLETED'],
    ['completed', '/my-projects?status=COMPLETED'],
    ['PROCESSING', '/my-projects?status=PROCESSING'],
    ['CAPTURE', '/my-projects'],
    ['invalid', '/my-projects'],
    [undefined, '/my-projects'],
  ])('preserves the validated %s tab through login', async (status, destination) => {
    getUser.mockResolvedValue(null);
    await expect(MyProjectsPage({ searchParams: Promise.resolve({ status }) })).rejects.toThrow('redirect');
    expect(redirect).toHaveBeenCalledWith(`/login?returnUrl=${encodeURIComponent(destination)}`);
    expect(getApiClient).not.toHaveBeenCalled();
  });

  it.each(['CAPTURE', 'PROCESSING', 'COMPLETED'])(
    'continues loading the %s tab from the shared list API',
    async (status) => {
      getUser.mockResolvedValue({ id: 1 });
      const page = await MyProjectsPage({ searchParams: Promise.resolve({ status }) });
      expect(get).toHaveBeenCalledWith(`/api/reels-maker/sessions?status=${status}`);
      expect(page.props.activeStatus).toBe(status);
      expect(redirect).not.toHaveBeenCalled();
    },
  );
});
