import { defineField, defineArrayMember } from "sanity";
import type { FieldGroupDefinition } from "sanity";
import { EditIcon, SearchIcon } from "@sanity/icons";

export const standardGroups: FieldGroupDefinition[] = [
  { name: "content", title: "Content", default: true, icon: EditIcon },
  { name: "seo", title: "SEO", icon: SearchIcon },
];

export const slugField = defineField({
  name: "slug",
  title: "Slug *",
  type: "slug",
  group: "seo",
  options: { source: "title", maxLength: 96 },
  validation: (r) => r.required(),
});

export const seoMetaFields = ({ required = false }: { required?: boolean } = {}) => [
  defineField({
    name: "metaTitle",
    title: required ? "Meta title *" : "Meta title",
    type: "string",
    group: "seo",
    description: "Recommended: 50–60 characters",
    validation: required ? (r) => r.required() : undefined,
  }),
  defineField({
    name: "metaDescription",
    title: required ? "Meta description *" : "Meta description",
    type: "text",
    rows: 2,
    group: "seo",
    description: "Recommended: 120–160 characters",
    validation: required ? (r) => r.required() : undefined,
  }),
];

export const seoFields = (opts?: { required?: boolean }) => [
  slugField,
  ...seoMetaFields(opts),
];

export const imageWithAlt = (
  name: string,
  title?: string,
  opts?: { required?: boolean },
) =>
  defineField({
    name,
    type: "image",
    title,
    // Focal point (defaults to centre). Editors move the dot to steer the
    // aspect-crop of covers/photos; the crop rectangle can be left untouched.
    options: { hotspot: true },
    validation: opts?.required ? (r) => r.required() : undefined,
    fields: [
      defineField({
        name: "alt",
        type: "string",
        title: "Alt text",
        validation: (rule) => rule.required().warning("Add alt text"),
      }),
    ],
  });

const linkAnnotation = {
  name: "link",
  type: "object",
  title: "Link",
  fields: [
    defineField({
      name: "href",
      type: "url",
      title: "URL",
      validation: (r) => r.required(),
    }),
  ],
};

// Headings/lists/bold — for genuinely long-form copy (about-page bio etc.).
export const richTextField = (name: string, title?: string) =>
  defineField({
    name,
    type: "array",
    title,
    of: [
      defineArrayMember({
        type: "block",
        styles: [
          { title: "Normal", value: "normal" },
          { title: "H2", value: "h2" },
          { title: "H3", value: "h3" },
        ],
        lists: [
          { title: "Bullet", value: "bullet" },
          { title: "Numbered", value: "number" },
        ],
        marks: {
          decorators: [
            { title: "Bold", value: "strong" },
            { title: "Italic", value: "em" },
          ],
          annotations: [linkAnnotation],
        },
      }),
    ],
  });

// Plain paragraphs + links only, no headings/lists/bold. Matches the source
// data: project descriptions are one unstructured paragraph with inline
// links to collaborators' sites, no other formatting.
export const linkedTextField = (name: string, title?: string) =>
  defineField({
    name,
    type: "array",
    title,
    of: [
      defineArrayMember({
        type: "block",
        styles: [{ title: "Normal", value: "normal" }],
        lists: [],
        marks: {
          decorators: [],
          annotations: [linkAnnotation],
        },
      }),
    ],
  });
