#!/usr/bin/env node
// Import the 80 artofmany.com portfolio projects (legacy Cargo.site) into Sanity.
//
// Data sources (all plain HTTP, no headless browser — see PLAN.md §6):
//   1. https://artofmany.com/_api/v0/thumbnails/... — list of all 80 projects
//      (slug, title, tags, cover thumbnail hash+name).
//   2. Each project page's <script data-set="ScaffoldingData"> JSON block, whose
//      node (project_url === slug) holds `content` (body HTML with links, inline
//      <img> gallery and Vimeo <iframe>s), plus per-image metadata.
//
// The single `content` HTML flow is split into the schema's separate fields:
//   - description  <- .project_content_text (intro + credits, links preserved) -> Portable Text
//   - gallery      <- inline <img data-src> in DOM order (the images actually on the page)
//   - videos       <- Vimeo <iframe> in DOM order; poster auto-filled from Vimeo oEmbed
//   - coverImage   <- the grid thumbnail from the list API (imageModel hash+name)
//   - metaTitle    <- page <title>;  metaDescription <- clean text of project_content_text
//
// Usage:
//   node scripts/import-projects.mjs --dry-run            # fetch+parse+convert, write JSON, no Sanity calls
//   node scripts/import-projects.mjs --dry-run --slug=The-Golden-Man
//   node scripts/import-projects.mjs --dry-run --limit=5
//   node --env-file=.env scripts/import-projects.mjs      # live: upload assets + createOrReplace
//
// Options:
//   --dry-run            no network writes / no asset uploads; emit transformed docs to scripts/.out/
//   --limit=N            only the first N projects
//   --slug=<slug>        only this one project
//   --slug-mode=preserve|lower   route slug casing (default: preserve, keeps existing Cargo URLs)
//   --no-cache           re-fetch pages even if cached
//   --refetch-list       re-fetch the project list even if cached

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ----------------------------------------------------------------------------
// Config
// ----------------------------------------------------------------------------
const PROJECT_ID = "4d6uk72c";
const DATASET = "production";
const API_VERSION = "2026-07-10";

const SITE = "https://artofmany.com";
const LIST_API = `${SITE}/_api/v0/thumbnails/artofmany?page_id=4707125&all=true&limit=200`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16 Safari/605.1.15";
const CRAWL_DELAY_MS = 2000; // robots.txt Crawl-delay: 2 — respected between network fetches

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, ".cache");
const PAGES_DIR = path.join(CACHE_DIR, "pages");
const OUT_DIR = path.join(__dirname, ".out");
const ASSET_CACHE_FILE = path.join(CACHE_DIR, "assets.json");

// ----------------------------------------------------------------------------
// CLI args
// ----------------------------------------------------------------------------
const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);
const getOpt = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const DRY_RUN = hasFlag("--dry-run");
const ONLY_SLUG = getOpt("slug");
const LIMIT = getOpt("limit") ? parseInt(getOpt("limit"), 10) : undefined;
const SLUG_MODE = getOpt("slug-mode") || "lower"; // lower | preserve
const USE_CACHE = !hasFlag("--no-cache");
const REFETCH_LIST = hasFlag("--refetch-list");
const CHECK_LINKS = !hasFlag("--no-check-links"); // validate external links, report broken
const STRIP_DEAD = !hasFlag("--keep-dead-links"); // drop links to dead domains/pages (ENOTFOUND/404/410), keep text

const log = (...a) => console.log(...a);
const warn = (...a) => console.warn("  ⚠ ", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ----------------------------------------------------------------------------
// Networking (rate-limited, cached)
// ----------------------------------------------------------------------------
let lastFetchAt = 0;
async function politeFetch(url, { asBuffer = false } = {}) {
  // Only throttle scraping of artofmany.com (robots Crawl-delay: 2). CDN asset
  // downloads (freight.cargo.site) and Vimeo oEmbed run at full speed.
  if (url.includes("artofmany.com")) {
    const wait = CRAWL_DELAY_MS - (Date.now() - lastFetchAt);
    if (wait > 0) await sleep(wait);
    lastFetchAt = Date.now();
  }
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
}

async function getProjectList() {
  const cacheFile = path.join(CACHE_DIR, "list.json");
  if (USE_CACHE && !REFETCH_LIST && existsSync(cacheFile)) {
    return JSON.parse(await readFile(cacheFile, "utf8"));
  }
  log("Fetching project list …");
  const raw = await politeFetch(LIST_API);
  const list = JSON.parse(raw);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(list));
  return list;
}

async function getProjectPageHtml(slug) {
  const cacheFile = path.join(PAGES_DIR, `${encodeURIComponent(slug)}.html`);
  if (USE_CACHE && existsSync(cacheFile)) {
    return readFile(cacheFile, "utf8");
  }
  const html = await politeFetch(`${SITE}/${slug}`);
  await mkdir(PAGES_DIR, { recursive: true });
  await writeFile(cacheFile, html);
  return html;
}

// ----------------------------------------------------------------------------
// ScaffoldingData extraction
// ----------------------------------------------------------------------------
function extractScaffolding(html) {
  const m = html.match(
    /<script[^>]*data-set="ScaffoldingData"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) throw new Error("ScaffoldingData block not found");
  return JSON.parse(m[1]);
}

// Recursively locate the page node for this slug that actually carries body content.
function findProjectNode(scaffold, slug) {
  let found = null;
  (function walk(node) {
    if (found || !node || typeof node !== "object") return;
    if (node.project_url === slug && typeof node.content === "string") {
      found = node;
      return;
    }
    if (Array.isArray(node.pages)) node.pages.forEach(walk);
  })(scaffold);
  return found;
}

function extractHeadMeta(html) {
  const t = html.match(/<title>([\s\S]*?)<\/title>/);
  return { title: t ? decodeEntities(t[1]).trim() : "" };
}

// ----------------------------------------------------------------------------
// HTML helpers
// ----------------------------------------------------------------------------
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  ccedil: "ç",
};
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in NAMED_ENTITIES ? NAMED_ENTITIES[n] : m));
}

// A link is "internal" if it points back at the old Cargo site (absolute
// artofmany.com / cargo hosts, relative paths, or the malformed http:///…).
// These have no equivalent route on the new site, so we drop the link but keep
// its text (see PLAN.md — decided with the user). External collaborator links
// are preserved.
function isInternalHref(href) {
  const h = (href || "").trim();
  if (!h || h === "#") return true;
  if (/^(mailto:|tel:)/i.test(h)) return false; // keep contact links
  if (h.startsWith("/")) return true; // relative (incl. protocol-relative //)
  if (!/^https?:\/\//i.test(h)) return true; // schemeless relative (e.g. "Marina-Soto")
  let u;
  try {
    u = new URL(h);
  } catch {
    return true; // unparseable -> treat as internal and strip the link
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "artofmany.com") return true;
  if (/(^|\.)cargocollective\.com$|(^|\.)cargo\.site$/.test(host)) return true;
  return false;
}

// Clean up an href straight out of the source HTML: strip stray tags (some
// hrefs contain a literal <br />), collapse whitespace, and fix a double scheme
// typo (http://http://…).
function cleanHref(href) {
  let h = decodeEntities(href)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, "")
    .trim();
  h = h.replace(/^(https?:\/\/)(?=https?:\/\/)/i, "");
  return h;
}

// Merge consecutive spans that share the same marks (keeps blocks tidy after
// internal links are demoted to plain text).
function mergeSpans(children, key) {
  const out = [];
  for (const span of children) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev._type === "span" &&
      span._type === "span" &&
      prev.marks.length === span.marks.length &&
      prev.marks.every((m, i) => m === span.marks[i])
    ) {
      prev.text += span.text;
    } else {
      out.push({ ...span, _key: key() });
    }
  }
  return out;
}

// Remove whole elements by class name (used to drop the .categorias nav row).
function stripElementsByClass(html, className) {
  // Matches <tag ... class="... className ...">...</tag> for div-like blocks.
  const re = new RegExp(
    `<(\\w+)[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/\\1>`,
    "gi",
  );
  return html.replace(re, "");
}

// Grab the inner HTML of every <div class="project_content_text">…</div>.
function extractContentTextHtml(content) {
  const parts = [];
  const re =
    /<div[^>]*class="[^"]*\bproject_content_text\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = re.exec(content))) parts.push(m[1]);
  return parts;
}

// ----------------------------------------------------------------------------
// Portable Text conversion (subset: text + <a href> + <br>)
// ----------------------------------------------------------------------------
// Per-document deterministic key generator (stable across re-runs).
function makeKeyGen() {
  let n = 0;
  return () => `k${(n++).toString(36)}`;
}

// Convert one project_content_text inner-HTML fragment into a list of runs:
// [{ text, href|null }]. <br> is turned into "\n" so we can split paragraphs.
function tokenizeRuns(fragment) {
  // normalise <br> -> newline, then strip every tag except <a>/</a>.
  let html = fragment.replace(/<br\s*\/?>/gi, "\n");
  const runs = [];
  const tagRe = /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>|<[^>]+>/gi;
  let last = 0;
  let m;
  while ((m = tagRe.exec(html))) {
    if (m.index > last) runs.push({ text: html.slice(last, m.index), href: null });
    if (m[1] !== undefined) {
      // an <a> — inner text may itself contain stray tags; strip them.
      const inner = m[2].replace(/<[^>]+>/g, "");
      runs.push({ text: decodeEntities(inner), href: cleanHref(m[1]) });
    }
    // else: some other tag we ignore (already contributes nothing)
    last = tagRe.lastIndex;
  }
  if (last < html.length) runs.push({ text: html.slice(last), href: null });
  // decode entities in plain runs
  return runs.map((r) => (r.href === null ? { ...r, text: decodeEntities(r.text) } : r));
}

// Build Portable Text blocks from all project_content_text fragments.
// externalHrefs (optional Set) collects the external URLs kept as links.
function htmlToPortableText(fragments, key, externalHrefs) {
  // Flatten fragments into runs, separating fragments with a paragraph break.
  let runs = [];
  fragments.forEach((frag, i) => {
    if (i > 0) runs.push({ text: "\n\n", href: null });
    runs = runs.concat(tokenizeRuns(frag));
  });

  // Split into paragraphs on blank lines; single newlines collapse to spaces.
  const paragraphs = [[]];
  for (const run of runs) {
    if (run.href) {
      paragraphs[paragraphs.length - 1].push(run);
      continue;
    }
    const pieces = run.text.split(/\n\s*\n+/); // paragraph boundaries
    pieces.forEach((piece, idx) => {
      if (idx > 0) paragraphs.push([]);
      const text = piece.replace(/\s*\n\s*/g, " "); // soft breaks -> space
      if (text) paragraphs[paragraphs.length - 1].push({ text, href: null });
    });
  }

  const blocks = [];
  for (const para of paragraphs) {
    let children = [];
    const markDefs = [];
    for (const run of para) {
      if (!run.text) continue;
      if (run.href && !isInternalHref(run.href)) {
        const lk = key();
        markDefs.push({ _type: "link", _key: lk, href: run.href });
        children.push({ _type: "span", _key: key(), text: run.text, marks: [lk] });
        if (externalHrefs) externalHrefs.add(run.href);
      } else {
        // plain text, or an internal link demoted to plain text
        children.push({ _type: "span", _key: key(), text: run.text, marks: [] });
      }
    }
    children = mergeSpans(children, key);
    // collapse leading/trailing whitespace-only spans; skip empty blocks
    while (children.length && !children[0].text.trim()) children.shift();
    while (children.length && !children[children.length - 1].text.trim()) children.pop();
    if (!children.length) continue;
    // drop markDefs no longer referenced after merging/trimming
    const used = new Set(children.flatMap((c) => c.marks || []));
    const liveDefs = markDefs.filter((d) => used.has(d._key));
    blocks.push({ _type: "block", _key: key(), style: "normal", markDefs: liveDefs, children });
  }
  return blocks;
}

// Plain-text version of the credits block, for metaDescription.
function fragmentsToPlainText(fragments) {
  return fragments
    .map((f) =>
      decodeEntities(
        f
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<[^>]+>/g, ""),
      ),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// ----------------------------------------------------------------------------
// Media extraction from content HTML
// ----------------------------------------------------------------------------
function extractGalleryImages(content) {
  // Inline <img> in DOM order — these are exactly the images rendered on the page.
  const imgs = [];
  const re = /<img\b[^>]*>/gi;
  let m;
  while ((m = re.exec(content))) {
    const tag = m[0];
    const src = (tag.match(/data-src="([^"]+)"/) || tag.match(/\ssrc="([^"]+)"/) || [])[1];
    if (!src || !src.includes("freight.cargo.site")) continue;
    const parsed = src.match(/\/i\/([0-9a-f]+)\/([^"?]+)/);
    imgs.push({
      url: src,
      hash: parsed ? parsed[1] : null,
      name: parsed ? decodeURIComponent(parsed[2]) : src.split("/").pop(),
      width: parseInt((tag.match(/\bwidth="(\d+)"/) || [])[1] || "0", 10) || undefined,
      height: parseInt((tag.match(/\bheight="(\d+)"/) || [])[1] || "0", 10) || undefined,
    });
  }
  return imgs;
}

function extractVimeoIds(content) {
  const ids = [];
  const re = /player\.vimeo\.com\/video\/(\d+)/gi;
  let m;
  while ((m = re.exec(content))) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids;
}

function extractYouTubeIds(content) {
  const ids = [];
  const re = /youtube\.com\/embed\/([\w-]+)|youtu\.be\/([\w-]+)|youtube\.com\/watch\?v=([\w-]+)/gi;
  let m;
  while ((m = re.exec(content))) {
    const id = m[1] || m[2] || m[3];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function coverFromListEntry(entry) {
  const im = entry?.thumb_meta?.thumbnail_crop?.imageModel;
  if (!im?.hash || !im?.name) return null;
  return {
    url: `https://freight.cargo.site/t/original/i/${im.hash}/${encodeURIComponent(im.name)}`,
    hash: im.hash,
    name: im.name,
  };
}

async function vimeoOEmbed(id) {
  const raw = await politeFetch(
    `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${id}`)}`,
  );
  return JSON.parse(raw); // { thumbnail_url, title, ... }
}

// ----------------------------------------------------------------------------
// Sanity client + asset upload (live mode only)
// ----------------------------------------------------------------------------
let client = null;
let assetCache = {};
async function initClient() {
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "SANITY_API_WRITE_TOKEN is not set. Create an Editor token for project " +
        `${PROJECT_ID} and run with:  node --env-file=.env scripts/import-projects.mjs`,
    );
  }
  const { createClient } = await import("@sanity/client");
  client = createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: API_VERSION,
    useCdn: false,
    token,
  });
  if (existsSync(ASSET_CACHE_FILE)) {
    assetCache = JSON.parse(await readFile(ASSET_CACHE_FILE, "utf8"));
  }
}

async function uploadImage(cacheKey, url, filename) {
  if (DRY_RUN) return `PENDING(${filename})`;
  if (assetCache[cacheKey]) return assetCache[cacheKey];
  const buf = await politeFetch(url, { asBuffer: true });
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

// ----------------------------------------------------------------------------
// Per-project transform
// ----------------------------------------------------------------------------
// Sanity document ids allow only [a-zA-Z0-9._-].
function sanitizeId(s) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function routeSlug(cargoSlug) {
  if (SLUG_MODE === "lower") {
    return cargoSlug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  return cargoSlug; // preserve original Cargo slug (keeps existing URLs / SEO)
}

async function buildProject(entry, index, externalHrefs) {
  const slug = entry.url;
  const key = makeKeyGen();
  const html = await getProjectPageHtml(slug);
  const scaffold = extractScaffolding(html);
  const node = findProjectNode(scaffold, slug);
  if (!node) throw new Error(`content node not found for ${slug}`);

  const content = stripElementsByClass(node.content, "categorias");
  const contentFragments = extractContentTextHtml(content);

  const description = htmlToPortableText(contentFragments, key, externalHrefs);
  const galleryRaw = extractGalleryImages(content);
  const vimeoIds = extractVimeoIds(content);
  const youtubeIds = extractYouTubeIds(content);
  const cover = coverFromListEntry(entry);
  const title = decodeEntities(entry.title_no_html || entry.title || node.title || slug);
  const categories = (entry.tags || node.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const head = extractHeadMeta(html);
  const metaDescription = fragmentsToPlainText(contentFragments);

  // --- assets ---
  if (!cover) warn(`${slug}: no cover thumbnail in list API`);
  const coverAsset = cover
    ? await uploadImage(`img:${cover.hash}`, cover.url, cover.name)
    : null;

  // Gallery = every inline <img> on the page, in DOM order. (No cover dedupe:
  // for single-image projects the on-page image often equals the grid thumbnail,
  // and dropping it would empty the gallery — the cover only shows on the home
  // grid, a different surface.)
  const gallery = [];
  for (const g of galleryRaw) {
    const assetId = await uploadImage(`img:${g.hash || g.url}`, g.url, g.name);
    gallery.push({
      _type: "image",
      _key: key(),
      asset: { _type: "reference", _ref: assetId },
    });
  }

  // Videos: Vimeo (manual poster from oEmbed) + YouTube (facade fetches its own).
  const videos = [];
  for (const id of vimeoIds) {
    let posterAsset = null;
    if (!DRY_RUN) {
      try {
        const oe = await vimeoOEmbed(id);
        if (oe.thumbnail_url) {
          posterAsset = await uploadImage(`vimeo:${id}`, oe.thumbnail_url, `vimeo-${id}.jpg`);
        }
      } catch (e) {
        warn(`${slug}: vimeo oEmbed failed for ${id}: ${e.message}`);
      }
    }
    videos.push({
      _type: "video",
      _key: key(),
      vimeoUrl: `https://vimeo.com/${id}`,
      ...(posterAsset ? { poster: imageRef(posterAsset, `${title} — video still`) } : {}),
    });
  }
  for (const id of youtubeIds) {
    videos.push({
      _type: "youtube",
      _key: key(),
      youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
    });
  }

  const doc = {
    _id: `project-${sanitizeId(slug)}`,
    _type: "project",
    title,
    ...(description.length ? { description } : {}),
    ...(categories.length ? { categories } : {}),
    ...(coverAsset ? { coverImage: imageRef(coverAsset, title) } : {}),
    ...(gallery.length ? { gallery } : {}),
    ...(videos.length ? { videos } : {}),
    order: index,
    slug: { _type: "slug", current: routeSlug(slug) },
    ...(head.title ? { metaTitle: head.title } : {}),
    ...(metaDescription ? { metaDescription } : {}),
  };

  const report = {
    slug,
    routeSlug: routeSlug(slug),
    title,
    descBlocks: description.length,
    gallery: gallery.length,
    vimeo: vimeoIds.length,
    youtube: youtubeIds.length,
    hasCover: !!coverAsset,
    categories,
  };
  return { doc, report };
}

// ----------------------------------------------------------------------------
// External link validation
// ----------------------------------------------------------------------------
async function checkExternalLink(url) {
  if (/^(mailto:|tel:)/i.test(url)) return { url, ok: true, status: "skip" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
    });
    return { url, ok: res.ok, status: res.status };
  } catch (e) {
    return { url, ok: false, status: e.name === "AbortError" ? "timeout" : e.cause?.code || e.message };
  } finally {
    clearTimeout(timer);
  }
}

async function checkAllLinks(urls, concurrency = 8) {
  const results = [];
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const idx = i++;
      results[idx] = await checkExternalLink(urls[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return results;
}

// A link is "dead" (permanently gone) if the domain doesn't resolve or the page
// is 404/410. 403/500/timeout/TLS are treated as alive-but-blocking and kept.
function isDeadStatus(status) {
  return status === 404 || status === 410 || status === "ENOTFOUND" || status === "ERR_INVALID_URL";
}

// Remove dead-link annotations from a doc's description, keeping the link text.
function stripDeadLinks(doc, deadSet, key) {
  if (!Array.isArray(doc.description)) return 0;
  let removed = 0;
  for (const block of doc.description) {
    if (block._type !== "block" || !block.markDefs) continue;
    const deadKeys = new Set(
      block.markDefs.filter((d) => d._type === "link" && deadSet.has(d.href)).map((d) => d._key),
    );
    if (!deadKeys.size) continue;
    removed += deadKeys.size;
    block.children = block.children.map((c) =>
      c._type === "span" ? { ...c, marks: (c.marks || []).filter((m) => !deadKeys.has(m)) } : c,
    );
    block.children = mergeSpans(block.children, key);
    const used = new Set(block.children.flatMap((c) => c.marks || []));
    block.markDefs = block.markDefs.filter((d) => used.has(d._key));
  }
  return removed;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  log(
    `artofmany import — ${DRY_RUN ? "DRY RUN" : "LIVE"} | slug-mode=${SLUG_MODE}` +
      (ONLY_SLUG ? ` | only=${ONLY_SLUG}` : LIMIT ? ` | limit=${LIMIT}` : ""),
  );
  if (!DRY_RUN) await initClient();

  let list = await getProjectList();
  if (ONLY_SLUG) list = list.filter((e) => e.url === ONLY_SLUG);
  if (LIMIT) list = list.slice(0, LIMIT);
  log(`${list.length} project(s) to process\n`);

  await mkdir(OUT_DIR, { recursive: true });
  const key = makeKeyGen();
  const anomalies = [];
  const linkUsage = new Map(); // external href -> Set(slug)
  const built = []; // { entry, doc, report }

  // --- Phase 1: build docs, upload assets, collect external links ---
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    try {
      const projExternal = new Set();
      const { doc, report } = await buildProject(entry, i, projExternal);
      for (const href of projExternal) {
        if (!linkUsage.has(href)) linkUsage.set(href, new Set());
        linkUsage.get(href).add(entry.url);
      }
      built.push({ entry, doc, report });
      const flags = [];
      if (!report.hasCover) flags.push("no-cover");
      if (!report.descBlocks) flags.push("no-desc");
      if (!report.gallery && !report.vimeo && !report.youtube) flags.push("no-media");
      if (flags.length) anomalies.push(`${entry.url}: ${flags.join(", ")}`);
      log(
        `[${i + 1}/${list.length}] ${entry.url} → ${report.routeSlug} — desc:${report.descBlocks} gallery:${report.gallery} vimeo:${report.vimeo} yt:${report.youtube} cover:${report.hasCover ? "y" : "n"}` +
          (flags.length ? `  <${flags.join(",")}>` : ""),
      );
    } catch (e) {
      anomalies.push(`${entry.url}: ERROR ${e.message}`);
      warn(`${entry.url}: ${e.message}`);
    }
  }

  // --- Phase 2: validate external links; strip dead ones from descriptions ---
  let broken = [];
  const deadSet = new Set();
  if (CHECK_LINKS && linkUsage.size) {
    const urls = [...linkUsage.keys()];
    log(`\nChecking ${urls.length} external link(s) …`);
    const results = await checkAllLinks(urls);
    broken = results
      .filter((r) => !r.ok)
      .map((r) => ({ ...r, dead: isDeadStatus(r.status), usedBy: [...linkUsage.get(r.url)] }));
    for (const b of broken) if (b.dead) deadSet.add(b.url);
    await writeFile(
      path.join(OUT_DIR, "_broken-links.json"),
      JSON.stringify({ checked: urls.length, brokenCount: broken.length, broken }, null, 2),
    );
  }

  let strippedLinks = 0;
  if (STRIP_DEAD && deadSet.size) {
    for (const b of built) strippedLinks += stripDeadLinks(b.doc, deadSet, key);
  }

  // --- Phase 3: write JSON + createOrReplace ---
  for (const { entry, doc } of built) {
    await writeFile(
      path.join(OUT_DIR, `${encodeURIComponent(entry.url)}.json`),
      JSON.stringify(doc, null, 2),
    );
    if (!DRY_RUN) await client.createOrReplace(doc);
  }

  await writeFile(
    path.join(OUT_DIR, "_report.json"),
    JSON.stringify(
      { count: built.length, reports: built.map((b) => b.report), anomalies, brokenLinks: broken },
      null,
      2,
    ),
  );

  log(`\nDone. ${built.length} project(s) processed${DRY_RUN ? "" : " and written to Sanity"}.`);
  log(`Output: ${OUT_DIR}`);
  if (anomalies.length) {
    log(`\nAnomalies (${anomalies.length}):`);
    anomalies.forEach((a) => log(`  - ${a}`));
  }
  if (broken.length) {
    const deadN = broken.filter((b) => b.dead).length;
    log(`\nBroken external links: ${broken.length} (${deadN} dead${STRIP_DEAD ? ` → ${strippedLinks} link(s) stripped, text kept` : ""}, ${broken.length - deadN} likely bot-blocked → kept):`);
    broken.forEach((b) =>
      log(`  ${b.dead ? "☠" : "✗"} [${b.status}] ${b.url}  (${b.usedBy.length}× ${b.usedBy.join(", ")})`),
    );
  }
  if (DRY_RUN) log(`\nDRY RUN — no assets uploaded, no documents written.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
