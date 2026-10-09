'use client';

import { useSyncExternalStore } from 'react';

export type OnboardingType = 'entrance' | 'reels-making';
const STORAGE_KEYS = {
  entrance: 'reelstamp:onboarding:v1:entrance',
  'reels-making': 'reelstamp:onboarding:v1:reels-making',
};
const STATUS_CHANGED_EVENT = 'reelstamp:onboarding-changed';
const TYPES: OnboardingType[] = ['entrance', 'reels-making'];
const memoryFallback = new Set<OnboardingType>();

// A primitive snapshot stays stable between reads, including when storage is unavailable.
function getSnapshot() {
  return TYPES.reduce((status, type, index) => {
    let completed = memoryFallback.has(type);
    try {
      completed ||= localStorage.getItem(STORAGE_KEYS[type]) === 'true';
    } catch {
      // Restricted browsers retain confirmations in memory for the current page lifetime.
    }
    return completed ? status | (1 << index) : status;
  }, 0);
}

const getServerSnapshot = () => null;

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || Object.values(STORAGE_KEYS).includes(event.key)) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', onChange);
  window.addEventListener(STATUS_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', onChange);
    window.removeEventListener(STATUS_CHANGED_EVENT, onChange);
  };
}

function complete(type: OnboardingType) {
  try {
    localStorage.setItem(STORAGE_KEYS[type], 'true');
  } catch {
    memoryFallback.add(type);
  }
  window.dispatchEvent(new Event(STATUS_CHANGED_EVENT));
}

export default function useOnboarding() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const status = snapshot === null ? null : {
    entranceCompleted: Boolean(snapshot & 1),
    reelsMakingCompleted: Boolean(snapshot & 2),
  };
  return { status, complete };
}
