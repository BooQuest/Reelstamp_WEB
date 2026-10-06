import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useEditorHistory from './useEditorHistory';
import type { EditorSnapshot } from './types';
const state = (revision: string | null): EditorSnapshot => ({
  clips: [{ clipId: 1, revisionId: revision }],
  captions: [],
  captionsEnabled: true,
});
afterEach(cleanup);
describe('project edit history', () => {
  it('keeps ten global steps, discards redo on a new edit, and never advances on failure', async () => {
    const apply = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ snapshot }) => useEditorHistory(snapshot, apply),
      { initialProps: { snapshot: state(null) } },
    );
    for (let i = 1; i <= 12; i++) {
      act(() => result.current.begin());
      rerender({ snapshot: state(String(i)) });
      act(() => result.current.commit());
    }
    apply.mockRejectedValueOnce(new Error('conflict'));
    await act(async () => {
      await expect(result.current.move(-1)).rejects.toThrow('conflict');
    });
    await act(async () => {
      await result.current.move(-1);
    });
    expect(apply).toHaveBeenLastCalledWith(state('11'));
    expect(result.current.canRedo).toBe(true);
    rerender({ snapshot: state('11') });
    act(() => result.current.begin());
    rerender({ snapshot: state('new') });
    act(() => result.current.commit());
    expect(result.current.canRedo).toBe(false);
    for (let i = 0; i < 10; i++)
      await act(async () => {
        await result.current.move(-1);
      });
    expect(result.current.canUndo).toBe(false);
    expect(apply).toHaveBeenLastCalledWith(state('2'));
  });
  it('does not record unchanged UI state or cancelled operations', () => {
    const { result, rerender } = renderHook(
      ({ snapshot }) => useEditorHistory(snapshot, vi.fn()),
      { initialProps: { snapshot: state(null) } },
    );
    act(() => {
      result.current.begin();
      result.current.commit();
    });
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.begin());
    rerender({ snapshot: state('new') });
    act(() => {
      result.current.cancel();
      result.current.commit();
    });
    expect(result.current.canUndo).toBe(false);
  });
});
