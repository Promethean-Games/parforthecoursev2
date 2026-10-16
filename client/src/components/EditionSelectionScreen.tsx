import { useMemo, useState } from "react";
import { EDITIONS, type EditionDefinition } from "@/lib/editions";
import { EDITION_THEMES } from "@/lib/edition-theme";
import { ArcadeCarousel } from "@/components/arcade/ArcadeCarousel";
import { SceneBackdrop } from "@/components/arcade/SceneBackdrop";

interface EditionSelectionScreenProps {
  onSelectEdition: (edition: EditionDefinition) => void;
  onBack: () => void;
  onViewRules?: (editionId: EditionDefinition["id"]) => void;
}

export function EditionSelectionScreen({ onSelectEdition, onBack, onViewRules }: EditionSelectionScreenProps) {
  // Single source of truth for the carousel; the dots, arrows and cards all derive from it.
  const [activeIndex, setActiveIndex] = useState(0);
  const items = useMemo(
    () => EDITIONS.map((edition) => ({ id: edition.id, label: `${edition.name} edition`, accent: EDITION_THEMES[edition.id].accent, edition })),
    [],
  );
  const activeTheme = EDITION_THEMES[EDITIONS[activeIndex].id];

  return (
    <div
      className="relative flex min-h-[560px] w-full flex-col overflow-hidden text-white"
      style={{ height: "100dvh", background: "#120b22" }}
      data-testid="edition-selection-screen"
    >
      <SceneBackdrop />

      <h1
        className="arcade-title relative z-10 px-4 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] text-center text-[1.65rem] leading-none sm:text-4xl"
      >
        Select Your Edition
      </h1>

      <ArcadeCarousel
        items={items}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        ariaLabel="Editions"
        testIdPrefix="edition"
        renderCard={({ edition }, { isActive, cardWidth }) => {
          const theme = EDITION_THEMES[edition.id];
          return (
            <>
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
                    else setActiveIndex(EDITIONS.findIndex((item) => item.id === edition.id));
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
            </>
          );
        }}
      />

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
