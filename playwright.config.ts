import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:3100', browserName: 'chromium', trace: 'retain-on-failure', actionTimeout: 10000 },
  webServer: { command: 'npm start', url: 'http://127.0.0.1:3100/health', env: { PORT: '3100', NODE_ENV: 'production' }, reuseExistingServer: false },
});
