import { createClient } from "@sanity/client";

export const sanityClient = createClient({
  projectId: "4d6uk72c",
  dataset: "production",
  apiVersion: "2026-07-10",
  useCdn: false,
  perspective: "published",
});
