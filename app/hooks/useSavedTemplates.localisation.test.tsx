import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LocaleProvider from '@/app/i18n/LocaleProvider';
import LanguageSelector from '@/app/i18n/LanguageSelector';
import { useSavedTemplates } from './useSavedTemplates';
import { deferred, jsonResponse } from '@/app/reels-maker/test/fixtures';
vi.mock('next/navigation', () => ({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
vi.mock('@/app/components/providers/AuthProvider', () => ({useAuth:()=>({isAuthenticated:true})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function List() {
  const {savedTemplates,toggleSave}=useSavedTemplates();
  return <><LanguageSelector/><button onClick={()=>void toggleSave({id:'ko-only',title:'한국어 콘텐츠',subtitle:'',tags:[]})}>Save</button><ul>{savedTemplates.map(item=><li key={item.id}>{item.title}</li>)}</ul></>;
}
it('discards stale list and save responses when the locale changes', async()=>{
 const korean=deferred<Response>(),english=deferred<Response>(),save=deferred<Response>();
 vi.stubGlobal('fetch',vi.fn((url:string,init?:RequestInit)=>init?.method==='POST'?save.promise:url.includes('locale=en')?english.promise:korean.promise));
 render(<LocaleProvider initialLocale="ko" enabled><List/></LocaleProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Save'}));
 fireEvent.click(screen.getByRole('button', {name:'English'}));
 await act(async()=>english.resolve(jsonResponse({success:true,data:{templates:[{id:'en',title:'English template',subtitle:'',tags:[]}]}})));
 await screen.findByText('English template');
 await act(async()=>{
   korean.resolve(jsonResponse({success:true,data:{templates:[{id:'ko-only',title:'한국어 콘텐츠',subtitle:'',tags:[]}]}}));
   save.resolve(jsonResponse({success:true,data:{templateId:'ko-only',saved:true}}));
 });
 await waitFor(()=>expect(screen.getAllByRole('listitem')).toHaveLength(1));
 expect(screen.queryByText('한국어 콘텐츠')).not.toBeInTheDocument();
});
