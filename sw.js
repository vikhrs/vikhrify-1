self.addEventListener('install', (e) => console.log('SW Installed'));
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));
