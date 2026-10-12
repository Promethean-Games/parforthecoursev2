export type EditionId = "classic" | "reracked" | "sequential" | "teed-off" | "tournament";

export interface EditionDefinition {
  id: EditionId;
  name: string;
  description: string;
  digitalProductId: string;
  priceCents: number;
  cardCount: number | null;
  jokerCount: number;
  available: boolean;
  tagline: string;
  benefits: string[];
}

export const EDITIONS: EditionDefinition[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Original Par for the Course edition.",
    digitalProductId: "classic.digital",
    priceCents: 199,
    cardCount: 16,
    jokerCount: 2,
    available: true,
    tagline: "The beginner-friendly foundation that started it all.",
    benefits: [
      "A welcoming entry point for new players and casual rounds.",
      "Balanced layouts make learning the flow of the game easy and fun.",
      "Perfect for quick sessions, warmups, and first-time tournament prep.",
    ],
  },
  {
    id: "reracked",
    name: "Reracked",
    description: "Reracked edition content.",
    digitalProductId: "reracked.digital",
    priceCents: 199,
    cardCount: 16,
    jokerCount: 2,
    available: true,
    tagline: "The next evolution with advanced courses and obstacles.",
    benefits: [
      "Builds on the classic game with sharper, more demanding layouts.",
      "Introduces advanced obstacle patterns that reward precision and planning.",
      "Ideal for players ready to level up from beginner-friendly rounds.",
    ],
  },
  {
    id: "sequential",
    name: "Sequential",
    description: "Sequential edition content.",
    digitalProductId: "sequential.digital",
    priceCents: 199,
    cardCount: 18,
    jokerCount: 0,
    available: true,
    tagline: "The first 9-ball training game designed to sharpen pattern play.",
    benefits: [
      "Practice cue ball control with deliberate, repeatable shot sequences.",
      "Build confidence through targeted pattern play and decision-making drills.",
      "A great tool for players who want to improve stroke rhythm and setup.",
    ],
  },
  {
    id: "teed-off",
    name: "Tee'd Off!",
    description: "Tee'd Off! edition content.",
    digitalProductId: "teed_off.digital",
    priceCents: 199,
    cardCount: 18,
    jokerCount: 0,
    available: true,
    tagline: "The most difficult edition, built for players who love a challenge.",
    benefits: [
      "Unforgiving layouts create tense, high-pressure decision points.",
      "Anger-inducing obstacles force precise shot selection and patience.",
      "Ideal for advanced players chasing a more demanding, skill-based test.",
    ],
  },
  {
    id: "tournament",
    name: "Tournament",
    description: "Tournament edition content.",
    digitalProductId: "tournament.digital",
    priceCents: 199,
    cardCount: 18,
    jokerCount: 0,
    available: true,
    tagline: "The official deck for Par for the Course local tournaments.",
    benefits: [
      "Play the same deck players use in tournament play and local events.",
      "Warm up before a competition or level up your game with tournament-level layouts.",
      "Designed for serious rounds, practice, and repeatable competitive preparation.",
    ],
  },
];

export function getEditionById(editionId: EditionId): EditionDefinition {
  const edition = EDITIONS.find((item) => item.id === editionId);
  if (!edition) {
    throw new Error(`Unknown edition: ${editionId}`);
  }
  return edition;
}

export function formatEditionPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}
