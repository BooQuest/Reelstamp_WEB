import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import LocaleProvider, { useUiLocale, useUiText } from './LocaleProvider';
import LanguageSelector from './LanguageSelector';
import { createUiText } from './text';
import { resolveLocale } from './config';
import { publicErrorMessage } from './errors';
import { ko, en } from './messages';
import sources from './messages/sources.json';
const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => { cleanup(); refresh.mockClear(); document.cookie='reelstamp_locale=; Max-Age=0; Path=/'; });
function Editor() {
 const t=useUiText(); const {locale}=useUiLocale();const [caption,setCaption]=useState('확인');
 return <><LanguageSelector/><button>{t('저장 후 나가기')}</button><input aria-label="caption" value={caption} onChange={e=>setCaption(e.target.value)}/><output>{locale}</output></>;
}
it('changes UI language without replacing user captions or remounting editor inputs',()=>{
 render(<LocaleProvider initialLocale="ko" enabled><Editor/></LocaleProvider>);
 expect(screen.getByRole('button', {name:'한국어'})).toHaveAttribute('aria-pressed','true');
 const input=screen.getByLabelText('caption');fireEvent.change(input,{target:{value:'사용자가 수정한 자막'}});
 fireEvent.click(screen.getByRole('button', {name:'English'}));
 expect(screen.getByRole('button',{name:'Save and exit'})).toBeInTheDocument();
 expect(screen.getByLabelText('caption')).toBe(input);expect(input).toHaveValue('사용자가 수정한 자막');
 expect(screen.getByRole('button', {name:'English'})).toHaveAttribute('aria-pressed','true');
 expect(screen.getByRole('button', {name:'한국어'})).toHaveAttribute('aria-pressed','false');
 expect(document.cookie).toContain('reelstamp_locale=en');expect(refresh).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button', {name:'한국어'}));expect(input).toHaveValue('사용자가 수정한 자막');
});
it('hides the switch when disabled and ignores unsupported or disabled cookie values',()=>{
 render(<LocaleProvider initialLocale="ko" enabled={false}><Editor/></LocaleProvider>);
 expect(screen.queryByRole('group', {name:'언어 선택'})).not.toBeInTheDocument();
 expect(resolveLocale('en',false)).toBe('ko');expect(resolveLocale('fr',true)).toBe('ko');expect(resolveLocale('en',true)).toBe('en');
});
it('catalogues have identical keys and every message can be formatted',()=>{
 const t=createUiText('en');
 for(const group of Object.keys(ko) as (keyof typeof ko)[]) expect(Object.keys(en[group]).sort()).toEqual(Object.keys(ko[group]).sort());
 for(const [source,key] of Object.entries(sources)) {
   const values=Object.fromEntries([...source.matchAll(/\{(\w+)\}/g)].map(m=>[m[1],'test']));
   const result=Object.keys(values).length?t.format(source,values):t(source);
   expect(result,key).not.toBe(key);
   expect(result,key).not.toMatch(/[가-힣]/);
 }
});
it('preserves Korean spacing, translates parameters, and formats UI dates and prices',()=>{
 expect(createUiText('ko')('최대 ')).toBe('최대 ');
 const t=createUiText('en');expect(t('최대 ')).toBe('Max ');expect(t.format('컷 {v0}',{v0:3})).toBe('Shot 3');
 expect(t('19,900원')).toBe('₩19,900');expect(t('2026년 10월 13일')).toBe('2026-10-13');
});
it('maps errors by code and does not expose an unknown backend message in English',()=>{
 expect(publicErrorMessage({errorCode:'TEMPLATE_TRANSLATION_NOT_AVAILABLE',message:'SQL internal details'},'en')).toBe('This template is not available in the selected language.');
 expect(publicErrorMessage({errorCode:'TEMPLATE_TRANSLATION_NOT_AVAILABLE',message:'SQL internal details'},'ko')).toBe('선택한 언어로 제공되지 않는 템플릿입니다.');
 expect(publicErrorMessage({message:'private internal detail'},'ko')).toBe('요청을 처리하지 못했습니다. 다시 시도해 주세요.');
 expect(publicErrorMessage({message:'private internal detail'},'en')).toBe('Could not process the request. Please try again.');
});
