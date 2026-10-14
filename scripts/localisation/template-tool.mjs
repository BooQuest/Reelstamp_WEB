#!/usr/bin/env node
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceHash, validateBundle, templateFields, cutFields } from './template-validation.mjs';
import { registrationSql, publicationSql } from './template-sql.mjs';
const args=process.argv.slice(2), file=args[0];
try {
 if(!file) throw new Error('Usage: node scripts/localisation/template-tool.mjs bundle.json --out OUTPUT [--publish | --fingerprint]');
 const bundle=JSON.parse(await readFile(file,'utf8'));
 if(args.includes('--fingerprint')) { console.log(sourceHash(bundle.source)); }
 else {
  const validated=validateBundle(bundle,args.includes('--publish'));
  const index=args.indexOf('--out');if(index<0||!args[index+1])throw new Error('--out is required');
  const out=resolve(args[index+1]);await mkdir(out,{recursive:true});
  await writeFile(resolve(out,'register-draft.sql'),registrationSql(validated));
  if(args.includes('--publish'))await writeFile(resolve(out,'publish.sql'),publicationSql(validated));
  else await rm(resolve(out,'publish.sql'),{force:true});
  const compare=(source,tr,fields)=>Object.fromEntries(fields.map(k=>[k,{ko:source[k]??null,en:tr[k]??null}]));
  await writeFile(resolve(out,'review.json'),JSON.stringify({templateId:bundle.source.id,sourceHash:validated.hash,review:bundle.translation.review,template:compare(bundle.source,bundle.translation,templateFields),cuts:bundle.source.cuts.map(c=>({id:c.id,...compare(c,bundle.translation.cuts.find(x=>x.id===c.id),cutFields)})),categories:bundle.translation.categories,examples:bundle.translation.examples},null,2)+'\n');
  console.log(`Validated ${bundle.source.id}. Review files written to ${out}. No database changes made.`);
 }
} catch(error) { console.error(error.message);process.exitCode=1; }
