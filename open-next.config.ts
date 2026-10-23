import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext configuration for Cloudflare Workers deployment.
 *
 * Docs: https://opennext.js.org/cloudflare
 *
 * Caching (ISR/tag-based) is disabled by default.
 * To enable, add KV / R2 bindings in wrangler.jsonc and configure
 * cacheInterceptor / tagCache / incrementalCache here.
 */
export default defineCloudflareConfig();
