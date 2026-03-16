importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBf5V1yAmk_X6mN8nR7KjwGH6EO9XalQJ8",
  authDomain: "lpr-arn.firebaseapp.com",
  projectId: "lpr-arn",
  storageBucket: "lpr-arn.firebasestorage.app",
  messagingSenderId: "496945379067",
  appId: "1:496945379067:web:754badd4d6e431e308625e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensagem background recebida:', payload);

  const notificationTitle = payload.notification?.title || '🚨 PlateEye Alerta';
  const notificationOptions = {
    body: payload.notification?.body || 'Novo evento detectado',
    icon: './icon-192.png',
    badge: './badge-72.png',
    image: payload.notification?.image || '',
    tag: 'plateeye-alert',
    requireInteraction: true, // Força o usuário a interagir
    vibrate: [200, 100, 200, 100, 200],
    data: payload.data || {},
    actions: [
      {
        action: 'open',
        title: 'Abrir',
        icon: './icon-192.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: './icon-192.png'
      }
    ]
  };

  try {
    console.log('[SW] Exibindo notificação:', notificationTitle);
    self.registration.showNotification(notificationTitle, notificationOptions);
  } catch (error) {
    console.error('[SW] Erro ao exibir notificação:', error);
  }
});

// Listener para clique na notificação
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notificação clicada:', event.action);
  event.notification.close();

  const targetUrl = event.notification?.data?.url || './alerts.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Listener para fechar notificação
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notificação fechada');
});