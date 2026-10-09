'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OnboardingType } from './useOnboarding';
import styles from './onboarding.module.css';

const SLIDES = {
  entrance: [
    { file: 'first_entrance_1.png', title: '오늘의 릴스 트렌드', description: '최근 유행하는 인기 템플릿을 한눈에 확인하고, 마음에 드는 릴스를 바로 제작해보세요.' },
    { file: 'first_entrance_2.png', title: '다양한 바이럴 템플릿', description: '후킹 템플릿부터 트렌드 템플릿까지, 원하는 스타일을 골라 릴스를 제작해보세요.' },
  ],
  'reels-making': [
    { file: 'first_reelsmaking_1.png', title: '컷별 템플릿 가이드', description: '예시 영상과 컷별 설명을 참고해 촬영하면 템플릿 흐름을 더 쉽게 따라갈 수 있어요.' },
    { file: 'first_reelsmaking_2.png', title: '컷 구간 설정', description: '바를 움직여 사용할 구간을 선택하고, 아래 길이 입력으로 컷 길이를 조절해보세요.' },
    { file: 'first_reelsmaking_3.png', title: '릴스 업로드 완료', description: '완성한 릴스를 인스타그램에 공유하고, 릴스탬프와 함께 릴스 여정을 시작해보세요.' },
  ],
};

export default function ImageOnboardingDialog({ type, onComplete }: {
  type: OnboardingType;
  onComplete: (type: OnboardingType) => void;
}) {
  const [index, setIndex] = useState(0);
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const slides = SLIDES[type];
  const slide = slides[index];

  const advance = () => {
    if (index < slides.length - 1) setIndex(index + 1);
    else onComplete(type);
  };

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const background = Array.from(document.body.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement && node !== dialogRef.current,
    );
    const inertStates = background.map(node => node.inert);
    background.forEach(node => { node.inert = true; });
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach((node, i) => { node.inert = inertStates[i]; });
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    confirmRef.current?.focus({ preventScroll: true });
  }, [index]);

  return createPortal(
    <div ref={dialogRef} className={styles.overlay} role="dialog" aria-modal="true"
      aria-labelledby="onboarding-title" aria-describedby="onboarding-description"
      data-keyboard-navigation={keyboardNavigation || undefined}
      onPointerDownCapture={() => setKeyboardNavigation(false)}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          advance();
        }
        if (event.key === 'Tab') {
          event.preventDefault();
          setKeyboardNavigation(true);
          if (document.activeElement === confirmRef.current) closeRef.current?.focus();
          else confirmRef.current?.focus();
        }
      }}>
      <div className={styles.card}>
        <h2 id="onboarding-title" className="sr-only">{slide.title}</h2>
        <p id="onboarding-description" className="sr-only">{slide.description} ({index + 1}/{slides.length})</p>
        <div className={styles.scroller}><div className={styles.artwork}>
          <Image key={slide.file} src={`/images/onboarding/${slide.file}`} alt={slide.title}
            width={941} height={1672} sizes="(max-width: 480px) 100vw, 480px"
            priority className={styles.image} />
          <button ref={closeRef} type="button" className={styles.close}
            aria-label={index === slides.length - 1 ? '안내 확인 후 닫기' : '다음 안내'}
            onClick={advance} />
          {type === 'entrance' && <div className={styles.dots} aria-label={`총 2장 중 ${index + 1}번째 안내`}>
            {slides.map((item, i) => <span key={item.file} className={i === index ? styles.activeDot : styles.dot} />)}
          </div>}
        </div></div>
        <div className={styles.footer}>
          <button ref={confirmRef} type="button" className={styles.confirm}
            onClick={advance}>확인</button>
        </div>
      </div>
    </div>, document.body,
  );
}
