/* مساعد المعلم — بوابة المعلم: Service Worker للإشعارات (تنبيه بداية الحصة) + نسخة من الصفحة على الجهاز.
   📱 تطبيق الشاشة الرئيسية في iPhone قد لا يصل لصفحة الموقع على بعض شبكات الواي فاي («الخادم توقف عن الاستجابة»)
   بينما سفاري يصل. لذلك: الصفحة من الخادم أولًا (حتى 4 ث)، وإن تأخرت أو فشلت تُفتح النسخة المحفوظة على الجهاز فورًا،
   وتُحدَّث في الخلفية. البيانات (الطلاب والدرجات) لا تُحفظ هنا إطلاقًا: تُجلب من الخادم (نطاق آخر لا يمر بهذا العامل). لا أسرار. */
const SW_VERSION = 'portal-push-v3+page-v1';
const API = new URL(self.location.href).searchParams.get('api') || '';
const PAGE_CACHE = 'tp-page-v1';
const SCOPE = new URL(self.registration ? self.registration.scope : './', self.location.href);
const PAGE_KEY = new URL('./', SCOPE).href;
const isPage = u => u.pathname === SCOPE.pathname || u.pathname === SCOPE.pathname + 'index.html';
const isAsset = u => u.pathname.startsWith(SCOPE.pathname + 'pwa/') || u.pathname === SCOPE.pathname + 'manifest.webmanifest';

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil((async () => {
  try { for (const k of await caches.keys()) if (k !== PAGE_CACHE) await caches.delete(k); } catch {}   // 🧹 بقايا أي نسخة سابقة
  await self.clients.claim();
})()); });

async function notifyUpdate(){ for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) c.postMessage({ type: 'dash-update' }); }
/* الصفحة من الشبكة: ‎?_sw=‎ فريد يتجاوز أي نسخة وسيطة، ثم تُحفظ. تُعاد استجابة جديدة (لا «محوَّلة») — WebKit يرفض تسليم استجابة فيها تحويل لصفحة */
async function pageFromNet(req){
  const u = new URL(req.url); u.searchParams.set('_sw', Date.now().toString(36));
  const r = await fetch(u.href, { cache: 'no-store', credentials: 'same-origin' });
  if (!r.ok) throw new Error('http ' + r.status);
  const txt = await r.text();
  const cache = await caches.open(PAGE_CACHE), old = await cache.match(PAGE_KEY), oldTxt = old ? await old.text() : null;
  await cache.put(PAGE_KEY, new Response(txt, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
  return { res: new Response(txt, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }), changed: oldTxt !== null && oldTxt !== txt };
}
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;                                  // الخادم (API) ونطاقات أخرى: لا نتدخل
  if (req.mode === 'navigate' && isPage(u)) {
    event.respondWith((async () => {
      const cached = await caches.match(PAGE_KEY, { cacheName: PAGE_CACHE });
      const net = pageFromNet(req);
      if (!cached) { try { return (await net).res; } catch { return fetch(req); } }
      let served = false;
      event.waitUntil(net.then(x => { if (served && x.changed) return notifyUpdate(); }).catch(() => {}));
      const won = await Promise.race([net.then(x => x.res).catch(() => null), new Promise(r => setTimeout(() => r(null), 4000))]);
      if (won) return won;
      served = true; return cached;                                                // الشبكة متأخرة/فاشلة: النسخة المحفوظة فورًا
    })());
    return;
  }
  if (isAsset(u)) {
    event.respondWith((async () => {
      const cache = await caches.open(PAGE_CACHE), hit = await cache.match(req);
      const net = fetch(req).then(r => { if (r.ok && r.type === 'basic' && !r.redirected) cache.put(req, r.clone()); return r; });
      if (hit) { event.waitUntil(net.catch(() => {})); return hit; }
      return net;
    })());
  }
});

self.addEventListener('push', event => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = { title: 'مساعد المعلم', body: event.data ? event.data.text() : '' }; }
  const options = {
    body: String(msg.body || ''),
    tag: String(msg.tag || ''),
    data: msg.data || {},
    icon: new URL('pwa/icon-192.png', self.registration.scope).href,
    badge: new URL('pwa/badge-72.png', self.registration.scope).href,
    lang: 'ar', dir: 'rtl',
    requireInteraction: !!(msg.data && msg.data.type === 'lesson'),   // تنبيه الحصة يبقى حتى تتعامل معه
    timestamp: Number(msg.data && msg.data.at) || Date.now()
  };
  if (!options.tag) delete options.tag;
  event.waitUntil(self.registration.showNotification(String(msg.title || 'مساعد المعلم'), options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(c => c.url.startsWith(self.registration.scope));
    if (open) {                                   // البوابة مفتوحة: تبدأ الحصة فيها بلا إعادة تحميل
      try { await open.focus(); } catch {}
      open.postMessage({ type: 'push-open', data });
      return;
    }
    await self.clients.openWindow(target);         // مغلقة: تُفتح والرابط يحمل الحصة
  })());
});

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    if (!API) return;
    const oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint;
    let sub = event.newSubscription;
    if (!sub) {
      const j = await (await fetch(API.replace(/\/+$/, '') + '/push/public-key', { cache: 'no-store' })).json();
      if (!j.publicKey) return;
      const s = j.publicKey.replace(/-/g, '+').replace(/_/g, '/');
      const key = Uint8Array.from(atob(s + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
      sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }
    if (!oldEndpoint || !sub) return;
    await fetch(API.replace(/\/+$/, '') + '/push/portal/resubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldEndpoint, subscription: sub.toJSON() })
    });
  })());
});
