import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MediaEditModal from './MediaEditModal';
import { generateTimelineThumbnails } from '../utils/media/previews';
import type { EditingMedia } from './types';
vi.mock('../utils/media/previews',()=>({generateTimelineThumbnails:vi.fn().mockResolvedValue([])}));
const media=(kind:'video'|'image'='video'):EditingMedia=>({item:{key:'source',name:'source',kind,url:'blob:source'},clipId:1,cutIndex:0,width:1080,height:1920,sourceDuration:10,edit:{start:1,duration:3,crop:{x:0,y:0,width:1,height:1}},isRecommended:true});
beforeEach(()=>{vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});vi.mocked(generateTimelineThumbnails).mockResolvedValue([]);});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
it('links decimal length and selected interval, refusing invalid values',async()=>{
 const confirm=vi.fn(); render(<MediaEditModal media={media()} busy={false} error={null} onCancel={vi.fn()} onConfirm={confirm}/>);
 fireEvent.change(screen.getByLabelText('길이(초)'),{target:{value:'0.15'}});expect(screen.getByRole('button',{name:'확인'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('길이(초)'),{target:{value:'10.1'}});expect(screen.getByRole('button',{name:'확인'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('길이(초)'),{target:{value:'9.5'}});
 expect(screen.getByRole('slider',{name:'구간 시작'})).toHaveAttribute('aria-valuenow','0.5');
 fireEvent.click(screen.getByRole('button',{name:'확인'}));
 expect(confirm).toHaveBeenCalledWith(expect.objectContaining({start:.5,duration:9.5}));
 await waitFor(()=>expect(screen.getByRole('status')).toBeInTheDocument());
});
it('keyboard trim handles update length, and cancel does not apply',async()=>{
 const cancel=vi.fn(),confirm=vi.fn();render(<MediaEditModal media={media()} busy={false} error={null} onCancel={cancel} onConfirm={confirm}/>);
 fireEvent.keyDown(screen.getByRole('slider',{name:'구간 종료'}),{key:'ArrowLeft'});
 expect(screen.getByLabelText('길이(초)')).toHaveValue('2.9');
 fireEvent.click(screen.getByRole('button',{name:'취소'}));expect(cancel).toHaveBeenCalledOnce();expect(confirm).not.toHaveBeenCalled();
});
it.each(['image', 'video'] as const)('%s enforces and displays the 60 second limit', (kind) => {
 const confirm = vi.fn();
 render(<MediaEditModal media={{ ...media(kind), sourceDuration: 120 }} busy={false} error={null} onCancel={vi.fn()} onConfirm={confirm}/>);
 expect(screen.getByText('최대 60.0초 · 0.1초 단위')).toBeInTheDocument();
 if (kind === 'image') expect(screen.queryByRole('slider')).not.toBeInTheDocument();
 for (const value of ['60.1', '3600', '0', '-1', '0.15', 'abc']) {
  fireEvent.change(screen.getByLabelText('길이(초)'), { target: { value } });
  expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
 }
 for (const value of ['0.1', '59.9', '60.0']) {
  fireEvent.change(screen.getByLabelText('길이(초)'), { target: { value } });
  expect(screen.getByRole('button', { name: '확인' })).toBeEnabled();
 }
 fireEvent.click(screen.getByRole('button', { name: '확인' }));
 expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ duration: 60 }));
});
it('displays and enforces a short video duration rounded down to a tenth', () => {
 render(<MediaEditModal media={{ ...media(), sourceDuration: 9.99 }} busy={false} error={null} onCancel={vi.fn()} onConfirm={vi.fn()}/>);
 expect(screen.getByText('최대 9.9초 · 0.1초 단위')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('길이(초)'), { target: { value: '10' } });
 expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
 expect(screen.getByRole('alert')).toHaveTextContent('9.9초');
 fireEvent.change(screen.getByLabelText('길이(초)'), { target: { value: '9.9' } });
 expect(screen.getByRole('button', { name: '확인' })).toBeEnabled();
});
it('keeps source positions beyond one hour while limiting only the selected length',()=>{
 const source={...media(),sourceDuration:7200,edit:{...media().edit,start:7000,duration:30}};
 render(<MediaEditModal media={source} busy={false} error={null} onCancel={vi.fn()} onConfirm={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('길이(초)'),{target:{value:'60'}});
 expect(screen.getByRole('slider',{name:'구간 시작'})).toHaveAttribute('aria-valuenow','7000');
 expect(screen.getByRole('slider',{name:'구간 종료'})).toHaveAttribute('aria-valuenow','7060');
 expect(screen.getByRole('button',{name:'확인'})).toBeEnabled();
});
it.each(['image', 'video'] as const)('shows the recommendation once for %s length changes and dismisses after three seconds', async (kind) => {
  vi.useFakeTimers();
  render(<MediaEditModal media={media(kind)} busy={false} error={null} onCancel={vi.fn()} onConfirm={vi.fn()} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  if (kind === 'video') {
    fireEvent.keyDown(screen.getByRole('slider', { name: '구간 종료' }), { key: 'ArrowLeft' });
  } else {
    fireEvent.change(screen.getByLabelText('길이(초)'), { target: { value: '4' } });
  }
  expect(screen.getByRole('status')).toHaveTextContent('이 템플릿은 권장 길이에 맞춰 제작하는 것을 추천해요.');
  expect(screen.getByRole('button', { name: '확인' })).toBeEnabled();
  await act(async () => { vi.advanceTimersByTime(2999); });
  expect(screen.getByRole('status')).toBeInTheDocument();
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('길이(초)'), { target: { value: '5' } });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('does not show a recommended-length toast for other duration modes', () => {
  render(<MediaEditModal media={{ ...media('image'), isRecommended: false }} busy={false} error={null} onCancel={vi.fn()} onConfirm={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('길이(초)'), { target: { value: '4' } });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
