import { templateFields, cutFields } from './template-validation.mjs';
export const sqlValue = value => value === null || value === undefined ? 'NULL' : typeof value === 'boolean' ? String(value) : typeof value === 'number' ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
const snake = value => value.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase());
const pick = (item, fields) => Object.fromEntries(fields.map(f => [snake(f), item[f] ?? null]));
const literal = (column, value) => sqlValue(value) + (column === 'tags' ? '::jsonb' : '');
function upsert({ table, values, keys }) {
  const columns = Object.keys(values), update = columns.filter(c => !keys.includes(c));
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(c => literal(c, values[c])).join(', ')})\nON CONFLICT (${keys.join(', ')}) DO UPDATE SET ${update.map(c => `${c}=EXCLUDED.${c}`).join(', ')};`;
}
function rows({ translation: tr, hash }) {
  return [
    { table: 'reels_template_translations', keys: ['template_id','locale'], values: {template_id:tr.id,locale:'en',...pick(tr,templateFields),tags:JSON.stringify(tr.tags),instagram_only:tr.instagramOnly??false,published:false,source_hash:hash,translation_reviewed:tr.review?.translation===true,assets_reviewed:tr.review?.assets===true} },
    ...tr.cuts.map(c => ({table:'reels_template_cut_translations',keys:['cut_id','locale'],values:{cut_id:c.id,locale:'en',...pick(c,cutFields)}})),
    ...tr.categories.map(c => ({table:'reels_template_category_translations',keys:['category_id','locale'],values:{category_id:c.id,locale:'en',title:c.title,description:c.description??null}})),
    ...tr.examples.map(e => ({table:'reels_template_example_translations',keys:['template_id','locale','sort_order'],values:{template_id:tr.id,locale:'en',sort_order:e.order,reel_url:e.url,instagram_only:e.instagramOnly??false}})),
  ];
}
function sourceGuards(source) {
  return [
    `IF (SELECT count(*) FROM reels_template_cuts WHERE template_id=${sqlValue(source.id)}) <> ${source.cuts.length} THEN RAISE EXCEPTION 'Source shot count has changed'; END IF;`,
    ...source.cuts.map(c => `IF NOT EXISTS (SELECT 1 FROM reels_template_cuts WHERE id=${sqlValue(c.id)} AND template_id=${sqlValue(source.id)} AND cut_order=${sqlValue(c.order)} AND duration_seconds=${sqlValue(c.durationSeconds)} AND capture_type=${sqlValue(c.captureType)}) THEN RAISE EXCEPTION 'Source shot structure has changed'; END IF;`),
  ].join('\n');
}
function guard(body) {
  let delimiter='$localisation$';
  while(body.includes(delimiter)) delimiter=delimiter.slice(0,-1)+'x$';
  return `DO ${delimiter} BEGIN\n${body}\nEND ${delimiter};`;
}
function transaction(body) { return `BEGIN;\nSET LOCAL standard_conforming_strings=on;\n${body}\nCOMMIT;\n`; }
export function registrationSql(bundle) {
  const records=rows(bundle);
  const clearExamples=`DELETE FROM reels_template_example_translations WHERE template_id=${sqlValue(bundle.translation.id)} AND locale='en';`;
  return '-- Review and execute manually. This script saves an unpublished draft.\n'+transaction([
    guard(sourceGuards(bundle.source)), clearExamples, ...records.map(upsert),
  ].join('\n'));
}
export function publicationSql(bundle) {
  // Compare every reviewed field, so an older publish file cannot publish a newer, unreviewed draft.
  const matches=rows(bundle).map(({table,values}) => {
    const conditions=Object.keys(values).filter(c=>c!=='published').map(c=>`${c} IS NOT DISTINCT FROM ${literal(c,values[c])}`).join(' AND ');
    return `IF NOT EXISTS (SELECT 1 FROM ${table} WHERE ${conditions}) THEN RAISE EXCEPTION 'Reviewed draft has changed'; END IF;`;
  });
  const id=sqlValue(bundle.translation.id);
  matches.push(`IF (SELECT count(*) FROM reels_template_example_translations WHERE template_id=${id} AND locale='en') <> ${bundle.translation.examples.length} THEN RAISE EXCEPTION 'Reviewed examples have changed'; END IF;`);
  matches.push(`UPDATE reels_template_translations SET published=true WHERE template_id=${id} AND locale='en' AND source_hash=${sqlValue(bundle.hash)} AND translation_reviewed AND assets_reviewed;\nIF NOT FOUND THEN RAISE EXCEPTION 'Reviewed draft does not match the source'; END IF;`);
  return '-- Execute after translation and asset review in development.\n'+transaction(guard([sourceGuards(bundle.source),...matches].join('\n')));
}
