import type { SchemaTypeDefinition } from "sanity";

import { project } from "./documents/project";
import { teamMember } from "./documents/teamMember";

import { homePage } from "./singletons/homePage";
import { aboutPage } from "./singletons/aboutPage";
import { contactInfo } from "./singletons/contactInfo";

export const schemaTypes: SchemaTypeDefinition[] = [
  homePage,
  aboutPage,
  contactInfo,

  project,
  teamMember,
];

export const SINGLETON_TYPES: string[] = ["homePage", "aboutPage", "contactInfo"];
