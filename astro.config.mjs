// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: "https://artofmany.com",
  trailingSlash: "never",

  devToolbar: { enabled: false },

  build: { format: "file" },

  integrations: [sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare({
    prerenderEnvironment: "node",
    imageService: "compile",
  }),
});
