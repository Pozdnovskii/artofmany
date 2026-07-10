import { defineField, defineType, defineArrayMember } from "sanity";
import { EnvelopeIcon } from "@sanity/icons";

export const contactInfo = defineType({
  name: "contactInfo",
  title: "Contact Info",
  type: "document",
  icon: EnvelopeIcon,
  fields: [
    defineField({
      name: "email",
      title: "Email *",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({ name: "phone", title: "Phone", type: "string" }),
    defineField({
      name: "socialLinks",
      title: "Social links",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "platform",
              type: "string",
              title: "Platform *",
              options: {
                list: ["instagram", "facebook", "behance", "pinterest", "linkedin"],
              },
              validation: (r) => r.required(),
            }),
            defineField({
              name: "url",
              type: "url",
              title: "URL *",
              validation: (r) => r.required(),
            }),
          ],
          preview: { select: { title: "platform", subtitle: "url" } },
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Contact Info" }),
  },
});
