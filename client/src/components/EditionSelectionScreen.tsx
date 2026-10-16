import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EDITIONS, type EditionDefinition, type EditionId } from "@/lib/editions";
import backgroundArt from "@assets/editions/background.jpg";
import classicArt from "@assets/editions/classic.jpg";
import rerackedArt from "@assets/editions/reracked.jpg";
import sequentialArt from "@assets/editions/sequential.jpg";
import tournamentArt from "@assets/editions/tournament.jpg";
import teedOffArt from "@assets/editions/teed-off.jpg";

interface EditionTheme {
  art: string;
  accent: string;
  headerFrom: string;
  headerTo: string;
  buttonText: string;
}

const EDITION_THEMES: Record<EditionId, EditionTheme> = {
  classic: { art: classicArt, accent: "#22ff4d", headerFrom: "#0c5a22", headerTo: "#052a10", buttonText: "#04210c" },
  reracked: { art: rerackedArt, accent: "#33a1ff", headerFrom: "#0f3f86", headerTo: "#061a40", buttonText: "#031636" },
  sequential: { art: sequentialArt, accent: "#ffc02e", headerFrom: "#7a4a07", headerTo: "#3a2203", buttonText: "#2b1800" },
  tournament: { art: tournamentArt, accent: "#ff3b3b", headerFrom: "#7d0e12", headerTo: "#3a0508", buttonText: "#ffffff" },
  "teed-off": { art: teedOffArt, accent: "#d5dbe6", headerFrom: "#3b4150", headerTo: "#14171e", buttonText: "#0e1117" },
};

const LAST_INDEX = EDITIONS.length - 1;
const SWIPE_START_PX = 8;
const clampIndex = (value: number) => Math.min(LAST_INDEX, Math.max(0, value));

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

interface EditionSelectionScreenProps {
  onSelectEdition: (edition: EditionDefinition) => void;
  onBack: () => void;
  onViewRules?: (editionId: EditionDefinition["id"]) => void;
}

export function EditionSelectionScreen({ onSelectEdition, onBack, onViewRules }: EditionSelectionScreenProps) {
  // Single source of truth for the carousel; the dots, arrows and cards all derive from it.
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [size, setSize] = useState({ width: 360, height: 520 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const gesture = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0,
    swiping: false,
    cancelled: false,
    suppressClick: false,
  });
  const activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const cardHeight = Math.max(240, size.height - 12);
  const cardWidth = Math.max(130, Math.min(cardHeight * 0.56, size.width * 0.6, 320));
  const step = cardWidth * 0.8;

  const goTo = useCallback((index: number) => setActiveIndex(clampIndex(index)), []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const g = gesture.current;
    g.pointerId = event.pointerId;
    g.startX = g.lastX = event.clientX;
    g.startY = event.clientY;
    g.lastT = event.timeStamp;
    g.velocity = 0;
    g.swiping = false;
    g.cancelled = (event.target as HTMLElement).closest("[data-no-swipe]") !== null;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (event.pointerId !== g.pointerId || g.cancelled) return;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (!g.swiping) {
      if (Math.abs(dx) < SWIPE_START_PX) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        g.cancelled = true;
        return;
      }
      g.swiping = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const dt = Math.max(1, event.timeStamp - g.lastT);
    g.velocity = (event.clientX - g.lastX) / dt;
    g.lastX = event.clientX;
    g.lastT = event.timeStamp;

    // Rubber-band resistance when pulling past the first or last edition.
    const beyondEdge = (dx > 0 && activeRef.current === 0) || (dx < 0 && activeRef.current === LAST_INDEX);
    setDragOffset(beyondEdge ? dx * 0.3 : dx);
  };

  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (event.pointerId !== g.pointerId) return;
    g.pointerId = -1;
    if (!g.swiping) return;
    g.swiping = false;
    g.suppressClick = true;
    window.setTimeout(() => {
      g.suppressClick = false;
    }, 0);
    const dx = event.clientX - g.startX;
    const projected = dx + g.velocity * 120;
    let next = activeRef.current;
    if (!cancelled) {
      if (projected < -step * 0.28) next += 1;
      else if (projected > step * 0.28) next -= 1;
    }
    setIsDragging(false);
    setDragOffset(0);
    goTo(next);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(activeIndex + 1);
    }
  };

  const activeTheme = EDITION_THEMES[EDITIONS[activeIndex].id];
  const position = activeIndex - dragOffset / step;
  const transition =
    isDragging || reducedMotion
      ? "none"
      : "transform 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 340ms ease-out, filter 340ms ease-out, box-shadow 340ms ease-out";

  return (
    <div
      className="relative flex min-h-[560px] w-full flex-col overflow-hidden text-white"
      style={{ height: "100dvh", background: "#120b22" }}
      data-testid="edition-selection-screen"
    >
      <SceneBackdrop />

      <h1
        className="relative z-10 px-4 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] text-center text-[1.65rem] font-black uppercase leading-none tracking-[0.12em] sm:text-4xl"
        style={{ textShadow: "0 2px 0 #000, 0 0 18px rgba(255,170,60,0.55), 0 0 2px #fff" }}
      >
        Select Your Edition
      </h1>

      <div
        ref={viewportRef}
        role="group"
        aria-roledescription="carousel"
        aria-label="Editions"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishGesture(e, false)}
        onPointerCancel={(e) => finishGesture(e, true)}
        className="relative z-10 min-h-0 flex-1 select-none overflow-hidden outline-none"
        style={{ touchAction: "pan-y", perspective: "1100px", cursor: isDragging ? "grabbing" : "grab" }}
        data-testid="edition-carousel"
      >
        {EDITIONS.map((edition, index) => {
          const theme = EDITION_THEMES[edition.id];
          const distance = index - position;
          const abs = Math.abs(distance);
          const clamped = Math.max(-2.2, Math.min(2.2, distance));
          const isActive = index === activeIndex;
          const closeness = Math.max(0, 1 - Math.min(abs, 1));
          const scale = Math.max(0.6, 1 - 0.17 * Math.min(abs, 2.2));
          const rotate = -clamped * 26;
          const x =
            Math.sign(distance) * Math.min(abs, 1) * step + (abs > 1 ? Math.sign(distance) * (abs - 1) * step * 0.7 : 0);
          const cardStyle: CSSProperties = {
            width: cardWidth,
            height: cardHeight,
            left: "50%",
            top: "50%",
            marginLeft: -cardWidth / 2,
            marginTop: -cardHeight / 2,
            transform: `translate3d(${x}px, 0, ${-abs * 60}px) rotateY(${rotate}deg) scale(${scale})`,
            opacity: Math.max(0.35, 1 - abs * 0.3),
            filter: `brightness(${(0.45 + 0.55 * closeness).toFixed(2)})`,
            zIndex: 10 - Math.round(abs * 2),
            transition,
            borderColor: theme.accent,
            boxShadow: `0 ${6 + closeness * 14}px ${14 + closeness * 22}px rgba(0,0,0,0.65), 0 0 ${closeness * 26}px ${closeness * 4}px ${theme.accent}${closeness > 0.5 ? "aa" : "55"}, inset 0 0 ${4 + closeness * 10}px ${theme.accent}66`,
            willChange: "transform",
          };
          return (
            <div
              key={edition.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${edition.name}, ${index + 1} of ${EDITIONS.length}${isActive ? ", selected" : ""}`}
              className="absolute flex flex-col overflow-hidden rounded-2xl border-[3px] bg-black"
              style={cardStyle}
              onClick={() => {
                if (gesture.current.suppressClick) return;
                if (!isActive) goTo(index);
              }}
              data-testid={`card-edition-${edition.id}`}
              data-active={isActive}
            >
              <div
                className="flex shrink-0 items-center justify-center px-2 py-2.5"
                style={{
                  background: `linear-gradient(180deg, ${theme.headerFrom}, ${theme.headerTo})`,
                  borderBottom: `2px solid ${theme.accent}`,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                }}
              >
                <span
                  className="truncate text-center font-black uppercase leading-none tracking-wide"
                  style={{ fontSize: Math.max(15, Math.min(26, cardWidth * 0.095)), textShadow: "0 2px 3px #000" }}
                >
                  {edition.name}
                </span>
              </div>

              <div className="relative min-h-0 flex-1">
                <img
                  src={theme.art}
                  alt=""
                  draggable={false}
                  loading={Math.abs(index - activeIndex) <= 1 ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/50" />
              </div>

              <div
                className="flex shrink-0 flex-col gap-1.5 p-2"
                style={{ background: `linear-gradient(180deg, ${theme.headerTo}, #000)`, borderTop: `2px solid ${theme.accent}` }}
                data-no-swipe
              >
                <button
                  type="button"
                  className="h-10 rounded-lg text-sm font-extrabold uppercase tracking-wider shadow-md active:scale-95"
                  style={{ background: `linear-gradient(180deg, #fff8, ${theme.accent} 45%)`, color: theme.buttonText }}
                  tabIndex={isActive ? 0 : -1}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isActive) onSelectEdition(edition);
                    else goTo(index);
                  }}
                  aria-label={isActive ? `Select ${edition.name} edition` : `Show ${edition.name} edition`}
                  data-testid={`button-edition-${edition.id}`}
                >
                  Select
                </button>
                {onViewRules && (
                  <button
                    type="button"
                    className="h-10 rounded-lg border-2 bg-black/50 text-sm font-bold uppercase tracking-wider text-white active:scale-95"
                    style={{ borderColor: theme.accent }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onViewRules(edition.id);
                    }}
                    aria-label={`${edition.name} rules`}
                    data-testid={`button-rules-${edition.id}`}
                  >
                    Rules
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <ArrowButton side="left" disabled={activeIndex === 0} onClick={() => goTo(activeIndex - 1)} />
        <ArrowButton side="right" disabled={activeIndex === LAST_INDEX} onClick={() => goTo(activeIndex + 1)} />
      </div>

      <div className="relative z-10 flex items-center justify-center gap-3 pb-1 pt-3" role="tablist" aria-label="Edition pages">
        {EDITIONS.map((edition, index) => {
          const isActive = index === activeIndex;
          const accent = EDITION_THEMES[edition.id].accent;
          return (
            <button
              key={edition.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`${edition.name} edition`}
              onClick={() => goTo(index)}
              className="flex h-6 items-center justify-center px-0.5"
              data-testid={`dot-edition-${edition.id}`}
            >
              <span
                className="block h-3 rounded-full border border-white/70"
                style={{
                  width: isActive ? 28 : 12,
                  background: isActive ? accent : "rgba(0,0,0,0.55)",
                  boxShadow: isActive ? `0 0 10px ${accent}` : "none",
                  transition: reducedMotion ? "none" : "width 250ms ease-out, background 250ms",
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="relative z-10 px-6 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))] pt-3">
        <button
          type="button"
          onClick={onBack}
          className="mx-auto block h-12 w-full max-w-xs rounded-xl border-2 text-base font-extrabold uppercase tracking-widest shadow-lg active:scale-95"
          style={{
            borderColor: activeTheme.accent,
            background: "linear-gradient(180deg, rgba(40,40,40,0.95), rgba(0,0,0,0.95))",
            boxShadow: `0 0 14px ${activeTheme.accent}66, inset 0 1px 0 rgba(255,255,255,0.25)`,
          }}
          data-testid="button-edition-back"
        >
          Back
        </button>
      </div>
    </div>
  );
}

function ArrowButton({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous edition" : "Next edition"}
      data-no-swipe
      className="absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/60 text-white shadow-lg backdrop-blur-sm transition-opacity active:scale-95"
      style={{ [side]: 4, opacity: disabled ? 0 : 1, pointerEvents: disabled ? "none" : "auto" }}
      data-testid={`button-carousel-${side === "left" ? "prev" : "next"}`}
    >
      <Icon className="h-7 w-7" />
    </button>
  );
}

// Static scenery: stays fixed while cards move so only the carousel animates.
function SceneBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <img
        src={backgroundArt}
        alt=""
        draggable={false}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "50% 100%" }}
      />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
    </div>
  );
}