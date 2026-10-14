import { expect, it } from 'vitest';
import { ProjectContentContext } from './projectContentContext';
it('pins the selected content language through UI switches and assigned URL updates',()=>{
 const context=new ProjectContentContext();const first=context.observe('t',null,null,'en');
 expect(context.observe('t',null,10,'ko')).toBe(first);
 expect(context.observe('t','10',10,'ko')).toBe(first);
 expect(first.locale).toBe('en');
 const other=context.observe('t','11',10,'ko');expect(other).not.toBe(first);expect(other.sessionId).toBe('11');
 expect(context.observe('t',null,11,'en').locale).toBe('en');
});
