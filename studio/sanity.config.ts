import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { RocketIcon } from "@sanity/icons";
import { schemaTypes, SINGLETON_TYPES } from "@studio/schemas";
import { structure } from "@studio/structure";
import { DeployTool } from "@studio/plugins/DeployTool";

export default defineConfig({
  name: "artofmany",
  title: "Art of Many",
  projectId: "4d6uk72c",
  dataset: "production",
  plugins: [structureTool({ structure })],
  tools: [
    {
      name: "deploy",
      title: "Deploy",
      icon: RocketIcon,
      component: DeployTool,
    },
  ],
  schema: {
    types: schemaTypes,
    templates: (prev) =>
      prev.filter((t) => !SINGLETON_TYPES.includes(t.schemaType)),
  },
});
