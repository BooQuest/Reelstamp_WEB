import { createHash } from 'node:crypto';
const requiredText = (value, name) => { if (typeof value !== 'string' || !value.trim()) throw new Error(`${name}: non-empty text required`); };
export const sourceHash = source => createHash('sha256').update(stableJson(source)).digest('hex');
function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export const templateFields = ['title','subtitle','tags','thumbnailUrl','embedUrl','instagramOnly'];
export const cutFields = ['title','guideText','defaultCaption','guideImageUrl','exampleImageUrl','exampleVideoUrl','fixedVideoUrl','fixedPreviewImageUrl'];
const assetFields = new Set(['thumbnailUrl','embedUrl','guideImageUrl','exampleImageUrl','exampleVideoUrl','fixedVideoUrl','fixedPreviewImageUrl','url']);
function unique(items, field, name) {
  if (!Array.isArray(items)) throw new Error(`${name}: array required`);
  const ids = items.map(x => x[field]);
  if (new Set(ids).size !== ids.length || ids.some(x => x === null || x === undefined)) throw new Error(`${name}: missing or duplicate ${field}`);
}
function fieldsOnly(value, fields, name) {
  for (const key of Object.keys(value)) if (!fields.includes(key)) throw new Error(`${name}: unsupported field ${key}; shared structure must not be changed`);
}
function textAndAssets(value, exceptions, path = '') {
  for (const [key, item] of Object.entries(value)) {
    const location = `${path}.${key}`;
    if (typeof item === 'string') {
      if (assetFields.has(key)) {
        if (item && (!/^(https?:\/\/[^\s]+|[A-Za-z0-9_./%+@=-]+)$/.test(item) || item.includes('..'))) throw new Error(`${location}: invalid asset reference`);
      } else if (!['id','sourceHash','locale'].includes(key) && /[가-힣]/.test(item) && !exceptions.includes(item)) throw new Error(`${location}: untranslated Korean text (record an exact proper-name exception if intentional)`);
    } else if (item && typeof item === 'object') textAndAssets(item, exceptions, location);
  }
}
function checkTextStructure(original, translated, name) {
  if (placeholders(original) !== placeholders(translated)) throw new Error(`${name}: placeholders changed`);
  if ((String(original ?? '').match(/\n/g) ?? []).length !== (String(translated ?? '').match(/\n/g) ?? []).length) throw new Error(`${name}: line breaks changed`);
}
function placeholders(value) { return (String(value ?? '').match(/\{[^{}]+\}/g) ?? []).sort().join('|'); }
export function validateBundle(bundle, publish = false) {
  const { source, translation: tr } = bundle;
  if (!source || !tr) throw new Error('source and translation are required');
  fieldsOnly(tr, ['id','locale','sourceHash',...templateFields,'cuts','categories','examples','review','properNameExceptions'], 'translation');
  requiredText(source.id,'source.id');
  requiredText(source.title,'source.title');
  if (tr.id !== source.id || tr.locale !== 'en') throw new Error('Translation must use the same template ID and locale en');
  if (tr.sourceHash !== sourceHash(source)) throw new Error('Source has changed or sourceHash is missing; review the translation against the current source');
  requiredText(tr.title,'translation.title');
  for (const field of [...templateFields.filter(f => !['tags','instagramOnly'].includes(f))]) if (tr[field] != null && typeof tr[field] !== 'string') throw new Error(`translation.${field}: text required`);
  if (!Array.isArray(tr.tags) || tr.tags.some(x => typeof x !== 'string' || !x.trim()) || (Array.isArray(source.tags) && tr.tags.length !== source.tags.length)) throw new Error('translation.tags: string array required');
  unique(source.cuts,'id','source.cuts'); unique(tr.cuts,'id','translation.cuts');
  unique(source.cuts,'order','source.cuts'); unique(tr.cuts,'order','translation.cuts');
  if (!source.cuts.length || tr.cuts.length !== source.cuts.length) throw new Error('Every source shot must have exactly one translated shot');
  for (const cut of source.cuts) {
    if (!Number.isSafeInteger(cut.id) || cut.id < 1 || !Number.isSafeInteger(cut.order) || cut.order < 1 || !Number.isFinite(cut.durationSeconds) || cut.durationSeconds <= 0 || !['CAPTURE','VIDEO','PHOTO','FIXED'].includes(cut.captureType)) throw new Error('Source shot structure is invalid');
  }
  for (const cut of tr.cuts) {
    fieldsOnly(cut,['id','order',...cutFields],'translation.cuts');
    for (const field of cutFields) if (cut[field] != null && typeof cut[field] !== 'string') throw new Error(`cut ${cut.id}.${field}: text required`);
    const original = source.cuts.find(c => c.id === cut.id);
    if (!original || original.order !== cut.order || !Number.isSafeInteger(cut.id) || !Number.isSafeInteger(cut.order)) throw new Error('Shot IDs and order must match the source');
    requiredText(cut.title,`cut ${cut.id}.title`); requiredText(cut.guideText,`cut ${cut.id}.guideText`);
    for (const field of cutFields) {
      if (original[field] && !cut[field]) throw new Error(`cut ${cut.id}.${field}: translation or explicit shared asset required`);
      if (!assetFields.has(field)) checkTextStructure(original[field], cut[field], `cut ${cut.id}.${field}`);
    }
    if (original.captureType?.toUpperCase() === 'FIXED') requiredText(cut.fixedVideoUrl,`cut ${cut.id}.fixedVideoUrl`);
  }
  for (const field of templateFields) {
    if (source[field] && (tr[field] === undefined || tr[field] === null || tr[field] === '')) throw new Error(`translation.${field}: translation or explicit shared asset required`);
    if (typeof source[field] === 'string' && !assetFields.has(field)) checkTextStructure(source[field], tr[field], `translation.${field}`);
  }
  unique(source.categories,'id','source.categories'); unique(tr.categories,'id','translation.categories');
  if (source.categories.length !== tr.categories.length) throw new Error('All source categories need translations');
  for (const category of tr.categories) {
    fieldsOnly(category,['id','title','description'],'translation.categories');
    if (!source.categories.some(c => c.id === category.id)) throw new Error('Unknown category');
    requiredText(category.title,'category.title');
    const original = source.categories.find(c=>c.id===category.id);
    if (original.description) requiredText(category.description,'category.description');
    for (const field of ['title','description']) checkTextStructure(original[field],category[field],`category.${field}`);
  }
  unique(tr.examples,'order','translation.examples');
  for (const example of tr.examples) {
    fieldsOnly(example,['order','url','instagramOnly'],'translation.examples');
    if (!Number.isSafeInteger(example.order)) throw new Error('Example order must be an integer');
    requiredText(example.url,'example.url');
  }
  if (source.examples?.length && !tr.examples.length) throw new Error('Translated examples are required');
  const exceptions = tr.properNameExceptions ?? [];
  if (!Array.isArray(exceptions) || exceptions.some(x=>typeof x!=='string')) throw new Error('properNameExceptions must be an array of exact strings');
  for (const item of [tr,...tr.examples]) if (item.instagramOnly != null && typeof item.instagramOnly !== 'boolean') throw new Error('instagramOnly must be a boolean');
  textAndAssets(Object.fromEntries(Object.entries(tr).filter(([key]) => !['properNameExceptions','review'].includes(key))),exceptions);
  if (publish && (tr.review?.translation !== true || tr.review?.assets !== true)) throw new Error('Publishing requires translation and asset review');
  return { source, translation: tr, hash: sourceHash(source) };
}
