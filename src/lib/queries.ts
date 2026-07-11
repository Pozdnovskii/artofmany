import { sanityClient } from "./sanity";
import type { PortableTextBlock } from "@portabletext/types";
import type { SanityImageSource } from "@sanity/image-url";

export interface ImageWithAlt {
  _key?: string;
  asset: { _ref: string };
  alt?: string;
  dimensions?: { width: number; height: number };
}
export interface VideoItem {
  _key: string;
  _type: "video" | "youtube";
  vimeoUrl?: string;
  youtubeUrl?: string;
  poster?: ImageWithAlt;
}
export interface ProjectCardData {
  _id: string;
  title: string;
  slug: string;
  categories?: string[];
  coverImage: ImageWithAlt;
}
export interface Project extends ProjectCardData {
  description?: PortableTextBlock[];
  gallery?: ImageWithAlt[];
  videos?: VideoItem[];
  metaTitle?: string;
  metaDescription?: string;
}
export interface Office {
  _key: string;
  city: string;
  address: string;
  email: string;
  phone: string;
  mapLink?: string;
}
export interface SocialLink {
  _key: string;
  platform: string;
  url: string;
}
export interface ContactInfo {
  email?: string;
  phone?: string;
  socialLinks?: SocialLink[];
}
export interface TeamMember {
  name: string;
  role: string;
  bio?: string;
  photo: ImageWithAlt; // required in the schema
  contactLinks?: { _key: string; label: string; url: string }[];
}

const CARD = `_id, title, "slug": slug.current, categories, coverImage`;

let projectsCache: Promise<ProjectCardData[]> | null = null;
export const getProjects = (): Promise<ProjectCardData[]> => {
  if (import.meta.env.PROD && projectsCache) return projectsCache;
  const query = sanityClient.fetch<ProjectCardData[]>(
    `*[_type == "project"] | order(order asc){ ${CARD} }`,
  );
  if (import.meta.env.PROD) projectsCache = query;
  return query;
};

export const getProjectSlugs = (): Promise<string[]> =>
  sanityClient.fetch(`*[_type == "project" && defined(slug.current)].slug.current`);

export const getProject = (slug: string): Promise<Project | null> =>
  sanityClient.fetch(
    `*[_type == "project" && slug.current == $slug][0]{
      ${CARD}, description, gallery, videos, metaTitle, metaDescription
    }`,
    { slug },
  );

export const getContact = (): Promise<ContactInfo | null> =>
  sanityClient.fetch(`*[_id == "contactInfo"][0]{ email, phone, socialLinks }`);

export const getAbout = (): Promise<{ bio?: PortableTextBlock[]; offices?: Office[] } | null> =>
  sanityClient.fetch(`*[_id == "aboutPage"][0]{ bio, offices }`);

export const getTeam = (): Promise<TeamMember[]> =>
  sanityClient.fetch(
    `*[_type == "teamMember"] | order(order asc){ name, role, bio, photo, contactLinks }`,
  );

export const getHomeVideoUrl = (): Promise<string | null> =>
  sanityClient.fetch(`*[_id == "homePage"][0].backgroundVideo.asset->url`);

export type { SanityImageSource };
