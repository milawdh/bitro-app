import {defineConfig,devices} from '@playwright/test';
import path from 'node:path';
export default defineConfig({testDir:'.',testMatch:'renewal.spec.ts',workers:1,retries:0,timeout:180000,use:{baseURL:'http://127.0.0.1:3180',...devices['Desktop Chrome'],channel:'chrome',trace:'retain-on-failure',screenshot:'only-on-failure'},reporter:[['list']],webServer:{command:'npx vite --config tests/playback-browser/vite.config.ts',cwd:path.resolve(__dirname,'../..'),url:'http://127.0.0.1:3180',reuseExistingServer:false,timeout:60000}});
