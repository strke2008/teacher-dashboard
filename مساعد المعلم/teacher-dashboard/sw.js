/* مساعد المعلم — Service Worker: الإشعارات + حفظ ملفات اللوحة على الجهاز.
   ⚡ يحفظ ملفات الواجهة فقط (الصفحة والتنسيق والبرمجة والأيقونات) من نفس الموقع،
   فتُفتح اللوحة فورًا من الجهاز ويُجلب الإصدار الأحدث في الخلفية.
   بيانات الطلاب والدرجات والتسليمات لا تُحفظ إطلاقًا: تُجلب دائمًا من الخادم (نطاق آخر لا يمرّ هنا).
   لا يحتوي أي سر: المفتاح العام يُجلب من الخادم، والخاص لا يغادر Cloudflare. */
const SW_VERSION = 'push-v1+static-v1';
const STATIC = 'dash-static-v1';
const SCOPE = new URL(self.registration ? self.registration.scope : './', self.location.href);
const PAGE_KEY = new URL('index.html', SCOPE).href;
const isStaticFile = u => /\.(css|js|webmanifest|png|svg|webp|ico|woff2?)$/i.test(u.pathname) && !/\/sw\.js$/i.test(u.pathname);
const isPage = u => u.pathname === SCOPE.pathname || u.pathname === new URL(PAGE_KEY).pathname;

async function notifyUpdate(){
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of all) c.postMessage({ type: 'dash-update' });
}
/* ملفات الإصدار المذكورة في الصفحة (?v=…) تُحفظ مسبقًا، والقديمة منها تُحذف */
async function syncAssets(html){
  const cache = await caches.open(STATIC);
  const want = new Set([...html.matchAll(/(?:href|src)="([^"]+\?v=[^"]+)"/g)].map(m => new URL(m[1], PAGE_KEY).href));
  await Promise.all([...want].map(async u => { if (!(await cache.match(u))) { try { const r = await fetch(u, { cache: 'no-cache' }); if (r.ok) await cache.put(u, r); } catch {} } }));
  for (const req of await cache.keys()) { const u = new URL(req.url); if (u.search.includes('v=') && !want.has(req.url)) await cache.delete(req); }
}
async function pageFromNetwork(request, oldP){
  const res = await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' });   // طلب «تنقّل» لا يُعاد بخيارات جديدة — نطلبه بعنوانه
  if (res.ok && res.type === 'basic') {
    const txt = await res.clone().text();
    const old = await oldP;
    const cache = await caches.open(STATIC);
    await cache.put(PAGE_KEY, res.clone());
    if (old !== txt) { await syncAssets(txt); if (old !== null) await notifyUpdate(); }
  }
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin || !u.pathname.startsWith(SCOPE.pathname)) return;   // الخادم ونطاقات أخرى: لا نتدخل
  if (req.mode === 'navigate' && isPage(u)) {
    event.respondWith((async () => {
      const cached = await caches.match(PAGE_KEY);
      // نأخذ نسخة من المحفوظ قبل تسليمه للصفحة — جسم الاستجابة لا يُقرأ مرتين
      const net = pageFromNetwork(req, cached ? cached.clone().text() : Promise.resolve(null));
      if (cached) { event.waitUntil(net.catch(() => {})); return cached; }   // فوري من الجهاز، والتحديث في الخلفية
      return net;
    })());
    return;
  }
  if (!isStaticFile(u)) return;
  event.respondWith((async () => {
    const cache = await caches.open(STATIC);
    const hit = await cache.match(req);
    if (hit && u.search.includes('v=')) return hit;            // ملف بإصدار ثابت: لا يتغير أبدًا
    const net = fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok && r.type === 'basic') cache.put(req, r.clone()); return r; });
    if (hit) { event.waitUntil(net.catch(() => {})); return hit; }
    return net;
  })());
});
const API = new URL(self.location.href).searchParams.get('api') || '';

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('dash-static-') && k !== STATIC) await caches.delete(k);
  await self.clients.claim();
})()); });

self.addEventListener('push', event => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = { title: 'مساعد المعلم', body: event.data ? event.data.text() : '' }; }
  const title = String(msg.title || 'مساعد المعلم');
  const options = {
    body: String(msg.body || ''),
    tag: String(msg.tag || ''),              // نفس الوسم = إشعار واحد لا يتكرر على الجهاز
    data: msg.data || {},
    icon: new URL('pwa/icon-192.png', self.registration.scope).href,
    badge: new URL('pwa/badge-72.png', self.registration.scope).href,
    lang: 'ar',
    dir: 'rtl',
    timestamp: Number(msg.data && msg.data.at) || Date.now()
  };
  if (!options.tag) delete options.tag;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const inScope = all.find(c => c.url.startsWith(self.registration.scope));
    if (inScope) {
      // التطبيق مفتوح: نركّز عليه ونطلب فتح التسليم بلا إعادة تحميل
      try { await inScope.focus(); } catch {}
      inScope.postMessage({ type: 'push-open', data });
      return;
    }
    await self.clients.openWindow(target);
  })());
});

/* تغيّر الاشتراك (نادر): نسجّل الجديد مكان القديم. الخادم يقبل فقط إن كان القديم مسجّلًا */
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    if (!API) return;
    const oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint;
    let sub = event.newSubscription;
    if (!sub) {
      const r = await fetch(API.replace(/\/+$/, '') + '/push/public-key', { cache: 'no-store' });
      const j = await r.json();
      if (!j.publicKey) return;
      const s = j.publicKey.replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(s + '==='.slice((s.length + 3) % 4));
      const key = Uint8Array.from(raw, c => c.charCodeAt(0));
      sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }
    if (!oldEndpoint || !sub) return;
    await fetch(API.replace(/\/+$/, '') + '/push/resubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldEndpoint, subscription: sub.toJSON() })
    });
  })());
});
