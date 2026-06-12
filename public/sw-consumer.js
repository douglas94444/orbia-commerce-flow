self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title ?? "Orbia";
  const body = data.body ?? "Você tem uma novidade!";
  event.waitUntil(self.registration.showNotification(title, { body, icon: "/favicon.ico" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/minha-conta";
  event.waitUntil(clients.openWindow(url));
});
