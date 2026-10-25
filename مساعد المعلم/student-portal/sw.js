/* أنشطتي — Service Worker: الإشعارات (نشاط جديد · رسالة من المعلم) + حفظ ملفات البوابة على الجهاز.
   ⚡ يحفظ ملفات الواجهة فقط (الصفحة والتنسيق والبرمجة والصور) فتُفتح البوابة فورًا ويُجلب الأحدث في الخلفية.
   الأنشطة والدرجات وبيانات الطالب لا تُحفظ إطلاقًا: تُجلب دائمًا من الخادم (نطاق آخر لا يمرّ هنا). لا يحتوي أي سر. */
const SW_VERSION = 'student-push-v3+static-v3';
const API = new URL(self.location.href).searchParams.get('api') || '';
const STATIC = 'portal-static-v1';
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
async function pageFromNetwork(request, oldP, waitUntil, servedFresh){
  /* ?_sw= فريد يتجاوز نسخة الاستضافة المؤقتة (CDN): كانت تعيد الصفحة القديمة دقائق بعد الرفع، فلا يصل التحديث لبعض الأجهزة */
  const fresh = new URL(request.url); fresh.searchParams.set('_sw', Date.now().toString(36));
  const res = await fetch(fresh.href, { cache: 'no-store', credentials: 'same-origin' });   // طلب «تنقّل» لا يُعاد بخيارات جديدة — نطلبه بعنوانه
  if (res.ok && res.type === 'basic') {
    const copy = res.clone();                      // قبل أي انتظار: الصفحة تُسلَّم والحفظ يكمل في الخلفية
    const work = (async () => {
      const txt = await copy.text();
      const old = await oldP;
      const cache = await caches.open(STATIC);
      await cache.put(PAGE_KEY, new Response(txt, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
      if (old !== txt) { await syncAssets(txt); if (old !== null && !(servedFresh && servedFresh())) await notifyUpdate(); }
    })().catch(() => {});
    if (waitUntil) waitUntil(work); else await work;
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
      let fresh = false;
      const net = pageFromNetwork(req, cached ? cached.clone().text() : Promise.resolve(null), p => { try { event.waitUntil(p); } catch {} }, () => fresh);
      if (!cached) return net;
      event.waitUntil(net.catch(() => {}));
      /* 🔄 الأحدث أولًا: نسخة الخادم إن وصلت خلال 3 ث، وإلا المحفوظة على الجهاز (بلا اتصال أو شبكة بطيئة).
         كانت المحفوظة تُعرض دائمًا والجديدة لا تظهر إلا في الفتح التالي — فيبدو أن التحديث لم يصل */
      const timeout = new Promise(r => setTimeout(() => r(null), 3000));
      const fromNet = net.then(r => (r && r.ok ? r : null)).catch(() => null);
      const won = await Promise.race([fromNet, timeout]);
      if (won) { fresh = true; return won; }        // الأحدث ظاهر الآن — لا داعي لزر «تحديث الآن»
      return cached;
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


/* 🔄 إصدار جديد من هذا الملف حلّ محل قديم: الصفحات المفتوحة تُبلَّغ فيظهر زر «تحديث الآن» — بلا اختصارات لوحة المفاتيح */
let HAD_OLD = false;
self.addEventListener('install', () => { HAD_OLD = !!(self.registration && self.registration.active); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('portal-static-') && k !== STATIC) await caches.delete(k);
  await self.clients.claim();
  if (HAD_OLD) await notifyUpdate();
})()); });

/* 📥 صندوق الإشعارات المحفوظة: رد معلم وصل بالإشعار يُحفظ محليًا حتى لو كانت البوابة مغلقة،
   فيظهر فور فتحها بلا انتظار نسخة الخادم. وشارة أيقونة التطبيق تُحدَّث معها
   (iOS 16.4+ للتطبيقات المثبتة) — والصفحة تصحح الرقم لاحقًا بعدد الجديدة الحقيقي. */
const PUSH_INBOX_CACHE = 'stu-push-inbox-v1', PUSH_INBOX_KEY = '/__push_inbox__';
async function stashAsk(item) {
  try {
    const cache = await caches.open(PUSH_INBOX_CACHE);
    let items = [];
    try { const r = await cache.match(PUSH_INBOX_KEY); if (r) { const j = await r.json(); if (Array.isArray(j && j.items)) items = j.items; } } catch (e) {}
    if (!items.some(x => x && x.id === item.id)) items.unshift(item);
    items = items.slice(0, 30);
    await cache.put(PUSH_INBOX_KEY, new Response(JSON.stringify({ items, at: Date.now() }), { headers: { 'Content-Type': 'application/json' } }));
    try { if (self.navigator && typeof self.navigator.setAppBadge === 'function') await self.navigator.setAppBadge(items.length); } catch (e) {}
  } catch (e) {}
}

self.addEventListener('push', event => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = { title: 'أنشطتي', body: event.data ? event.data.text() : '' }; }
  const options = {
    body: String(msg.body || ''),
    tag: String(msg.tag || ''),
    data: msg.data || {},
    icon: new URL('pwa/icon-192.png', self.registration.scope).href,
    badge: new URL('pwa/badge-72.png', self.registration.scope).href,
    lang: 'ar', dir: 'rtl',
    timestamp: Date.now()
  };
  if (!options.tag) delete options.tag;
  event.waitUntil((async () => {
    await self.registration.showNotification(String(msg.title || 'أنشطتي'), options);
    // ⚡ البوابة مفتوحة؟ نخبرها لتحدّث الرسائل والعدّاد فورًا بلا إعادة تحميل
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) c.postMessage({ type: 'push-msg', data: msg.data || {} });
    // 📥 مغلقة؟ يُحفظ الرد محليًا ليظهر فور فتح البوابة (push مثل الإشعارات)
    if (msg.data && msg.data.ask) await stashAsk(msg.data.ask);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(c => c.url.startsWith(self.registration.scope));
    if (open) {                        // البوابة مفتوحة: انتقل للنشاط أو الرسائل مباشرة
      try { await open.focus(); } catch {}
      try { if ('navigate' in open) { await open.navigate(target); return; } } catch {}
    }
    await self.clients.openWindow(target);
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
    await fetch(API.replace(/\/+$/, '') + '/push/student/resubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldEndpoint, subscription: sub.toJSON() })
    });
  })());
});
