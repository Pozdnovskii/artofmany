#!/usr/bin/env node
// Import the home page's background video (Cargo hero mp4) into Sanity as the
// homePage singleton's backgroundVideo file asset.
//
// Usage: node --env-file=.env scripts/import-homepage.mjs

const PROJECT_ID = "4d6uk72c";
const DATASET = "production";
const API_VERSION = "2026-07-10";
const VIDEO_URL = "https://files.cargocollective.com/c261833/Artofmany22.mp4";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";

const token = process.env.SANITY_API_WRITE_TOKEN;
if (!token) {
  console.error("SANITY_API_WRITE_TOKEN is not set (use: node --env-file=.env ...)");
  process.exit(1);
}

const { createClient } = await import("@sanity/client");
const client = createClient({ projectId: PROJECT_ID, dataset: DATASET, apiVersion: API_VERSION, useCdn: false, token });

console.log("Downloading hero video …");
const res = await fetch(VIDEO_URL, { headers: { "User-Agent": UA } });
if (!res.ok) throw new Error(`HTTP ${res.status} for ${VIDEO_URL}`);
const buf = Buffer.from(await res.arrayBuffer());
console.log(`Downloaded ${(buf.length / 1e6).toFixed(1)} MB. Uploading to Sanity …`);

const asset = await client.assets.upload("file", buf, {
  filename: "Artofmany-hero.mp4",
  contentType: "video/mp4",
});

await client.createOrReplace({
  _id: "homePage",
  _type: "homePage",
  backgroundVideo: { _type: "file", asset: { _type: "reference", _ref: asset._id } },
});

console.log(`Done. homePage.backgroundVideo -> ${asset._id}`);
console.log(`URL: ${asset.url}`);
