import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes, SINGLETON_TYPES } from "@studio/schemas";
import { structure } from "@studio/structure";

export default defineConfig({
  name: "artofmany",
  title: "Art of Many",
  projectId: "4d6uk72c",
  dataset: "production",
  plugins: [structureTool({ structure })],
  schema: {
    types: schemaTypes,
    templates: (prev) =>
      prev.filter((t) => !SINGLETON_TYPES.includes(t.schemaType)),
  },
});
