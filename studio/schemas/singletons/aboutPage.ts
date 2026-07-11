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
              name: "address",
              type: "text",
              rows: 2,
              title: "Address *",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "email",
              type: "string",
              title: "Email *",
              validation: (r) => r.required().email(),
            }),
            defineField({
              name: "phone",
              type: "string",
              title: "Phone *",
              validation: (r) => r.required(),
            }),
            defineField({ name: "mapLink", type: "url", title: "Map link" }),
          ],
          preview: { select: { title: "city", subtitle: "address" } },
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "About Page" }),
  },
});
