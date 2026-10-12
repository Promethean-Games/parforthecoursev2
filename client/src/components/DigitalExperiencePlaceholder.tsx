import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EditionDefinition } from "@/lib/editions";

interface DigitalExperiencePlaceholderProps {
  edition: EditionDefinition;
  onBack: () => void;
}

interface DigitalCard {
  id: string;
  imageSrc: string;
  label: string;
  par: number | null;
}

const FLIP_DURATION_MS = 550;
const SUPPORTED_DIGITAL_EDITIONS = new Set(["classic", "reracked", "sequential", "tournament"]);

function cardAssetPath(fileName: string): string {
  return `${import.meta.env.BASE_URL}cards/${fileName}`;
}

function createClassicDeck(): DigitalCard[] {
  return [
    { id: "2-01", imageSrc: cardAssetPath("2-01.png"), label: "Par 2", par: 2 },
    { id: "2-02", imageSrc: cardAssetPath("2-02.png"), label: "Par 2", par: 2 },
    { id: "2-03", imageSrc: cardAssetPath("2-03.png"), label: "Par 2", par: 2 },
    { id: "3-01", imageSrc: cardAssetPath("3-01.png"), label: "Par 3", par: 3 },
    { id: "3-02", imageSrc: cardAssetPath("3-02.png"), label: "Par 3", par: 3 },
    { id: "3-03", imageSrc: cardAssetPath("3-03.png"), label: "Par 3", par: 3 },
    { id: "3-04", imageSrc: cardAssetPath("3-04.png"), label: "Par 3", par: 3 },
    { id: "4-01", imageSrc: cardAssetPath("4-01.png"), label: "Par 4", par: 4 },
    { id: "4-02", imageSrc: cardAssetPath("4-02.png"), label: "Par 4", par: 4 },
    { id: "4-03", imageSrc: cardAssetPath("4-03.png"), label: "Par 4", par: 4 },
    { id: "4-04", imageSrc: cardAssetPath("4-04.png"), label: "Par 4", par: 4 },
    { id: "4-05", imageSrc: cardAssetPath("4-05.png"), label: "Par 4", par: 4 },
    { id: "5-01", imageSrc: cardAssetPath("5-01.png"), label: "Par 5", par: 5 },
    { id: "5-02", imageSrc: cardAssetPath("5-02.png"), label: "Par 5", par: 5 },
    { id: "5-03", imageSrc: cardAssetPath("5-03.png"), label: "Par 5", par: 5 },
    { id: "6-01", imageSrc: cardAssetPath("6-01.png"), label: "Par 6", par: 6 },
    { id: "joker-01", imageSrc: cardAssetPath("joker.png"), label: "Joker", par: null },
    { id: "joker-02", imageSrc: cardAssetPath("joker.png"), label: "Joker", par: null },
  ];
}

function createRerackedDeck(): DigitalCard[] {
  return [
    { id: "2-01", imageSrc: cardAssetPath("reracked/2-01.png"), label: "Par 2", par: 2 },
    { id: "3-01", imageSrc: cardAssetPath("reracked/3-01.png"), label: "Par 3", par: 3 },
    { id: "3-02", imageSrc: cardAssetPath("reracked/3-02.png"), label: "Par 3", par: 3 },
    { id: "3-03", imageSrc: cardAssetPath("reracked/3-03.png"), label: "Par 3", par: 3 },
    { id: "4-01", imageSrc: cardAssetPath("reracked/4-01.png"), label: "Par 4", par: 4 },
    { id: "4-02", imageSrc: cardAssetPath("reracked/4-02.png"), label: "Par 4", par: 4 },
    { id: "4-03", imageSrc: cardAssetPath("reracked/4-03.png"), label: "Par 4", par: 4 },
    { id: "4-04", imageSrc: cardAssetPath("reracked/4-04.png"), label: "Par 4", par: 4 },
    { id: "4-05", imageSrc: cardAssetPath("reracked/4-05.png"), label: "Par 4", par: 4 },
    { id: "5-01", imageSrc: cardAssetPath("reracked/5-01.png"), label: "Par 5", par: 5 },
    { id: "5-02", imageSrc: cardAssetPath("reracked/5-02.png"), label: "Par 5", par: 5 },
    { id: "6-01", imageSrc: cardAssetPath("reracked/6-01.png"), label: "Par 6", par: 6 },
    { id: "6-02", imageSrc: cardAssetPath("reracked/6-02.png"), label: "Par 6", par: 6 },
    { id: "6-03", imageSrc: cardAssetPath("reracked/6-03.png"), label: "Par 6", par: 6 },
    { id: "7-01", imageSrc: cardAssetPath("reracked/7-01.png"), label: "Par 7", par: 7 },
    { id: "7-02", imageSrc: cardAssetPath("reracked/7-02.png"), label: "Par 7", par: 7 },
    { id: "joker-01", imageSrc: cardAssetPath("reracked/joker-01.png"), label: "Joker", par: null },
    { id: "joker-02", imageSrc: cardAssetPath("reracked/joker-02.png"), label: "Joker", par: null },
  ];
}

function createSequentialDeck(): DigitalCard[] {
  return [
    { id: "SEQ-C-03_01", imageSrc: cardAssetPath("sequential/SEQ-C-03_01.png"), label: "Par 3", par: 3 },
    { id: "SEQ-C-03_02", imageSrc: cardAssetPath("sequential/SEQ-C-03_02.png"), label: "Par 3", par: 3 },
    { id: "SEQ-C-03_03", imageSrc: cardAssetPath("sequential/SEQ-C-03_03.png"), label: "Par 3", par: 3 },
    { id: "SEQ-C-03_04", imageSrc: cardAssetPath("sequential/SEQ-C-03_04.png"), label: "Par 3", par: 3 },
    { id: "SEQ-C-04_01", imageSrc: cardAssetPath("sequential/SEQ-C-04_01.png"), label: "Par 4", par: 4 },
    { id: "SEQ-C-04_02", imageSrc: cardAssetPath("sequential/SEQ-C-04_02.png"), label: "Par 4", par: 4 },
    { id: "SEQ-C-04_03", imageSrc: cardAssetPath("sequential/SEQ-C-04_03.png"), label: "Par 4", par: 4 },
    { id: "SEQ-C-04_04", imageSrc: cardAssetPath("sequential/SEQ-C-04_04.png"), label: "Par 4", par: 4 },
    { id: "SEQ-C-04_05", imageSrc: cardAssetPath("sequential/SEQ-C-04_05.png"), label: "Par 4", par: 4 },
    { id: "SEQ-C-05_01", imageSrc: cardAssetPath("sequential/SEQ-C-05_01.png"), label: "Par 5", par: 5 },
    { id: "SEQ-C-05_02", imageSrc: cardAssetPath("sequential/SEQ-C-05_02.png"), label: "Par 5", par: 5 },
    { id: "SEQ-C-05_03", imageSrc: cardAssetPath("sequential/SEQ-C-05_03.png"), label: "Par 5", par: 5 },
    { id: "SEQ-C-06_01", imageSrc: cardAssetPath("sequential/SEQ-C-06_01.png"), label: "Par 6", par: 6 },
    { id: "SEQ-C-06_02", imageSrc: cardAssetPath("sequential/SEQ-C-06_02.png"), label: "Par 6", par: 6 },
    { id: "SEQ-C-07_01", imageSrc: cardAssetPath("sequential/SEQ-C-07_01.png"), label: "Par 7", par: 7 },
    { id: "SEQ-C-07_02", imageSrc: cardAssetPath("sequential/SEQ-C-07_02.png"), label: "Par 7", par: 7 },
    { id: "SEQ-C-08_01", imageSrc: cardAssetPath("sequential/SEQ-C-08_01.png"), label: "Par 8", par: 8 },
    { id: "SEQ-C-09_01", imageSrc: cardAssetPath("sequential/SEQ-C-09_01.png"), label: "Par 9", par: 9 },
  ];
}

function createTournamentDeck(): DigitalCard[] {
  return [
    { id: "1-01", imageSrc: cardAssetPath("tournament/1-01.png"), label: "Par 1", par: 1 },
    { id: "2-01", imageSrc: cardAssetPath("tournament/2-01.png"), label: "Par 2", par: 2 },
    { id: "2-02", imageSrc: cardAssetPath("tournament/2-02.png"), label: "Par 2", par: 2 },
    { id: "2-03", imageSrc: cardAssetPath("tournament/2-03.png"), label: "Par 2", par: 2 },
    { id: "2-04", imageSrc: cardAssetPath("tournament/2-04.png"), label: "Par 2", par: 2 },
    { id: "2-05", imageSrc: cardAssetPath("tournament/2-05.png"), label: "Par 2", par: 2 },
    { id: "3-01", imageSrc: cardAssetPath("tournament/3-01.png"), label: "Par 3", par: 3 },
    { id: "3-02", imageSrc: cardAssetPath("tournament/3-02.png"), label: "Par 3", par: 3 },
    { id: "3-03", imageSrc: cardAssetPath("tournament/3-03.png"), label: "Par 3", par: 3 },
    { id: "3-04", imageSrc: cardAssetPath("tournament/3-04.png"), label: "Par 3", par: 3 },
    { id: "3-05", imageSrc: cardAssetPath("tournament/3-05.png"), label: "Par 3", par: 3 },
    { id: "3-06", imageSrc: cardAssetPath("tournament/3-06.png"), label: "Par 3", par: 3 },
    { id: "3-07", imageSrc: cardAssetPath("tournament/3-07.png"), label: "Par 3", par: 3 },
    { id: "3-08", imageSrc: cardAssetPath("tournament/3-08.png"), label: "Par 3", par: 3 },
    { id: "3-09", imageSrc: cardAssetPath("tournament/3-09.png"), label: "Par 3", par: 3 },
    { id: "3-10", imageSrc: cardAssetPath("tournament/3-10.png"), label: "Par 3", par: 3 },
    { id: "4-01", imageSrc: cardAssetPath("tournament/4-01.png"), label: "Par 4", par: 4 },
    { id: "4-02", imageSrc: cardAssetPath("tournament/4-02.png"), label: "Par 4", par: 4 },
  ];
}

function createDeckForEdition(editionId: EditionDefinition["id"]): DigitalCard[] {
  switch (editionId) {
    case "tournament":
      return createTournamentDeck();
    case "sequential":
      return createSequentialDeck();
    case "reracked":
      return createRerackedDeck();
    case "classic":
    default:
      return createClassicDeck();
  }
}

function shuffleDeck(cards: DigitalCard[]): DigitalCard[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function DigitalExperiencePlaceholder({ edition, onBack }: DigitalExperiencePlaceholderProps) {
  const supportedDigitalEdition = SUPPORTED_DIGITAL_EDITIONS.has(edition.id);
  const cardBackSrc = useMemo(() => cardAssetPath("back.png"), []);
  const fullDeck = useMemo(() => createDeckForEdition(edition.id), [edition.id]);
  const [drawPile, setDrawPile] = useState<DigitalCard[]>(() => shuffleDeck(fullDeck));
  const [currentCard, setCurrentCard] = useState<DigitalCard | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isFaceVisible, setIsFaceVisible] = useState(false);

  const handleDrawCard = () => {
    if (isFlipping || !supportedDigitalEdition) return;
    const [nextCard, ...remainingCards] = drawPile;
    if (!nextCard) return;

    setIsFaceVisible(false);
    setIsFlipping(true);

    window.setTimeout(() => {
      setCurrentCard(nextCard);
      setDrawPile(remainingCards);
      setIsFaceVisible(true);
      setIsFlipping(false);
    }, FLIP_DURATION_MS / 2);
  };

  const cardsRemaining = drawPile.length;

  if (!supportedDigitalEdition) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 space-y-4 text-center">
          <h1 className="text-2xl font-bold">{edition.name} Digital</h1>
          <p className="text-muted-foreground">
            This edition&apos;s digital deck will be restored after its card set is uploaded.
          </p>
          <Button onClick={onBack} data-testid="button-digital-placeholder-back">
            Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-6 space-y-4 text-center">
        <h1 className="text-2xl font-bold">{edition.name} Digital Deck</h1>
        <div className="w-full flex justify-center py-3">
          <button
            type="button"
            onClick={handleDrawCard}
            disabled={isFlipping || cardsRemaining === 0}
            className="relative h-[320px] w-[214px] rounded-xl"
            style={{ perspective: "1000px" }}
            aria-label="Tap card back to draw"
            data-testid="button-digital-card-draw"
          >
            <div
              className="relative h-full w-full"
              style={{
                transformStyle: "preserve-3d",
                transition: `transform ${FLIP_DURATION_MS}ms ease-in-out`,
                transform: isFaceVisible ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              <img
                src={cardBackSrc}
                alt="Card back"
                className="absolute h-full w-full rounded-xl object-cover shadow-lg"
                style={{ backfaceVisibility: "hidden" }}
                data-testid="img-digital-card-back"
              />
              <img
                src={currentCard?.imageSrc || cardBackSrc}
                alt={currentCard ? `Drawn card ${currentCard.label}` : "Card face"}
                className="absolute h-full w-full rounded-xl object-cover shadow-lg"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
                data-testid="img-digital-card-face"
              />
            </div>
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-base font-semibold" data-testid="text-digital-card-result">
            {currentCard
              ? (currentCard.par === null ? "JOKER! Create your own hole." : currentCard.label)
              : "Tap the card back to draw."}
          </p>
          <p className="text-sm text-muted-foreground" data-testid="text-digital-cards-remaining">
            {cardsRemaining > 0
              ? `${cardsRemaining} cards remaining`
              : "Deck complete - all 18 cards have been shown once."}
          </p>
        </div>

        <Button variant="ghost" onClick={onBack} data-testid="button-digital-placeholder-back">
          Back
        </Button>
      </Card>
    </div>
  );
}
