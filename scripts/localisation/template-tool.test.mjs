import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceHash, validateBundle } from './template-validation.mjs';
import { registrationSql, publicationSql } from './template-sql.mjs';
export function fixture() {
 const source={id:'test-only-template',title:'한국어 제목',subtitle:'설명',tags:['태그'],cuts:[{id:1,order:1,durationSeconds:3,captureType:'VIDEO',title:'컷',guideText:'{product} 촬영',defaultCaption:'자막'}],categories:[{id:'test-only-category',title:'분류'}],examples:[]};
 return {source,translation:{id:source.id,locale:'en',sourceHash:sourceHash(source),title:"A creator's Reel",subtitle:'Description',tags:['tag'],cuts:[{id:1,order:1,title:'Shot',guideText:'Film {product}',defaultCaption:'Caption'}],categories:[{id:'test-only-category',title:'Category'}],examples:[],review:{translation:true,assets:true}}};
}
test('produces a non-public draft and escaped SQL without changing shared structure',()=>{
 const result=validateBundle(fixture()); const sql=registrationSql(result);
 assert.match(sql,/creator''s/);assert.match(sql,/published/);assert.doesNotMatch(sql,/UPDATE reels_templates /);assert.match(publicationSql(result),/source_hash=/);
});
for(const [name,change] of [
 ['changed source',b=>b.source.title='변경'],['duplicate shot',b=>b.translation.cuts.push(b.translation.cuts[0])],
 ['missing shot',b=>b.translation.cuts=[]],['unknown shot',b=>b.translation.cuts[0].id=8],
 ['structure override',b=>b.translation.cuts[0].durationSeconds=10],['untranslated text',b=>b.translation.title='제목'],
 ['missing placeholder',b=>b.translation.cuts[0].guideText='Film it'],['invalid asset',b=>b.translation.thumbnailUrl='javascript:alert(1)'],
 ['unreviewed publication',b=>b.translation.review.assets=false],
]) test(`rejects ${name}`,()=>{const b=fixture();change(b);assert.throws(()=>validateBundle(b,true));});
test('explicit proper names and shared assets are allowed',()=>{const b=fixture();b.translation.title='브랜드';b.translation.properNameExceptions=['브랜드'];b.translation.thumbnailUrl='https://example.test/shared.png';assert.doesNotThrow(()=>validateBundle(b));});
test('preserves line breaks and validates source structure',()=>{
 const b=fixture();b.source.cuts[0].guideText='{product}\n촬영';b.translation.sourceHash=sourceHash(b.source);
 assert.throws(()=>validateBundle(b),/line breaks/);
 b.translation.cuts[0].guideText='Film\n{product}';assert.doesNotThrow(()=>validateBundle(b));
 b.source.cuts[0].durationSeconds=-1;b.translation.sourceHash=sourceHash(b.source);assert.throws(()=>validateBundle(b),/structure/);
});
test('checks the reviewed draft fields and safely quotes dollar-delimiter text',()=>{
 const b=fixture();b.translation.title="A $localisation$ creator's Reel";const result=validateBundle(b,true);
 const sql=publicationSql(result);
 assert.match(sql,/title IS NOT DISTINCT FROM/);assert.match(sql,/DO \$localisationx\$/);
 assert.match(registrationSql(result),/Source shot count has changed/);
});
