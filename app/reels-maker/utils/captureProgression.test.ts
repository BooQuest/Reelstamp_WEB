import { describe, expect, it } from 'vitest';
import { findNextIncompleteCaptureCutIndex } from './captureProgression';

const captureCut = { isFixed: false };
const fixedCut = { isFixed: true };

describe('findNextIncompleteCaptureCutIndex', () => {
  it('selects the next cut after the saved cut', () => {
    expect(
      findNextIncompleteCaptureCutIndex({
        cuts: [captureCut, captureCut],
        uploadedCuts: {},
        fromIndex: 0,
        completedCutIndex: 0,
      })
    ).toBe(1);
  });

  it('skips completed cuts', () => {
    expect(
      findNextIncompleteCaptureCutIndex({
        cuts: [captureCut, captureCut, captureCut],
        uploadedCuts: { 1: true },
        fromIndex: 0,
        completedCutIndex: 0,
      })
    ).toBe(2);
  });

  it('skips fixed cuts', () => {
    expect(
      findNextIncompleteCaptureCutIndex({
        cuts: [captureCut, fixedCut, captureCut],
        uploadedCuts: {},
        fromIndex: 0,
        completedCutIndex: 0,
      })
    ).toBe(2);
  });

  it('wraps to an earlier skipped cut when no later cut remains', () => {
    expect(
      findNextIncompleteCaptureCutIndex({
        cuts: [captureCut, captureCut, captureCut],
        uploadedCuts: { 2: true },
        fromIndex: 2,
        completedCutIndex: 2,
      })
    ).toBe(0);
  });

  it('returns -1 after the final capture cut is completed', () => {
    expect(
      findNextIncompleteCaptureCutIndex({
        cuts: [captureCut, fixedCut, captureCut],
        uploadedCuts: { 0: true },
        fromIndex: 2,
        completedCutIndex: 2,
      })
    ).toBe(-1);
  });
});
