#!/usr/bin/env node
// Import the About and Team pages from artofmany.com (Cargo.site) into Sanity:
//   aboutPage (bio + offices), contactInfo (email/phone/social), 3x teamMember.
// These two pages aren't part of the 80 projects (see PLAN.md section 6.5).
//
// Usage:
//   node scripts/import-about-team.mjs --dry-run
//   node --env-file=.env scripts/import-about-team.mjs

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ID = "4d6uk72c";
const DATASET = "production";
const API_VERSION = "2026-07-10";
const SITE = "https://artofmany.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16 Safari/605.1.15";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, ".cache");
const PAGES_DIR = path.join(CACHE_DIR, "pages");
const OUT_DIR = path.join(__dirname, ".out");
// Separate asset cache so this can run alongside the projects import without racing.
const ASSET_CACHE_FILE = path.join(CACHE_DIR, "assets-about-team.json");

const DRY_RUN = process.argv.includes("--dry-run");
const log = (...a) => console.log(...a);

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", eacute: "é", egrave: "è", agrave: "à",
  aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", ccedil: "ç",
};
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in NAMED_ENTITIES ? NAMED_ENTITIES[n] : m));
}

const SPACE = String.fromCharCode(32);
const NL2 = String.fromCharCode(10, 10);

// Collapse a fragment to plain text: 2+ <br> => paragraph break, single <br> => space.
function blockText(html) {
  const stripped = decodeEntities(
    html
      .replace(/(?:<br\s*\/?>\s*){2,}/gi, NL2)
      .replace(/<br\s*\/?>/gi, SPACE)
      .replace(/<[^>]+>/g, ""),
  );
  return stripped
    .split(NL2)
    .map((p) => p.replace(/[ \t]+/g, SPACE).trim())
    .filter(Boolean)
    .join(NL2);
}

// Single-line plain text (address lines, names).
function lineText(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, SPACE).trim();
}

let keyN = 0;
const key = () => `k${(keyN++).toString(36)}`;

async function getPage(slug) {
  const file = path.join(PAGES_DIR, `${slug}.html`);
  if (existsSync(file)) return readFile(file, "utf8");
  const res = await fetch(`${SITE}/${slug}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${slug}`);
  const html = await res.text();
  await mkdir(PAGES_DIR, { recursive: true });
  await writeFile(file, html);
  return html;
}

function findNode(html, slug) {
  const m = html.match(/<script[^>]*data-set="ScaffoldingData"[^>]*>([\s\S]*?)<\/script>/);
  const d = JSON.parse(m[1]);
  let found = null;
  (function w(n) {
    if (found || !n || typeof n !== "object") return;
    if (String(n.project_url).toLowerCase() === slug && typeof n.content === "string") found = n;
    if (Array.isArray(n.pages)) n.pages.forEach(w);
  })(d);
  if (!found) throw new Error(`node not found: ${slug}`);
  return found;
}

function stripCategorias(html) {
  return html.replace(/<div[^>]*class="[^"]*\bcategorias\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
}
function contentText(node) {
  const cleaned = stripCategorias(node.content);
  const m = cleaned.match(/<div[^>]*class="[^"]*\bproject_content_text\b[^"]*"[^>]*>([\s\S]*)<\/div>/i);
  return m ? m[1] : cleaned;
}

function paragraphsToPT(html) {
  return blockText(html)
    .split(NL2)
    .filter(Boolean)
    .map((text) => ({
      _type: "block",
      _key: key(),
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: key(), text, marks: [] }],
    }));
}

let client = null;
let assetCache = {};
async function initClient() {
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!token) throw new Error("SANITY_API_WRITE_TOKEN is not set (use: node --env-file=.env ...)");
  const { createClient } = await import("@sanity/client");
  client = createClient({ projectId: PROJECT_ID, dataset: DATASET, apiVersion: API_VERSION, useCdn: false, token });
  if (existsSync(ASSET_CACHE_FILE)) assetCache = JSON.parse(await readFile(ASSET_CACHE_FILE, "utf8"));
}

async function uploadImage(cacheKey, url, filename) {
  if (DRY_RUN) return `PENDING(${filename})`;
  if (assetCache[cacheKey]) return assetCache[cacheKey];
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const asset = await client.assets.upload("image", buf, { filename });
  assetCache[cacheKey] = asset._id;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(ASSET_CACHE_FILE, JSON.stringify(assetCache, null, 2));
  return asset._id;
}

const imageRef = (assetId, alt) => ({
  _type: "image",
  asset: { _type: "reference", _ref: assetId },
  ...(alt ? { alt } : {}),
});

const SOCIAL_PLATFORMS = [
  ["instagram", /instagram\.com/i],
  ["facebook", /facebook\.com/i],
  ["behance", /behance\.net/i],
  ["pinterest", /pinterest\.com/i],
  ["linkedin", /linkedin\.com/i],
];
function socialPlatform(url) {
  for (const [name, re] of SOCIAL_PLATFORMS) if (re.test(url)) return name;
  return null;
}

function parseOfficeChunk(chunk) {
  const lines = chunk.split(/<br\s*\/?>/i).map((l) => l.trim()).filter(Boolean);
  let city = null;
  let mapLink;
  const addressLines = [];
  for (const line of lines) {
    const mapA = line.match(/<a[^>]*href="([^"]*maps\.google[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (mapA) {
      mapLink = decodeEntities(mapA[1]);
      const t = lineText(mapA[2]);
      if (t) addressLines.push(t);
      continue;
    }
    const t = lineText(line);
    if (!t) continue;
    if (!city) city = t;
    else addressLines.push(t);
  }
  return { _key: key(), city: city || "Office", addressLines, ...(mapLink ? { mapLink } : {}) };
}

function parseAbout(node) {
  const inner = contentText(node);
  const firstSocial = inner.search(/<a[^>]*href="[^"]*(instagram|facebook|behance|pinterest)/i);
  const bioHtml = firstSocial > 0 ? inner.slice(0, firstSocial) : inner;

  const socialLinks = [...inner.matchAll(/<a[^>]*href="([^"]*)"[^>]*>/gi)]
    .map((m) => decodeEntities(m[1]))
    .map((url) => ({ url, platform: socialPlatform(url) }))
    .filter((s) => s.platform)
    .map((s) => ({ _key: key(), platform: s.platform, url: s.url }));

  const pin = inner.match(/<a[^>]*pinterest[^>]*>[\s\S]*?<\/a>/i);
  const officesHtml = pin ? inner.slice(inner.indexOf(pin[0]) + pin[0].length) : "";
  const dubaiIdx = officesHtml.search(/Dubai\s*<br/i);
  const offices = [];
  if (dubaiIdx > -1) {
    offices.push(parseOfficeChunk(officesHtml.slice(0, dubaiIdx)));
    offices.push(parseOfficeChunk(officesHtml.slice(dubaiIdx)));
  } else if (officesHtml.trim()) {
    offices.push(parseOfficeChunk(officesHtml));
  }

  const email = (inner.match(/mailto:([^"']+)/i) || [])[1] || "";
  const phoneMatch = inner.match(/\+\d[\d\s]{6,}\d/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, SPACE).trim() : "";

  const aboutPage = { _id: "aboutPage", _type: "aboutPage", bio: paragraphsToPT(bioHtml), offices };
  const contactInfo = {
    _id: "contactInfo",
    _type: "contactInfo",
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    socialLinks,
  };
  return { aboutPage, contactInfo };
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function parseTeam(node) {
  const inner = contentText(node);
  const imgTags = inner.match(/<img[^>]*>/gi) || [];
  const parts = inner.split(/<img[^>]*>/i);
  const members = [];
  for (let i = 0; i < imgTags.length; i++) {
    const headerLine = parts[i].split(/<br\s*\/?>/i).map(lineText).filter(Boolean).pop() || "";
    const [name, ...roleParts] = headerLine.split(",");
    const role = roleParts.join(",").trim();

    let tail = parts[i + 1] || "";
    if (i < imgTags.length - 1) {
      const nextHeader = (parts[i + 1].split(/<br\s*\/?>/i).map(lineText).filter(Boolean).pop() || "").split(",")[0];
      if (nextHeader) {
        const idx = tail.lastIndexOf(nextHeader);
        if (idx > -1) {
          const cut = tail.slice(0, idx).lastIndexOf("<");
          tail = tail.slice(0, cut > -1 ? cut : idx);
        }
      }
    }
    const firstLink = tail.search(/<a\b/i);
    const bio = blockText(firstLink > -1 ? tail.slice(0, firstLink) : tail);
    const contactLinks = [...tail.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => {
      let url = decodeEntities(m[1]).trim();
      if (url.includes("artfomany")) url = url.replace("artfomany", "artofmany"); // fix source typo
      return { _key: key(), label: lineText(m[2]) || "Link", url };
    });

    const img = imgTags[i];
    const src = (img.match(/data-src="([^"]+)"/) || [])[1];
    const parsed = src ? src.match(/\/i\/([0-9a-f]+)\/([^"?]+)/) : null;

    members.push({
      name: name.trim(),
      role,
      bio,
      contactLinks,
      img: { url: src, hash: parsed ? parsed[1] : null, name: parsed ? decodeURIComponent(parsed[2]) : "photo.png" },
      order: i,
    });
  }

  const docs = [];
  for (const m of members) {
    const assetId = m.img.url ? await uploadImage(m.img.hash || m.img.url, m.img.url, m.img.name) : null;
    docs.push({
      _id: `teamMember-${slugify(m.name)}`,
      _type: "teamMember",
      name: m.name,
      role: m.role,
      ...(m.bio ? { bio: m.bio } : {}),
      ...(m.contactLinks.length ? { contactLinks: m.contactLinks } : {}),
      ...(assetId ? { photo: imageRef(assetId, m.name) } : {}),
      order: m.order,
    });
  }
  return docs;
}

async function main() {
  log(`about/team import - ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  if (!DRY_RUN) await initClient();

  const aboutNode = findNode(await getPage("about"), "about");
  const teamNode = findNode(await getPage("team"), "team");

  const { aboutPage, contactInfo } = parseAbout(aboutNode);
  const teamMembers = await parseTeam(teamNode);

  await mkdir(OUT_DIR, { recursive: true });
  const docs = [aboutPage, contactInfo, ...teamMembers];
  for (const doc of docs) {
    await writeFile(path.join(OUT_DIR, `${doc._id}.json`), JSON.stringify(doc, null, 2));
    if (!DRY_RUN) await client.createOrReplace(doc);
  }

  log(`\naboutPage: ${aboutPage.bio.length} bio block(s), ${aboutPage.offices.length} office(s)`);
  aboutPage.offices.forEach((o) => log(`  office: ${o.city} | ${o.addressLines.length} line(s)${o.mapLink ? " | map" : ""}`));
  log(`contactInfo: ${contactInfo.email || "-"} / ${contactInfo.phone || "-"} / ${contactInfo.socialLinks.length} social`);
  log(`teamMembers: ${teamMembers.length}`);
  teamMembers.forEach((t) =>
    log(`  - ${t.name} - ${t.role} | bio:${t.bio ? t.bio.length + "ch" : "none"} | links:${t.contactLinks ? t.contactLinks.length : 0} | photo:${t.photo ? "y" : "n"}`),
  );
  log(`\nOutput: ${OUT_DIR}`);
  if (DRY_RUN) log("DRY RUN - nothing written.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
