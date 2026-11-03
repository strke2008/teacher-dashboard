/* 🧪 أدوات الاختبار: الخادم الحقيقي (worker.js) بتخزين مؤقت في الذاكرة — لا يلمس Cloudflare ولا بيانات حقيقية */
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');   // مجلد «مساعد المعلم»
export const TOKEN = 'test-secret-123';
export function memKV(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { m,
    get: async (k, t) => { const v = m.get(k); if (v == null) return null; return t === 'json' ? JSON.parse(v) : t === 'arrayBuffer' ? (v instanceof ArrayBuffer ? v : null) : v; },
    put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); },
    list: async (o = {}) => ({ keys: [...m.keys()].filter(k => !o.prefix || k.startsWith(o.prefix)).map(name => ({ name })), list_complete: true }),
    getWithMetadata: async k => ({ value: m.get(k) ?? null, metadata: null }) };
}
export const ROSTER = [{ id: 's1', name: 'طالب الاختبار الأول', cls: 'أول 1' }, { id: 's2', name: 'طالب الاختبار الثاني', cls: 'أول 1' }, { id: 's3', name: 'طالب من فصل آخر', cls: 'أول 2' }];
export async function loadWorker() { return (await import(pathToFileURL(path.join(ROOT, 'worker.js')).href + '?t=' + Date.now())).default; }
export function newEnv(extra = {}) {
  const fakeR2 = { get: async () => null, put: async () => ({}), head: async () => null, delete: async () => {} };
  return { HW: memKV({ 'tstate:main': JSON.stringify({ students: ROSTER }) }), TEACHER_TOKEN: TOKEN, FILES: fakeR2, ...extra };
}
export function caller(W, env) {
  const ctx = { waitUntil: p => p && p.catch && p.catch(() => {}) };
  return async (p, { method = 'GET', headers = {}, body, raw } = {}) => {
    const init = { method, headers: { ...headers } };
    if (body !== undefined) { init.body = raw ? body : JSON.stringify(body); if (!raw) init.headers['content-type'] = 'application/json'; }
    const r = await W.fetch(new Request('https://w.test' + p, init), env, ctx);
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
    return { s: r.status, j: j || {}, h: r.headers, txt };
  };
}
/* خادم HTTP محلي يمرّر للخادم الحقيقي — لاختبارات المتصفح */
export async function serveWorker(W, env, port) {
  const srv = http.createServer(async (q, r) => {
    const chunks = []; for await (const c of q) chunks.push(c);
    const req = new Request('http://localhost:' + port + q.url, { method: q.method, headers: q.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(q.method) ? undefined : Buffer.concat(chunks) });
    let res; try { res = await W.fetch(req, env, { waitUntil: p => p && p.catch && p.catch(() => {}) }); } catch (e) { res = new Response(String(e), { status: 500 }); }
    const h = {}; res.headers.forEach((v, k) => h[k] = v); r.writeHead(res.status, h); r.end(Buffer.from(await res.arrayBuffer()));
  });
  await new Promise(ok => srv.listen(port, ok)); return srv;
}
/* خادم ملفات ثابت للصفحات (مجلد «مساعد المعلم») */
export async function serveStatic(port) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p); if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
  });
  await new Promise(ok => srv.listen(port, ok)); return srv;
}
/* تسجيل النتائج */
export function suite(name) {
  const res = [];
  const t = async (title, fn) => { try { await fn(); res.push([true, title]); } catch (e) { res.push([false, title, String(e && e.message || e)]); } };
  return { t, res, name };
}
export function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} — المتوقع ${JSON.stringify(b)}، الفعلي ${JSON.stringify(a)}`); }
export function ok(v, msg) { if (!v) throw new Error(msg || 'شرط لم يتحقق'); }
