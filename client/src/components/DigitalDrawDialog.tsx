import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAR_OPTIONS } from "@/lib/constants";

interface DigitalCard {
  id: string;
  imageSrc: string;
  label: string;
  par: number | null;
}

interface DigitalDrawDialogProps {
  cards: DigitalCard[];
  playerName?: string;
  onReady: (card: DigitalCard, jokerPar?: number) => void;
}

interface CardMotionState {
  dragOffset: number;
  isDragging: boolean;
  isPulling: boolean;
  isRevealed: boolean;
}

const MAX_VISIBLE_CARDS = 5;
const FLIP_DURATION_MS = 650;
const DRAW_DRAG_THRESHOLD = 90;
const CARD_WIDTH_PX = 180;
const CARD_HEIGHT_PX = 270;

function getDefaultCardState(): CardMotionState {
  return {
    dragOffset: 0,
    isDragging: false,
    isPulling: false,
    isRevealed: false,
  };
}

function cardAssetPath(fileName: string): string {
  return `${import.meta.env.BASE_URL}cards/${fileName}`;
}

export function DigitalDrawDialog({ cards, playerName = "Player", onReady }: DigitalDrawDialogProps) {
  const cardBackSrc = useMemo(() => cardAssetPath("back.png"), []);
  const [jokerPar, setJokerPar] = useState<number | null>(null);
  const [cardMotionState, setCardMotionState] = useState<Record<string, CardMotionState>>({});
  const dragStartRef = useRef<Record<string, number | null>>({});
  const visibleCards = useMemo(() => cards.slice(0, Math.min(cards.length, MAX_VISIBLE_CARDS)), [cards]);
  const revealedCard = useMemo(
    () => visibleCards.find((card) => cardMotionState[card.id]?.isRevealed) ?? null,
    [visibleCards, cardMotionState],
  );
  const deckLocked = revealedCard !== null;

  useEffect(() => {
    setJokerPar(null);
    setCardMotionState({});
  }, [visibleCards.map((card) => card.id).join("-")]);

  const updateCardState = (cardId: string, changes: Partial<CardMotionState>) => {
    setCardMotionState((previous) => ({
      ...previous,
      [cardId]: {
        ...getDefaultCardState(),
        ...previous[cardId],
        ...changes,
      },
    }));
  };

  const revealCard = (cardId: string) => {
    const currentState = cardMotionState[cardId] ?? getDefaultCardState();
    if (currentState.isRevealed || currentState.isPulling || deckLocked) return;
    updateCardState(cardId, { isPulling: true, isDragging: false });
    window.setTimeout(() => {
      updateCardState(cardId, { isPulling: false, isRevealed: true });
    }, 220);
  };

  const handlePointerDown = (cardId: string, event: React.PointerEvent<HTMLButtonElement>) => {
    const currentState = cardMotionState[cardId] ?? getDefaultCardState();
    if (currentState.isRevealed || currentState.isPulling || deckLocked) return;
    dragStartRef.current[cardId] = event.clientY;
    updateCardState(cardId, { isDragging: true });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (cardId: string, event: React.PointerEvent<HTMLButtonElement>) => {
    const currentState = cardMotionState[cardId] ?? getDefaultCardState();
    if (!currentState.isDragging || dragStartRef.current[cardId] === null || dragStartRef.current[cardId] === undefined) return;
    const delta = event.clientY - dragStartRef.current[cardId]!;
    updateCardState(cardId, { dragOffset: Math.max(0, delta) });
  };

  const handlePointerUp = (cardId: string, event: React.PointerEvent<HTMLButtonElement>) => {
    const currentState = cardMotionState[cardId] ?? getDefaultCardState();
    if (currentState.isRevealed || currentState.isPulling) return;
    const shouldDraw = currentState.dragOffset > DRAW_DRAG_THRESHOLD;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStartRef.current[cardId] = null;
    updateCardState(cardId, { isDragging: false });

    if (shouldDraw) {
      revealCard(cardId);
      return;
    }

    updateCardState(cardId, { dragOffset: 0 });
  };

  const handleReady = () => {
    if (!revealedCard) return;
    if (revealedCard.par === null && jokerPar === null) return;
    onReady(revealedCard, revealedCard.par === null ? jokerPar ?? undefined : undefined);
  };

  const titleText = `${playerName} Draw A Card!`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-3 flex justify-center">
          <svg viewBox="0 0 360 90" className="h-[82px] w-full max-w-[360px] drop-shadow-[0_0_14px_rgba(255,214,80,0.8)]" style={{ animation: "titlePulse 2.2s ease-in-out infinite" }}>
            <defs>
              <path id="draw-title-arc" d="M 30 65 A 150 150 0 0 1 330 65" fill="none" />
            </defs>
            <text fontSize="33" fontWeight="800" fill="#f7df67" letterSpacing="0.5" fontFamily="sans-serif">
              <textPath href="#draw-title-arc" startOffset="50%" textAnchor="middle">
                {titleText}
              </textPath>
            </text>
          </svg>
        </div>

        <p className="mb-4 text-sm text-muted-foreground" data-testid="text-digital-draw-instructions">
          Tap the card and drag down to draw it.
        </p>

        <div className="mb-5 flex justify-center">
          <div className="relative h-[380px] w-[320px] select-none" style={{ perspective: "1100px" }}>
            {visibleCards.map((card, index) => {
              const cardState = cardMotionState[card.id] ?? getDefaultCardState();
              const relativeIndex = index - (visibleCards.length - 1) / 2;
              const baseX = relativeIndex * 38;
              const baseY = Math.abs(relativeIndex) * 18 + index * 2;
              const baseRotate = relativeIndex * 9;
              const baseScale = 1 - Math.abs(relativeIndex) * 0.03;
              const totalDragOffset = cardState.dragOffset;
              const transform = cardState.isPulling
                ? `translate(${baseX}px, ${baseY + 170}px) rotate(${baseRotate}deg) scale(1.08)`
                : `translate(${baseX}px, ${baseY + totalDragOffset}px) rotate(${baseRotate + totalDragOffset * 0.05}deg) scale(${baseScale + totalDragOffset / 1000})`;

              return (
                <button
                  key={card.id}
                  type="button"
                  onPointerDown={(event) => handlePointerDown(card.id, event)}
                  onPointerMove={(event) => handlePointerMove(card.id, event)}
                  onPointerUp={(event) => handlePointerUp(card.id, event)}
                  onPointerLeave={() => {
                    const current = cardMotionState[card.id];
                    if (current?.isDragging) {
                      updateCardState(card.id, { isDragging: false, dragOffset: 0 });
                    }
                  }}
                  onPointerCancel={() => {
                    updateCardState(card.id, { isDragging: false, dragOffset: 0 });
                    dragStartRef.current[card.id] = null;
                  }}
                  disabled={cardState.isRevealed || deckLocked}
                  className="absolute left-1/2 top-[24px] rounded-xl bg-transparent disabled:cursor-default"
                  style={{
                    perspective: "1100px",
                    height: `${CARD_HEIGHT_PX}px`,
                    width: `${CARD_WIDTH_PX}px`,
                    marginLeft: `${-CARD_WIDTH_PX / 2}px`,
                    zIndex: cardState.isDragging || cardState.isPulling || cardState.isRevealed ? 30 : 10 + index,
                    transform,
                    transition: cardState.isDragging ? "none" : `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                    touchAction: "none",
                    filter: cardState.isRevealed ? "drop-shadow(0 24px 30px rgba(0,0,0,0.45))" : "drop-shadow(0 18px 35px rgba(0,0,0,0.28))",
                  }}
                  aria-label={`Draw ${card.label}`}
                  data-testid={`button-digital-draw-card-${card.id}`}
                >
                  <div
                    className="relative h-full w-full"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: cardState.isRevealed ? "rotateY(180deg)" : "rotateY(0deg)",
                      transition: `transform ${FLIP_DURATION_MS}ms ease-in-out`,
                    }}
                  >
                    <img
                      src={cardBackSrc}
                      alt="Card back"
                      className="absolute inset-0 h-full w-full rounded-xl object-cover shadow-[0_18px_35px_rgba(0,0,0,0.35)]"
                      style={{ backfaceVisibility: "hidden" }}
                    />
                    <img
                      src={card.imageSrc}
                      alt={card.label}
                      className="absolute inset-0 h-full w-full rounded-xl object-cover shadow-[0_18px_35px_rgba(0,0,0,0.35)]"
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <p className="mb-4 text-base font-semibold" data-testid="text-digital-draw-card-label">
          {revealedCard
            ? revealedCard.par === null
              ? "JOKER! Create your own hole."
              : revealedCard.label
            : ""}
        </p>

        {revealedCard?.par === null && (
          <div className="mb-4 space-y-2 text-left">
            <label htmlFor="digital-joker-par" className="text-base font-semibold text-foreground">
              Choose a par for this custom hole (1-15)
            </label>
            <Select value={jokerPar?.toString() ?? ""} onValueChange={(value) => setJokerPar(parseInt(value, 10))}>
              <SelectTrigger className="h-14 w-full text-lg" id="digital-joker-par" data-testid="select-digital-joker-par">
                <SelectValue placeholder="Select par" />
              </SelectTrigger>
              <SelectContent>
                {PAR_OPTIONS.map((par) => (
                  <SelectItem key={par} value={par.toString()}>
                    Par {par}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          onClick={handleReady}
          disabled={!revealedCard || (revealedCard.par === null && jokerPar === null)}
          className="w-full min-h-24 text-4xl font-bold tracking-wide"
          data-testid="button-digital-draw-ready"
        >
          Ready!
        </Button>
      </div>
    </div>
  );
}
