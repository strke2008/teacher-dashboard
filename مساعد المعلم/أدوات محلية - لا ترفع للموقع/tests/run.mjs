/* 🧪 شغّل قبل كل رفع:   node "أدوات محلية - لا ترفع للموقع/tests/run.mjs"
   1) سلامة كتابة كل ملفات البرمجة (والبرمجة المضمّنة في الصفحات)  2) الخادم: رحلة الطالب ودخول المعلم والإشعارات
   3) الصفحات في متصفح حقيقي متصل بالخادم محليًا. لا يلمس Cloudflare ولا أي بيانات حقيقية.
   الخيار --fast يتخطى اختبارات المتصفح. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process';
import { ROOT, suite } from './harness.mjs';
const fast = process.argv.includes('--fast'), t0 = Date.now(), all = [];

const syn = suite('سلامة الكتابة');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.name.startsWith('.') || e.name === 'node_modules' || e.name.startsWith('أدوات') || e.name.startsWith('موقع') ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(ROOT), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'syn-'));
const check = (label, file) => syn.t(label, () => { try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); } catch (e) { throw new Error(String(e.stderr || e).split('\n').slice(0, 4).join(' ')); } });
for (const f of files.filter(f => /\.(m?js)$/.test(f))) await check(path.relative(ROOT, f), f);
for (const f of files.filter(f => /\.html$/.test(f))) {
  const src = fs.readFileSync(f, 'utf8'), blocks = [...src.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="(?:application\/(?:ld\+)?json|text\/template)")[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (!blocks.length) continue; const out = path.join(tmp, path.basename(f) + '-' + all.length + Math.random().toString(36).slice(2, 6) + '.js');
  fs.writeFileSync(out, blocks.map(b => `;(function(){${b}\n})();`).join('\n')); await check(path.relative(ROOT, f) + ' (المضمّنة)', out);
}
all.push(syn);
all.push(await (await import('./lazy.test.mjs')).default());
all.push(await (await import('./worker.test.mjs')).default());
if (!fast) all.push(await (await import('./browser.test.mjs')).default());

let pass = 0, fail = 0;
for (const S of all) { const bad = S.res.filter(r => !r[0]); pass += S.res.length - bad.length; fail += bad.length;
  console.log(`\n${bad.length ? '❌' : '✅'} ${S.name}: ${S.res.length - bad.length}/${S.res.length}`);
  for (const [okd, t, e] of S.res) if (!okd || S.name !== 'سلامة الكتابة') console.log(`   ${okd ? '✓' : '✗'} ${t}${e ? '\n       ↳ ' + e : ''}`); }
console.log(`\n${fail ? '❌ لا ترفع: ' + fail + ' فشل' : '✅ كل الاختبارات نجحت — آمن للرفع'} (${pass} نجح · ${((Date.now() - t0) / 1000).toFixed(0)} ث)`);
process.exit(fail ? 1 : 0);
