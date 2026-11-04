/* 🧪 سلامة التقسيم: الأجزاء المؤجَّلة (js/46-lazy.js) لا يحتاجها الفتح.
   - لا ملف يُحمَّل مع الصفحة يستخدم اسمًا من جزء مؤجَّل مباشرة (وإلا ينكسر قبل وصوله) — ضع الدالة في الملف الأصلي.
   - كل دالة مؤجَّلة تُذكر في نص زر (onclick…) لها بديل مؤقت في LZ_STUBS يحمّلها ثم ينفّذ.
   - الجزء المؤجَّل تعريفات فقط: لا أوامر تعمل عند التحميل. */
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { ROOT, suite, eq } from './harness.mjs';
const require = createRequire(import.meta.url);
export default async function run() {
  const S = suite('سلامة التقسيم');
  let acorn, walk; for (const p of ['acorn', '/opt/node-tools/node_modules/acorn']) { try { acorn = require(p); walk = require(p.replace(/acorn$/, 'acorn-walk')); break; } catch {} }
  if (!acorn) { S.res.push([true, 'acorn غير مثبت — تُخطّى فحوص التقسيم']); return S; }
  const D = path.join(ROOT, 'teacher-dashboard'), html = fs.readFileSync(path.join(D, 'index.html'), 'utf8'), lz = fs.readFileSync(path.join(D, 'js/46-lazy.js'), 'utf8');
  const lazyFiles = JSON.parse(lz.match(/files:\s*(\[[^\]]*\])/)[1].replace(/'/g, '"')), stubs = new Set(JSON.parse(lz.match(/const LZ_STUBS = (\[[^\]]*\])/)[1]));
  const parse = s => acorn.parse(s, { ecmaVersion: 'latest' });
  const coreFiles = [...new Set([...html.matchAll(/src="([^"?]+\.js)/g)].map(m => m[1]).concat(['js/41-exams-record.js', 'js/42-schedule.js', 'js/43-messages.js']))];
  const src = {}; for (const f of coreFiles) src[f] = fs.readFileSync(path.join(D, f), 'utf8');
  src['index.html (المضمّنة)'] = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n;\n');
  const L = new Map();
  await S.t('الأجزاء المؤجَّلة تعريفات فقط، وليست في index.html كسكربت', () => { const bad = [];
    for (const f of lazyFiles) { if (new RegExp('src="' + f.replace('.', '\\.')).test(html)) bad.push(f + ' محمّل كسكربت');
      for (const n of parse(fs.readFileSync(path.join(D, f), 'utf8')).body) {
        if (n.type === 'FunctionDeclaration') L.set(n.id.name, { f, fn: true });
        else if (n.type === 'VariableDeclaration') n.declarations.forEach(d => L.set(d.id.name, { f, fn: false }));
        else if (n.type === 'ClassDeclaration') L.set(n.id.name, { f, fn: false });
        else if (!(n.type === 'ExpressionStatement' && n.directive)) bad.push(f + ': أمر يعمل عند التحميل');
      } } eq(bad, []); });
  await S.t('لا ملف يُحمَّل مع الصفحة يستخدم اسمًا من جزء مؤجَّل مباشرة', () => { const bad = [];
    for (const [f, s] of Object.entries(src)) { const hit = new Set(), skip = new Set();
      walk.full(parse(s), x => { if (x.type === 'MemberExpression' && !x.computed) skip.add(x.property); if ((x.type === 'Property' || x.type === 'MethodDefinition') && !x.computed && !x.shorthand) skip.add(x.key); });
      walk.full(parse(s), x => { if (x.type === 'Identifier' && L.has(x.name) && !skip.has(x)) hit.add(x.name); });
      hit.forEach(n => bad.push(`${f} ← ${n} (${L.get(n).f})`)); }
    eq(bad, []); });
  await S.t('كل دالة مؤجَّلة يذكرها زر لها بديل مؤقت (LZ_STUBS)', () => { const bad = [], all = Object.values(src).join('\n') + html;
    for (const [n, i] of L) if (new RegExp('(?<![\\w$.])' + n.replace(/\$/g, '\\$') + '(?![\\w$])').test(all) && !stubs.has(n)) bad.push(n + (i.fn ? '' : ' (ليست دالة)'));
    for (const n of stubs) if (!L.has(n) || !L.get(n).fn) bad.push(n + ': بديل لاسم ليس دالة مؤجَّلة');
    eq(bad, []); });
  return S;
}
