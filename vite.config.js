import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({build:{rollupOptions:{input:{home:resolve(import.meta.dirname,'index.html'),services:resolve(import.meta.dirname,'services.html'),industries:resolve(import.meta.dirname,'industries.html'),safety:resolve(import.meta.dirname,'safety.html'),howItWorks:resolve(import.meta.dirname,'how-it-works.html'),resources:resolve(import.meta.dirname,'resources.html'),quote:resolve(import.meta.dirname,'quote.html')}}}});
