# Fulfillly Ops — PWA-first (decisão de produto)

A spec original menciona app nativo React Native. A decisão formal do produto é **PWA web** em `/ops/*`:

- Instalável via "Adicionar à tela inicial" (iOS/Android)
- Offline com IndexedDB + Service Worker (`public/sw-ops.js`)
- Barcode via `BarcodeDetector` API
- Feedback sonoro e vibração (`use-ops-feedback.ts`)
- Ranking de operadores no hub `/ops` (não app store)

React Native permanece no roadmap apenas se PWA não atender requisitos de hardware (impressora Bluetooth dedicada, push nativo em massa).
