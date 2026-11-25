/**
 * The consulting deck design system, copied from .claude/skills/consulting-ppt-template/assets/theme.json so VOLT's
 * PowerPoint export and the skill's template look the same. tests/export.test.ts fails if the two drift apart.
 */
export const DECK = {
  colors: {
    dk1: "10193A", // navy: body text and dark panels
    lt1: "FFFFFF",
    dk2: "121A5D", // ink navy: titles
    lt2: "E9E9E9", // light grey: dividers, muted bars
    accent1: "0B6AE9", // blue: the one accent
    accent2: "121A5D",
    accent3: "7FA7F0",
    accent4: "0097A7", // status: built, green, low
    accent5: "E3A92B", // status: mapped, amber, medium
    accent6: "D6457F", // status: new, red, high
  },
  fonts: { heading: "Georgia", body: "Arial" },
  type_pt: { cover_title: 40, title: 26, heading: 18, stat: 32, body: 14, small: 12, source: 10, footer: 9 },
  grid: { margin_in: 0.6, title_top_in: 0.4, title_height_in: 1.0, content_top_in: 1.6, content_bottom_in: 6.6, source_top_in: 6.7, footer_top_in: 7.08 },
} as const;

/** Muted grey for secondary text: passes 4.5:1 on white. */
export const MUTED = "5B6275";
