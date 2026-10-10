'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import SequentialServiceNoticePopups from '@/app/components/ui/SequentialServiceNoticePopups';
import ImageOnboardingDialog from './ImageOnboardingDialog';
import useOnboarding from './useOnboarding';

function OnboardingSession() {
  const pathname = usePathname();
  const { status, complete } = useOnboarding();
  const type = !status ? null : !status.entranceCompleted ? 'entrance'
    : pathname === '/reels-maker' && !status.reelsMakingCompleted ? 'reels-making' : null;
  if (!type) return null;
  return <ImageOnboardingDialog key={`${type}:${pathname}`} type={type} onComplete={complete} />;
}

export default function OnboardingPopups() {
  // Wait for the legacy notice to resolve hydration, dates and dismissed records first.
  const [legacyVisible, setLegacyVisible] = useState(true);
  return <>
    <SequentialServiceNoticePopups onVisibilityChange={setLegacyVisible} />
    {!legacyVisible && <OnboardingSession />}
  </>;
}
