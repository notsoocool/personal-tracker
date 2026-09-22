import type { InboxType } from "./types";

export type SmartChipId =
  | "bug-page"
  | "ui-off"
  | "missing-feature"
  | "review-screen";

export type SmartTemplate = {
  id: SmartChipId;
  label: string;
  defaultType: InboxType;
  seedText: string;
};

export const FLIT_SMART_TEMPLATES: SmartTemplate[] = [
  {
    id: "bug-page",
    label: "Bug on this page",
    defaultType: "review",
    seedText:
      "Something is broken on this Flit page.\nWhat happens: \nWhat I expected: \nPage URL: https://",
  },
  {
    id: "ui-off",
    label: "UI feels off",
    defaultType: "review",
    seedText:
      "This Flit screen feels visually off.\nWhat looks wrong: \nPage URL: https://",
  },
  {
    id: "missing-feature",
    label: "Missing feature",
    defaultType: "todo",
    seedText:
      "Flit needs a feature that isn’t there yet.\nWhat I need: \nWhy it matters: ",
  },
  {
    id: "review-screen",
    label: "Please review this screen",
    defaultType: "review",
    seedText:
      "Please review this Flit screen and share what should change.\nPage URL: https://",
  },
];

export function getSmartTemplate(id: string): SmartTemplate | undefined {
  return FLIT_SMART_TEMPLATES.find((t) => t.id === id);
}
