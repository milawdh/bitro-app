import {defineConfig} from 'vite';
import path from 'node:path';
export default defineConfig({root:path.resolve(__dirname),server:{host:'127.0.0.1',port:3180,strictPort:true,fs:{allow:[path.resolve(__dirname,'../..')]}}});
