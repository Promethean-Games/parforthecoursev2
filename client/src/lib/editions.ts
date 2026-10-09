export type EditionId = "classic" | "reracked" | "sequential" | "teed-off" | "tournament";

export interface EditionDefinition {
  id: EditionId;
  name: string;
  description: string;
  digitalProductId: string;
  priceCents: number;
  cardCount: number | null;
  available: boolean;
}

export const EDITIONS: EditionDefinition[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Original Par for the Course edition.",
    digitalProductId: "classic.digital",
    priceCents: 199,
    cardCount: null,
    available: true,
  },
  {
    id: "reracked",
    name: "Reracked",
    description: "Reracked edition content.",
    digitalProductId: "reracked.digital",
    priceCents: 199,
    cardCount: null,
    available: true,
  },
  {
    id: "sequential",
    name: "Sequential",
    description: "Sequential edition content.",
    digitalProductId: "sequential.digital",
    priceCents: 199,
    cardCount: null,
    available: true,
  },
  {
    id: "teed-off",
    name: "Tee'd Off!",
    description: "Tee'd Off! edition content.",
    digitalProductId: "teed_off.digital",
    priceCents: 199,
    cardCount: null,
    available: true,
  },
  {
    id: "tournament",
    name: "Tournament",
    description: "Tournament edition content.",
    digitalProductId: "tournament.digital",
    priceCents: 199,
    cardCount: null,
    available: true,
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
