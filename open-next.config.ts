import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Hosting gratuito en Cloudflare Workers (sustituye a Netlify, D-29). Sin caché incremental en R2 de momento:
// la app es casi toda dinámica (sesión + RLS) y así no hace falta crear buckets.
export default defineCloudflareConfig();
