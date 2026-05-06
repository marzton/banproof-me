import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    alias: {
      'cloudflare:workers': resolve(__dirname, './src/mocks/cloudflare-workers.js')
    }
  }
});
