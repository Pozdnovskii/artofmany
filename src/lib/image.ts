import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import { sanityClient } from "./sanity";

const builder = createImageUrlBuilder(sanityClient);

/** Build a Sanity image URL from an image object (with asset._ref). */
export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
