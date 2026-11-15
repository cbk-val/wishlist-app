const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },   // the phone size the app was designed for
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  webServer: {
    command: 'node tests/server.js',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});