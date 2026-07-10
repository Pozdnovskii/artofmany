import { defineField, defineType, defineArrayMember } from "sanity";
import { UsersIcon } from "@sanity/icons";
import { richTextField } from "../shared";

export const aboutPage = defineType({
  name: "aboutPage",
  title: "About Page",
  type: "document",
  icon: UsersIcon,
  fields: [
    richTextField("bio", "Bio"),
    defineField({
      name: "offices",
      title: "Offices",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "city",
              type: "string",
              title: "City *",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "addressLines",
              type: "array",
              title: "Address",
              of: [defineArrayMember({ type: "string" })],
            }),
            defineField({ name: "mapLink", type: "url", title: "Map link" }),
          ],
          preview: { select: { title: "city" } },
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "About Page" }),
  },
});
