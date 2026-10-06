'use client';
import { useRef, useState, useEffect } from 'react';
import type { EditorSnapshot } from './types';

export type HistoryEntry = { before: EditorSnapshot; after: EditorSnapshot };
export function appendHistory(
  entries: HistoryEntry[],
  position: number,
  entry: HistoryEntry,
) {
  return [...entries.slice(0, position), entry].slice(-10);
}
export default function useEditorHistory(
  snapshot: EditorSnapshot,
  apply: (state: EditorSnapshot) => Promise<void>,
) {
  const current = useRef(snapshot);
  current.current = snapshot;
  const entries = useRef<HistoryEntry[]>([]);
  const position = useRef(0);
  const before = useRef<EditorSnapshot | null>(null);
  const applying = useRef(false);
  const frame = useRef<number | null>(null);
  const [, render] = useState(0);
  const commit = () => {
    const previous = before.current;
    before.current = null;
    if (
      !previous ||
      applying.current ||
      JSON.stringify(previous) === JSON.stringify(current.current)
    )
      return;
    entries.current = appendHistory(entries.current, position.current, {
      before: previous,
      after: current.current,
    });
    position.current = entries.current.length;
    render((n) => n + 1);
  };
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  return {
    canUndo: position.current > 0,
    canRedo: position.current < entries.current.length,
    begin: () => {
      if (!applying.current && !before.current)
        before.current = structuredClone(current.current);
    },
    cancel: () => {
      before.current = null;
    },
    commit,
    commitAfterRender: () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        commit();
      });
    },
    async move(direction: -1 | 1) {
      if (applying.current) return;
      commit();
      const entry =
        entries.current[
          direction === -1 ? position.current - 1 : position.current
        ];
      if (!entry) return;
      applying.current = true;
      try {
        await apply(direction === -1 ? entry.before : entry.after);
        position.current += direction;
        render((n) => n + 1);
      } finally {
        applying.current = false;
      }
    },
  };
}
