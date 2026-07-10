import { defineField, defineType, defineArrayMember } from "sanity";
import { UserIcon } from "@sanity/icons";
import { imageWithAlt } from "../shared";

export const teamMember = defineType({
  name: "teamMember",
  title: "Team Members",
  type: "document",
  icon: UserIcon,
  fields: [
    defineField({
      name: "name",
      title: "Name *",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "role",
      title: "Role *",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({ name: "bio", title: "Bio", type: "text", rows: 3 }),
    defineField({
      name: "contactLinks",
      title: "Contact links",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "label",
              type: "string",
              title: "Label *",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "url",
              type: "url",
              title: "URL *",
              validation: (r) => r.required(),
            }),
          ],
          preview: { select: { title: "label", subtitle: "url" } },
        }),
      ],
    }),
    imageWithAlt("photo", "Photo *", { required: true }),
    defineField({ name: "order", type: "number", initialValue: 0 }),
  ],
  orderings: [
    {
      title: "Order",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "name", subtitle: "role", media: "photo" },
  },
});
