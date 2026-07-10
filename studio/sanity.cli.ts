import { defineCliConfig } from "sanity/cli";
import path from "path";

export default defineCliConfig({
  api: {
    projectId: "4d6uk72c",
    dataset: "production",
  },
  vite: {
    resolve: {
      alias: {
        "@studio": path.resolve("."),
      },
    },
  },
});
