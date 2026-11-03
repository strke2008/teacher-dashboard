/* مساعد المعلم — بوابة المعلم أُلغيت: كل ميزاتها صارت في لوحة التحكم (تطبيق واحد).
   هذا العامل يحل محل عامل البوابة القديم على الأجهزة: يمسح نسختها المحفوظة (tp-*) ويلغي نفسه،
   ويوجّه أي نافذة مفتوحة على البوابة إلى اللوحة. لا يحفظ شيئًا ولا يعترض أي طلب. */
const SW_VERSION = 'portal-retired-v1';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil((async () => {
  try { for (const k of await caches.keys()) if (k.startsWith('tp-')) await caches.delete(k); } catch {}
  try { await self.registration.unregister(); } catch {}
  try { for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) if (c.url && new URL(c.url).pathname.includes('/portal/')) c.navigate(new URL('../', self.registration.scope).href).catch(() => {}); } catch {}
})()); });
