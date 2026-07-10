import { defineField, defineType } from "sanity";
import { HomeIcon } from "@sanity/icons";

export const homePage = defineType({
  name: "homePage",
  title: "Home Page",
  type: "document",
  icon: HomeIcon,
  fields: [
    defineField({
      name: "backgroundVideo",
      title: "Background video (MP4) *",
      type: "file",
      options: { accept: "video/mp4" },
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    prepare: () => ({ title: "Home Page" }),
  },
});
