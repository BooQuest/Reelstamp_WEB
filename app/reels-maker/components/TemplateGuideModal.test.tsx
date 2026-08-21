import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TemplateGuideModal, { type TemplateGuideStep } from './TemplateGuideModal';

const cuts = [
  {
    order: 1,
    title: '첫 장면',
    guideText: '입구가 잘 보이게 천천히 움직입니다.',
    isFixed: false,
  },
  {
    order: 2,
    title: '두 번째 장면',
    guideText: '핵심 상품을 가까이 보여줍니다.',
    isFixed: false,
  },
];

const renderModal = (
  step: TemplateGuideStep = 'overview',
  guideCuts = cuts
) => {
  const props = {
    templateTitle: '콘서트장 후기 템플릿',
    templateOverview: '전체 분위기를 빠르게 보여주는 템플릿입니다.',
    cuts: guideCuts,
    step,
    exampleReels: [],
    currentReelIndex: 0,
    onClose: vi.fn(),
    onSelectStep: vi.fn(),
    onPrimaryAction: vi.fn(),
    onSelectReel: vi.fn(),
  };

  render(<TemplateGuideModal {...props} />);

  return props;
};

describe('TemplateGuideModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the overview guide with a next action', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: '템플릿 가이드' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByText('콘서트장 후기 템플릿')).toBeInTheDocument();
    expect(screen.getByText('전체 분위기를 빠르게 보여주는 템플릿입니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음' })).toBeInTheDocument();
  });

  it('calls the primary action from the overview', () => {
    const props = renderModal();

    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(props.onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it('shows a cut guide with the capture action', () => {
    renderModal(0);

    const firstCutStep = screen.getByRole('button', { name: '컷1' });
    expect(firstCutStep).toHaveAttribute('aria-current', 'true');
    expect(firstCutStep).toHaveTextContent('1');
    expect(screen.queryByText('컷1')).not.toBeInTheDocument();
    expect(screen.getByText('첫 장면')).toBeInTheDocument();
    expect(screen.getByText('이 컷의 포인트')).toBeInTheDocument();
    expect(screen.getByText('입구가 잘 보이게 천천히 움직입니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1컷 촬영하기' })).toBeInTheDocument();
  });

  it('selects guide steps from the navigation bar', () => {
    const props = renderModal();

    fireEvent.click(screen.getByRole('button', { name: '컷2' }));

    expect(props.onSelectStep).toHaveBeenCalledWith(1);
  });

  it('keeps the guide navigation compact when there are only a few cuts', () => {
    renderModal();

    const overviewStep = screen.getByRole('button', { name: '전체' });
    const navigation = overviewStep.parentElement;

    expect(navigation).toHaveStyle({ width: '194px' });
  });

  it('shows only the next guide arrow on the first guide', () => {
    const props = renderModal('overview');

    expect(screen.queryByRole('button', { name: '이전 가이드' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음 가이드' }));

    expect(props.onSelectStep).toHaveBeenCalledWith(0);
  });

  it('shows only the previous guide arrow on the last guide', () => {
    const props = renderModal(1);

    expect(screen.queryByRole('button', { name: '다음 가이드' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이전 가이드' }));

    expect(props.onSelectStep).toHaveBeenCalledWith(0);
  });

  it('scales the guide navigation controls when there are many cuts', () => {
    const manyCuts = Array.from({ length: 10 }, (_, index) => ({
      order: index + 1,
      title: `${index + 1}컷`,
      guideText: `${index + 1}컷 가이드`,
      isFixed: false,
    }));

    renderModal('overview', manyCuts);

    const lastCutStep = screen.getByRole('button', { name: '컷10' });
    expect(lastCutStep).toBeInTheDocument();
    expect(Number.parseFloat(lastCutStep.style.width)).toBeLessThan(36);
  });
});
