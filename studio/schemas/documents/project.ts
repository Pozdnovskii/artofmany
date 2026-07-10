import { defineField, defineType, defineArrayMember } from "sanity";
import { InboxIcon, PlayIcon } from "@sanity/icons";
import {
  standardGroups,
  slugField,
  seoMetaFields,
  imageWithAlt,
  linkedTextField,
} from "../shared";

export const project = defineType({
  name: "project",
  title: "Projects",
  type: "document",
  icon: InboxIcon,
  groups: standardGroups,
  fields: [
    defineField({
      name: "title",
      title: "Title *",
      type: "string",
      group: "content",
      validation: (r) => r.required(),
    }),
    linkedTextField("description", "Description"),
    defineField({
      name: "categories",
      title: "Categories",
      type: "array",
      group: "content",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),
    imageWithAlt("coverImage", "Cover image *", { required: true }),
    defineField({
      name: "gallery",
      title: "Gallery",
      type: "array",
      group: "content",
      of: [
        defineArrayMember({
          type: "image",
          fields: [
            defineField({
              name: "alt",
              type: "string",
              title: "Alt text",
              validation: (rule) => rule.required().warning("Add alt text"),
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: "videos",
      title: "Videos",
      type: "array",
      group: "content",
      of: [
        // Vimeo — poster is uploaded manually (no reliable public Vimeo thumbnail API).
        defineArrayMember({
          type: "object",
          name: "video",
          title: "Vimeo video",
          icon: PlayIcon,
          fields: [
            defineField({
              name: "vimeoUrl",
              type: "url",
              title: "Vimeo URL *",
              validation: (r) => r.required(),
            }),
            imageWithAlt("poster", "Poster image *", { required: true }),
          ],
          preview: {
            select: { vimeoUrl: "vimeoUrl", media: "poster" },
            prepare: ({ vimeoUrl, media }) => ({
              title: "Vimeo video",
              subtitle: vimeoUrl,
              media,
            }),
          },
        }),
        // YouTube — rendered via the astro-embed YouTube facade, which pulls its
        // own thumbnail, so no poster field is needed here.
        defineArrayMember({
          type: "object",
          name: "youtube",
          title: "YouTube video",
          icon: PlayIcon,
          fields: [
            defineField({
              name: "youtubeUrl",
              type: "url",
              title: "YouTube URL *",
              validation: (r) => r.required(),
            }),
          ],
          preview: {
            select: { youtubeUrl: "youtubeUrl" },
            prepare: ({ youtubeUrl }) => ({
              title: "YouTube video",
              subtitle: youtubeUrl,
            }),
          },
        }),
      ],
    }),
    defineField({
      name: "order",
      type: "number",
      group: "content",
      initialValue: 0,
    }),
    slugField,
    ...seoMetaFields(),
  ],
  orderings: [
    {
      title: "Order",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "title", media: "coverImage" },
  },
});
