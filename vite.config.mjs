import { defineConfig } from 'vite';
import { deliveryApi } from './api.mjs';

export default defineConfig({
  plugins: [{
    name: 'local-delivery-lab',
    configureServer(server) {
      server.middlewares.use(deliveryApi);
    },
    configurePreviewServer(server) {
      server.middlewares.use(deliveryApi);
    },
  }],
});
