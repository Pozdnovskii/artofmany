import { createClient } from "@sanity/client";

export const sanityClient = createClient({
  projectId: "4d6uk72c",
  dataset: "production",
  apiVersion: "2026-07-10",
  // Build-only read client (static site). CDN is faster + a separate quota
  // bucket; a few-seconds lag after publish is fine since clone+install runs
  // first. (build-speed playbook §2)
  useCdn: true,
  perspective: "published",
});
