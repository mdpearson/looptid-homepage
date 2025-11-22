// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare({
    imageService: "compile",  // just to silence a build warning
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [mdx(), sitemap()],
  site: "https://looptid.io",
});
