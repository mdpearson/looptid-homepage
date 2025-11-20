// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [mdx(), sitemap()],
  site: "https://looptid.io",
});
