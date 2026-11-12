import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',fullyParallel:false,workers:1,timeout:45000,use:{baseURL:'http://127.0.0.1:3001',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome'],channel:'chrome'}}],reporter:[['list'],['html',{open:'never'}]]});
