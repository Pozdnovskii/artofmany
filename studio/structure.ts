import type { StructureResolver } from "sanity/structure";
import { UsersIcon, EnvelopeIcon } from "@sanity/icons";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .title("About Page")
        .icon(UsersIcon)
        .child(S.document().schemaType("aboutPage").documentId("aboutPage")),
      S.listItem()
        .title("Contact Info")
        .icon(EnvelopeIcon)
        .child(
          S.document().schemaType("contactInfo").documentId("contactInfo"),
        ),
      S.divider(),
      S.documentTypeListItem("project").title("Projects"),
      S.documentTypeListItem("teamMember").title("Team Members"),
    ]);
