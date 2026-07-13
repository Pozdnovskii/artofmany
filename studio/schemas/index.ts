import type { SchemaTypeDefinition } from "sanity";

import { project } from "./documents/project";
import { teamMember } from "./documents/teamMember";

import { aboutPage } from "./singletons/aboutPage";
import { contactInfo } from "./singletons/contactInfo";

export const schemaTypes: SchemaTypeDefinition[] = [
  aboutPage,
  contactInfo,

  project,
  teamMember,
];

export const SINGLETON_TYPES: string[] = ["aboutPage", "contactInfo"];
