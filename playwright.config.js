// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: 'http://localhost:8080',
  },
  workers: 1,
  retries: 0,
  reporter: [['list']],
});
