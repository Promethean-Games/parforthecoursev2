import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ArcadeCarouselItem {
  id: string;
  label: string;
  accent: string;
}

interface ArcadeCarouselProps<T extends ArcadeCarouselItem> {
  items: readonly T[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  renderCard: (item: T, state: { isActive: boolean; cardWidth: number }) => ReactNode;
  ariaLabel: string;
  /** Card width as a fraction of card height. */
  aspect?: number;
  /** Optional cap on card height in px, for compact cards. */
  maxCardHeight?: number;
  /** Called when the card body (not an interactive child) is tapped while already active. */
  onActiveCardClick?: (item: T) => void;
  testIdPrefix: string;
}

const SWIPE_START_PX = 8;

export function usePrefersReducedMotion() {
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

/**
 * Horizontal, non-wrapping, snap-to-card carousel. The parent owns `activeIndex`; the drag
 * offset is transient local state and cards derive their pose from `activeIndex - drag / step`.
 * Elements marked `data-no-swipe` do not start a swipe.
 */
export function ArcadeCarousel<T extends ArcadeCarouselItem>({
  items,
  activeIndex,
  onActiveIndexChange,
  renderCard,
  ariaLabel,
  aspect = 0.56,
  maxCardHeight,
  onActiveCardClick,
  testIdPrefix,
}: ArcadeCarouselProps<T>) {
  const lastIndex = items.length - 1;
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

  const cardHeight = Math.min(maxCardHeight ?? Infinity, Math.max(240, size.height - 12));
  const cardWidth = Math.max(130, Math.min(cardHeight * aspect, size.width * 0.6, 320));
  const step = cardWidth * 0.8;

  const goTo = useCallback(
    (index: number) => onActiveIndexChange(Math.min(lastIndex, Math.max(0, index))),
    [lastIndex, onActiveIndexChange],
  );

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

    // Rubber-band resistance when pulling past the first or last card.
    const beyondEdge = (dx > 0 && activeRef.current === 0) || (dx < 0 && activeRef.current === lastIndex);
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

  const position = activeIndex - dragOffset / step;
  const transition =
    isDragging || reducedMotion
      ? "none"
      : "transform 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 340ms ease-out, filter 340ms ease-out, box-shadow 340ms ease-out";

  return (
    <>
      <div
        ref={viewportRef}
        role="group"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishGesture(e, false)}
        onPointerCancel={(e) => finishGesture(e, true)}
        className="relative z-10 min-h-0 flex-1 select-none overflow-hidden outline-none"
        style={{ touchAction: "pan-y", perspective: "1100px", cursor: isDragging ? "grabbing" : "grab" }}
        data-testid={`${testIdPrefix}-carousel`}
      >
        {items.map((item, index) => {
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
            borderColor: item.accent,
            boxShadow: `0 ${6 + closeness * 14}px ${14 + closeness * 22}px rgba(0,0,0,0.65), 0 0 ${closeness * 26}px ${closeness * 4}px ${item.accent}${closeness > 0.5 ? "aa" : "55"}, inset 0 0 ${4 + closeness * 10}px ${item.accent}66`,
            willChange: "transform",
          };
          return (
            <div
              key={item.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${item.label}, ${index + 1} of ${items.length}${isActive ? ", selected" : ""}`}
              className="absolute flex flex-col overflow-hidden rounded-2xl border-[3px] bg-black"
              style={cardStyle}
              onClick={() => {
                if (gesture.current.suppressClick) return;
                if (!isActive) goTo(index);
                else onActiveCardClick?.(item);
              }}
              data-testid={`card-${testIdPrefix}-${item.id}`}
              data-active={isActive}
            >
              {renderCard(item, { isActive, cardWidth })}
            </div>
          );
        })}

        <ArrowButton side="left" disabled={activeIndex === 0} onClick={() => goTo(activeIndex - 1)} testIdPrefix={testIdPrefix} />
        <ArrowButton side="right" disabled={activeIndex === lastIndex} onClick={() => goTo(activeIndex + 1)} testIdPrefix={testIdPrefix} />
      </div>

      <div className="relative z-10 flex items-center justify-center gap-3 pb-1 pt-3" role="tablist" aria-label={`${ariaLabel} pages`}>
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={item.label}
              onClick={() => goTo(index)}
              className="flex h-6 items-center justify-center px-0.5"
              data-testid={`dot-${testIdPrefix}-${item.id}`}
            >
              <span
                className="block h-3 rounded-full border border-white/70"
                style={{
                  width: isActive ? 28 : 12,
                  background: isActive ? item.accent : "rgba(0,0,0,0.55)",
                  boxShadow: isActive ? `0 0 10px ${item.accent}` : "none",
                  transition: reducedMotion ? "none" : "width 250ms ease-out, background 250ms",
                }}
              />
            </button>
          );
        })}
      </div>
    </>
  );
}

function ArrowButton({
  side,
  disabled,
  onClick,
  testIdPrefix,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
  testIdPrefix: string;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous" : "Next"}
      data-no-swipe
      className="absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/60 text-white shadow-lg backdrop-blur-sm transition-opacity active:scale-95"
      style={{ [side]: 4, opacity: disabled ? 0 : 1, pointerEvents: disabled ? "none" : "auto" }}
      data-testid={`button-${testIdPrefix}-carousel-${side === "left" ? "prev" : "next"}`}
    >
      <Icon className="h-7 w-7" />
    </button>
  );
}
