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

const CARD_BACK_SRC = "/cards/back.png";
const FLIP_DURATION_MS = 550;

function createClassicDeck(): DigitalCard[] {
  return [
    { id: "2-01", imageSrc: "/cards/2-01.png", label: "Par 2", par: 2 },
    { id: "2-02", imageSrc: "/cards/2-02.png", label: "Par 2", par: 2 },
    { id: "2-03", imageSrc: "/cards/2-03.png", label: "Par 2", par: 2 },
    { id: "3-01", imageSrc: "/cards/3-01.png", label: "Par 3", par: 3 },
    { id: "3-02", imageSrc: "/cards/3-02.png", label: "Par 3", par: 3 },
    { id: "3-03", imageSrc: "/cards/3-03.png", label: "Par 3", par: 3 },
    { id: "3-04", imageSrc: "/cards/3-04.png", label: "Par 3", par: 3 },
    { id: "4-01", imageSrc: "/cards/4-01.png", label: "Par 4", par: 4 },
    { id: "4-02", imageSrc: "/cards/4-02.png", label: "Par 4", par: 4 },
    { id: "4-03", imageSrc: "/cards/4-03.png", label: "Par 4", par: 4 },
    { id: "4-04", imageSrc: "/cards/4-04.png", label: "Par 4", par: 4 },
    { id: "4-05", imageSrc: "/cards/4-05.png", label: "Par 4", par: 4 },
    { id: "5-01", imageSrc: "/cards/5-01.png", label: "Par 5", par: 5 },
    { id: "5-02", imageSrc: "/cards/5-02.png", label: "Par 5", par: 5 },
    { id: "5-03", imageSrc: "/cards/5-03.png", label: "Par 5", par: 5 },
    { id: "6-01", imageSrc: "/cards/6-01.png", label: "Par 6", par: 6 },
    { id: "joker-01", imageSrc: "/cards/joker.png", label: "Joker", par: null },
    { id: "joker-02", imageSrc: "/cards/joker.png", label: "Joker", par: null },
  ];
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
  const classicOnly = edition.id === "classic";
  const fullDeck = useMemo(() => createClassicDeck(), []);
  const [drawPile, setDrawPile] = useState<DigitalCard[]>(() => shuffleDeck(fullDeck));
  const [currentCard, setCurrentCard] = useState<DigitalCard | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isFaceVisible, setIsFaceVisible] = useState(false);

  const handleDrawCard = () => {
    if (isFlipping || !classicOnly) return;

    let activePile = drawPile;
    if (activePile.length === 0) {
      activePile = shuffleDeck(fullDeck);
      setDrawPile(activePile);
    }

    const [nextCard, ...remainingCards] = activePile;
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

  const handleReshuffle = () => {
    if (isFlipping || !classicOnly) return;
    setDrawPile(shuffleDeck(fullDeck));
    setCurrentCard(null);
    setIsFaceVisible(false);
  };

  const cardsRemaining = drawPile.length;

  if (!classicOnly) {
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
        <h1 className="text-2xl font-bold">Classic Digital Deck</h1>
        <p className="text-muted-foreground">16 course cards + 2 Jokers, shuffled each time.</p>

        <div className="w-full flex justify-center py-3">
          <div
            className="relative h-[320px] w-[214px]"
            style={{
              perspective: "1000px",
            }}
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
                src={CARD_BACK_SRC}
                alt="Card back"
                className="absolute h-full w-full rounded-xl object-cover shadow-lg"
                style={{ backfaceVisibility: "hidden" }}
                data-testid="img-digital-card-back"
              />
              <img
                src={currentCard?.imageSrc || CARD_BACK_SRC}
                alt={currentCard ? `Drawn card ${currentCard.label}` : "Card face"}
                className="absolute h-full w-full rounded-xl object-cover shadow-lg"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
                data-testid="img-digital-card-face"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-base font-semibold" data-testid="text-digital-card-result">
            {currentCard ? (currentCard.par === null ? "JOKER! Create your own hole." : currentCard.label) : "Tap Draw Card to flip."}
          </p>
          <p className="text-sm text-muted-foreground" data-testid="text-digital-cards-remaining">
            {cardsRemaining} cards remaining in this shuffle
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button onClick={handleDrawCard} disabled={isFlipping} data-testid="button-digital-draw">
            {isFlipping ? "Drawing..." : "Draw Card"}
          </Button>
          <Button variant="outline" onClick={handleReshuffle} disabled={isFlipping} data-testid="button-digital-reshuffle">
            Reshuffle
          </Button>
        </div>

        <Button variant="ghost" onClick={onBack} data-testid="button-digital-placeholder-back">
          Back
        </Button>
      </Card>
    </div>
  );
}
