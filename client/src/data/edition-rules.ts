import type { EditionId } from "@/lib/editions";

export interface RuleItem {
  label?: string;
  text: string;
}

export type RuleBlock =
  | { kind: "paragraph"; label?: string; text: string; note?: string }
  | { kind: "list"; ordered: boolean; items: RuleItem[] };

export interface RuleSection {
  id: string;
  title: string;
  blocks: RuleBlock[];
}

export type RulesetId = "base" | "sequential" | "tournament";

export interface Ruleset {
  id: RulesetId;
  quickReference: RuleItem[];
  sections: RuleSection[];
}

// Single source of truth for the Mercy Rule; used by every ruleset.
export const MERCY_RULE_LABEL = "Mercy Rule";
export const MERCY_RULE_TEXT =
  "A player whose score exceeds 5 over par may end their turn by accepting a score of +5 for that hole.";
export const MERCY_RULE_NOTE =
  "The +5 cap means the player's score for that hole is capped at 5 over par (+5), not five total strokes.";

const MERCY_RULE_ITEM: RuleItem = { label: MERCY_RULE_LABEL, text: MERCY_RULE_TEXT };
const MERCY_RULE_BLOCK: RuleBlock = {
  kind: "paragraph",
  label: MERCY_RULE_LABEL,
  text: MERCY_RULE_TEXT,
  note: MERCY_RULE_NOTE,
};

const LAYOUT_TEXT =
  "Balls are generally positioned along the table's diamond gridlines, frozen against cushions or other balls, or centered on the edge of a pocket.";

const DRAW_CARD: RuleItem = {
  label: "Draw a Card",
  text: "The tallest player draws a card at random. Arrange the striped and/or solid balls to match the card's layout.",
};
const ESTABLISH_PAR: RuleItem = {
  label: "Establish Par",
  text: "Par equals the total number of striped and solid balls in the layout.",
};
const JOKERS_BLOCK: RuleBlock = {
  kind: "paragraph",
  label: "Jokers",
  text: "A player who draws a Joker may create a custom layout or replay a previously drawn card.",
};

const BASE_RULES: Ruleset = {
  id: "base",
  quickReference: [
    { label: "Goal", text: "Pocket all balls in as few strokes as possible. Par equals the total number of striped and solid balls in the layout." },
    { label: "Tee off", text: "Tallest to shortest, with ball in hand. Pocket all stripes before pocketing solids. Calling shots is not required." },
    { label: "Scoring", text: "Each stroke attempt counts. The fewest total strokes, including penalties, wins." },
    MERCY_RULE_ITEM,
    { label: "Penalties", text: "1 stroke for out-of-turn contact (per stroke attempt), and 1 stroke for a scratch or any ball off the table. Ball in hand after a scratch or off-table cue ball." },
  ],
  sections: [
    {
      id: "setup",
      title: "Setup & Gameplay",
      blocks: [
        {
          kind: "list",
          ordered: true,
          items: [
            DRAW_CARD,
            {
              label: "Tee Off",
              text: "Players take turns from tallest to shortest, attempting to pocket all balls in as few strokes as possible. Players begin with ball in hand and must pocket all stripes before pocketing solids. Calling shots is not required.",
            },
            ESTABLISH_PAR,
            {
              label: "Play Subsequent Rounds",
              text: "After each round, play order follows lowest to highest running score. Ties are broken from tallest to shortest.",
            },
            {
              label: "Draw the Next Card",
              text: "The first player to tee off may draw the next card or delegate the draw and any resulting Joker layout. Place previously drawn cards face up in a discard pile, with the current course on top.",
            },
          ],
        },
        JOKERS_BLOCK,
      ],
    },
    {
      id: "scoring",
      title: "Scoring & Winning",
      blocks: [
        {
          kind: "paragraph",
          text: "Each stroke attempt counts toward the player's score. The winner has the fewest total strokes, including penalties, at the end of the game.",
        },
        MERCY_RULE_BLOCK,
      ],
    },
    {
      id: "penalties",
      title: "Penalties",
      blocks: [
        {
          kind: "list",
          ordered: false,
          items: [
            {
              label: "Out-of-Turn Contact",
              text: "Contacting or otherwise disturbing one or more solids before all stripes have been pocketed results in a 1-stroke penalty per stroke attempt. Penalties apply until all balls come to rest.",
            },
            {
              label: "Scratch or Off-Table",
              text: "A 1-stroke penalty applies if the cue ball is pocketed (scratch) or any ball comes to rest off the playing surface. These penalties are added to any applicable out-of-turn penalties.",
            },
            {
              label: "Ball in Hand",
              text: "After a scratch or when the cue ball comes to rest off the table, the player retains their turn and continues with ball in hand.",
            },
            {
              label: "Legal Combination Strokes",
              text: "Stripes and solids may be moved or pocketed in the same stroke attempt, provided the cue ball contacts a stripe first and all stripes are pocketed before the next stroke. Disturbing any solids before all stripes are pocketed results in an out-of-turn penalty (+1).",
            },
          ],
        },
      ],
    },
    {
      id: "layout",
      title: "Layout Guidelines",
      blocks: [
        { kind: "paragraph", text: LAYOUT_TEXT },
        { kind: "paragraph", label: "Par clarification", text: "Par counts all striped and solid balls in the layout." },
      ],
    },
  ],
};

const SEQUENTIAL_RULES: Ruleset = {
  id: "sequential",
  quickReference: [
    { label: "Goal", text: "Pocket all balls in as few strokes as possible. Par equals the total number of striped and solid balls in the layout." },
    { label: "Tee off", text: "Tallest to shortest, with ball in hand. The lowest-numbered ball must be contacted first, but balls may be pocketed in any order. Calling shots is not required." },
    { label: "Scoring", text: "The fewest total strokes, including penalties, wins." },
    MERCY_RULE_ITEM,
    { label: "Penalties", text: "1 stroke for contacting a ball other than the lowest-numbered ball first, and 1 stroke for a scratch or any ball off the table. Ball in hand after a scratch or off-table cue ball." },
  ],
  sections: [
    {
      id: "setup",
      title: "Setup & Gameplay",
      blocks: [
        {
          kind: "list",
          ordered: true,
          items: [
            DRAW_CARD,
            {
              label: "Tee Off",
              text: "Players take turns from tallest to shortest, attempting to pocket all balls in as few strokes as possible. Players begin with ball in hand. The lowest-numbered ball must be contacted first, but balls may be pocketed in any order. Calling shots is not required.",
            },
            ESTABLISH_PAR,
            {
              label: "Continue Play",
              text: "Subsequent rounds proceed from lowest to highest running score, with ties broken from tallest to shortest. The first player to tee off may draw the next card or delegate the draw and any resulting Joker layout. Place previously drawn cards face up in a discard pile, with the current course on top.",
            },
          ],
        },
        JOKERS_BLOCK,
      ],
    },
    {
      id: "scoring",
      title: "Scoring & Winning",
      blocks: [
        { kind: "paragraph", text: "The winner has the fewest total strokes, including penalties, at the end of the game." },
        MERCY_RULE_BLOCK,
      ],
    },
    {
      id: "penalties",
      title: "Penalties",
      blocks: [
        {
          kind: "list",
          ordered: false,
          items: [
            {
              label: "Wrong First Contact",
              text: "Contacting a ball other than the lowest-numbered ball first incurs a 1-stroke penalty.",
            },
            {
              label: "Scratch or Off-Table",
              text: "Pocketing the cue ball (scratch) or any ball coming to rest off the playing surface incurs a 1-stroke penalty. These penalties are cumulative with any applicable out-of-turn penalties.",
            },
            {
              label: "Ball in Hand",
              text: "After a scratch or when the cue ball comes to rest off the table, the player retains their turn and continues with ball in hand.",
            },
          ],
        },
        { kind: "paragraph", text: "Penalties apply until all balls come to rest." },
      ],
    },
    {
      id: "layout",
      title: "Layout Guidelines",
      blocks: [{ kind: "paragraph", text: LAYOUT_TEXT }],
    },
  ],
};

const TOURNAMENT_RULES: Ruleset = {
  id: "tournament",
  quickReference: [
    { label: "Goal", text: "Pocket all balls in as few strokes as possible across all 18 holes." },
    { label: "Format", text: "18 holes, assigned across the available tables by the Tournament Director. Players complete assigned holes in ascending course-number order." },
    { label: "Tee off", text: "The tallest player tees off first, from behind the Tee Box. Balls may be pocketed in any order, and calling shots is not required." },
    { label: "Scoring", text: "Scores are recorded and submitted digitally through the official Par for the Course tournament app. The fewest total strokes, including penalties, across all 18 holes wins." },
    MERCY_RULE_ITEM,
    { label: "Penalties", text: "1 stroke for a scratch or any ball off the table (cumulative). Ball in hand after a scratch. Teeing off from outside the Tee Box is a null score for that attempt." },
  ],
  sections: [
    {
      id: "setup",
      title: "Table Assignments & Setup",
      blocks: [
        {
          kind: "paragraph",
          text: "The Tournament Director assigns all 18 holes across the available tables as evenly as possible. For example, 6 tables receive 3 holes each; 3 tables receive 6 holes each.",
        },
        { kind: "paragraph", text: "Players set up each assigned course to match its corresponding card layout." },
      ],
    },
    {
      id: "gameplay",
      title: "Playing Order & Gameplay",
      blocks: [
        {
          kind: "paragraph",
          text: "The tallest player tees off first. Players complete their assigned holes in ascending course-number order (e.g., H03, H04, H05…).",
        },
        {
          kind: "paragraph",
          text: "From behind the Tee Box, players attempt to pocket all balls in as few strokes as possible. Balls may be pocketed in any order, and calling shots is not required.",
        },
      ],
    },
    {
      id: "digital-scoring",
      title: "Digital Scoring",
      blocks: [
        {
          kind: "paragraph",
          text: "Scores are recorded and submitted digitally through the official Par for the Course tournament app. Paper scorecards are not required.",
        },
        {
          kind: "paragraph",
          text: "Each stroke and applicable penalty counts toward the player's score. The winner has the fewest total strokes, including penalties, across all 18 holes.",
        },
      ],
    },
    {
      id: "mercy",
      title: "Mercy Rule",
      blocks: [{ kind: "paragraph", text: MERCY_RULE_TEXT, note: MERCY_RULE_NOTE }],
    },
    {
      id: "rotation",
      title: "Table Rotation",
      blocks: [
        {
          kind: "paragraph",
          text: "Once all players have completed every hole assigned to their current table, the group rotates to the next table. Play continues until every player has completed all 18 holes and submitted their scores.",
        },
      ],
    },
    {
      id: "penalties",
      title: "Penalties & Rulings",
      blocks: [
        {
          kind: "list",
          ordered: false,
          items: [
            {
              label: "Scratch or Off-Table",
              text: "A 1-stroke penalty applies if the cue ball is pocketed (scratch) or any ball comes to rest off the playing surface. These penalties are cumulative. Final score equals strokes plus penalties.",
            },
            {
              label: "Ball in Hand",
              text: "Following a scratch or when the cue ball comes to rest off the table, the player retains their turn and continues with ball in hand.",
            },
            {
              label: "Tee Box Violation",
              text: "A player who unintentionally tees off from outside the designated Tee Box receives a null score for that attempt. The course must be reset, and the player must restart from within the Tee Box. Repeated violations may result in dismissal from the tournament.",
            },
          ],
        },
        { kind: "paragraph", text: "Penalties remain applicable until all balls come to rest." },
      ],
    },
    {
      id: "clarifications",
      title: "Rules & Clarifications",
      blocks: [
        {
          kind: "paragraph",
          text: "The Tournament Director or a designated referee may be consulted for rules clarifications or rulings. These published rules are available for all participants to reference.",
        },
      ],
    },
    {
      id: "layout",
      title: "Layout Guidelines",
      blocks: [{ kind: "paragraph", text: LAYOUT_TEXT }],
    },
  ],
};

export const RULESETS: Record<RulesetId, Ruleset> = {
  base: BASE_RULES,
  sequential: SEQUENTIAL_RULES,
  tournament: TOURNAMENT_RULES,
};

// Explicit edition -> ruleset mapping (never keyed on display names or array order).
export const EDITION_RULESET_IDS: Record<EditionId, RulesetId> = {
  classic: "base",
  reracked: "base",
  "teed-off": "base",
  sequential: "sequential",
  tournament: "tournament",
};

export const RULES_EDITION_ORDER: EditionId[] = ["classic", "reracked", "sequential", "tournament", "teed-off"];

export const RULES_EDITION_NAMES: Record<EditionId, string> = {
  classic: "Classic",
  reracked: "Reracked",
  sequential: "Sequential",
  tournament: "Tournament",
  "teed-off": "Tee'd Off",
};

export const DEFAULT_RULES_EDITION: EditionId = "classic";

export function isRulesEditionId(value: unknown): value is EditionId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EDITION_RULESET_IDS, value);
}

export interface EditionRules {
  editionId: EditionId;
  editionName: string;
  ruleset: Ruleset;
}

// Missing or unknown ids (e.g. legacy saves) fall back to the app's legacy default edition.
export function getEditionRules(editionId?: string | null): EditionRules {
  const id = isRulesEditionId(editionId) ? editionId : DEFAULT_RULES_EDITION;
  return {
    editionId: id,
    editionName: RULES_EDITION_NAMES[id],
    ruleset: RULESETS[EDITION_RULESET_IDS[id]],
  };
}

export function rulesetToText(ruleset: Ruleset): string {
  const itemText = (item: RuleItem) => (item.label ? `${item.label}: ${item.text}` : item.text);
  const parts: string[] = [];
  for (const section of ruleset.sections) {
    parts.push(section.title);
    for (const block of section.blocks) {
      if (block.kind === "paragraph") {
        parts.push(block.label ? `${block.label}: ${block.text}` : block.text);
        if (block.note) parts.push(block.note);
      } else {
        parts.push(...block.items.map(itemText));
      }
    }
  }
  return parts.join("\n");
}
