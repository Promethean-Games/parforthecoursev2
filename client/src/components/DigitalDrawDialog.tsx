import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface DigitalDrawDialogProps {
  card: {
    imageSrc: string;
    label: string;
    par: number | null;
  } | null;
  onReady: () => void;
}

const FLIP_DURATION_MS = 550;

function cardAssetPath(fileName: string): string {
  return `${import.meta.env.BASE_URL}cards/${fileName}`;
}

export function DigitalDrawDialog({ card, onReady }: DigitalDrawDialogProps) {
  const cardBackSrc = useMemo(() => cardAssetPath("back.png"), []);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setIsRevealed(false);
  }, [card?.imageSrc]);

  const revealCard = () => {
    if (!card || isRevealed) return;
    setIsRevealed(true);
  };

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-5">
        <h1 className="text-2xl font-bold">Draw Card</h1>

        <div className="w-full flex justify-center">
          <button
            type="button"
            onClick={revealCard}
            disabled={!card || isRevealed}
            className="relative h-[320px] w-[214px] rounded-xl"
            style={{ perspective: "1000px" }}
            aria-label="Tap card back to reveal card"
            data-testid="button-digital-draw-reveal"
          >
            <div
              className="relative h-full w-full"
              style={{
                transformStyle: "preserve-3d",
                transition: `transform ${FLIP_DURATION_MS}ms ease-in-out`,
                transform: isRevealed ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              <img
                src={cardBackSrc}
                alt="Card back"
                className="absolute h-full w-full rounded-xl object-cover shadow-lg"
                style={{ backfaceVisibility: "hidden" }}
                data-testid="img-digital-draw-back"
              />
              <img
                src={card?.imageSrc ?? cardBackSrc}
                alt={card ? `Drawn card ${card.label}` : "Card face"}
                className="absolute h-full w-full rounded-xl object-cover shadow-lg"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
                data-testid="img-digital-draw-face"
              />
            </div>
          </button>
        </div>

        <p className="text-sm text-muted-foreground" data-testid="text-digital-draw-instructions">
          {!isRevealed
            ? "Tap the card back to reveal your course."
            : "Set up the table to match this course using solids/stripes, then tap Ready."}
        </p>

        <p className="text-base font-semibold" data-testid="text-digital-draw-card-label">
          {!isRevealed
            ? ""
            : card?.par === null
              ? "JOKER! Create your own hole."
              : card?.label}
        </p>

        <Button onClick={onReady} disabled={!isRevealed || !card} data-testid="button-digital-draw-ready">
          Ready!
        </Button>
      </div>
    </div>
  );
}
