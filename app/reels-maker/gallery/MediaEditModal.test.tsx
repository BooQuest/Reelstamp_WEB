import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MediaEditModal from './MediaEditModal';
import { generateTimelineThumbnails } from '../utils/media/previews';
import type { EditingMedia } from './types';
vi.mock('../utils/media/previews',()=>({generateTimelineThumbnails:vi.fn().mockResolvedValue([])}));
const media=(kind:'video'|'image'='video'):EditingMedia=>({item:{key:'source',name:'source',kind,url:'blob:source'},clipId:1,cutIndex:0,width:1080,height:1920,sourceDuration:10,edit:{start:1,duration:3,crop:{x:0,y:0,width:1,height:1}},wasForced:true});
beforeEach(()=>{vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});vi.mocked(generateTimelineThumbnails).mockResolvedValue([]);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
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
it('photos have no video timeline and enforce the 3600 second limit',()=>{
 render(<MediaEditModal media={media('image')} busy={false} error={null} onCancel={vi.fn()} onConfirm={vi.fn()}/>);
 expect(screen.queryByRole('slider')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('길이(초)'),{target:{value:'3600.1'}});expect(screen.getByRole('button',{name:'확인'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('길이(초)'),{target:{value:'0.1'}});expect(screen.getByRole('button',{name:'확인'})).toBeEnabled();
});
it('keeps source positions beyond one hour while limiting only the selected length',()=>{
 const source={...media(),sourceDuration:7200,edit:{...media().edit,start:7000,duration:100}};
 render(<MediaEditModal media={source} busy={false} error={null} onCancel={vi.fn()} onConfirm={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('길이(초)'),{target:{value:'200'}});
 expect(screen.getByRole('slider',{name:'구간 시작'})).toHaveAttribute('aria-valuenow','7000');
});
