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

  image: {
    layout: "constrained",
    domains: ["cdn.sanity.io"], // allow optimising remote Sanity images
    service: {
      entrypoint: "astro/assets/services/sharp",
      config: {
        webp: { effort: 6, quality: 80 },
      },
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare({
    prerenderEnvironment: "node",
    // Build: Sharp optimises images in Node and bakes webp/avif into dist.
    // Dev: Sharp can't run in workerd, so pass images through unoptimised.
    imageService: process.argv.includes("build") ? "custom" : "passthrough",
  }),
});
