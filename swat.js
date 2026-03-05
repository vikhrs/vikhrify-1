self.addEventListener('install', (e) => {
  console.log('Vikhrify SW Installed');
});
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
