import { defineCliConfig } from "sanity/cli";
import path from "path";

export default defineCliConfig({
  api: {
    projectId: "4d6uk72c",
    dataset: "production",
  },
  studioHost: "artofmany",
  deployment: {
    appId: "a7kjic95i1r5wtqsosp2yowz",
  },
  vite: {
    resolve: {
      alias: {
        "@studio": path.resolve("."),
      },
    },
  },
});
