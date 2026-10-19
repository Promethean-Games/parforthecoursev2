import { Button } from "@/components/ui/button";
import type { EditionDefinition } from "@/lib/editions";
import { EDITION_THEMES } from "@/lib/edition-theme";
import type { PlayMode } from "@/lib/play-mode";
import { SceneBackdrop } from "@/components/arcade/SceneBackdrop";

interface PlayModeSelectionScreenProps {
  edition: EditionDefinition;
  onSelectMode: (mode: PlayMode) => void;
  busy?: boolean;
  onBack: () => void;
}

const MODES: { mode: PlayMode; label: string; description: string; testId: string }[] = [
  { mode: "physical", label: "Physical Cards", description: "I own the physical cards.", testId: "button-mode-physical" },
  { mode: "digital", label: "Digital Cards", description: "Play using the digital card deck.", testId: "button-mode-digital" },
];

export function PlayModeSelectionScreen({ edition, onSelectMode, busy = false, onBack }: PlayModeSelectionScreenProps) {
  const theme = EDITION_THEMES[edition.id];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden text-white" style={{ background: "#120b22" }}>
      <SceneBackdrop />

      <div className="relative z-10 flex flex-1 flex-col p-6 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/80" style={{ textShadow: "0 1px 3px #000" }}>
            Edition
          </p>
          <h1
            className="mx-auto inline-block rounded-lg border-2 px-6 py-2 text-2xl font-black uppercase tracking-wide"
            style={{
              borderColor: theme.accent,
              background: `linear-gradient(180deg, ${theme.headerFrom}, ${theme.headerTo})`,
              boxShadow: `0 0 18px ${theme.accent}88, inset 0 1px 0 rgba(255,255,255,0.35)`,
              textShadow: "0 2px 3px #000",
            }}
          >
            {edition.name}
          </h1>
          <h2 className="arcade-title text-xl">How are you playing?</h2>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4">
          {MODES.map(({ mode, label, description, testId }) => (
            <div
              key={mode}
              className="relative overflow-hidden rounded-2xl border-[3px]"
              style={{ borderColor: theme.accent, boxShadow: `0 8px 22px rgba(0,0,0,0.6), 0 0 16px ${theme.accent}55` }}
            >
              <img src={theme.art} alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/80" />
              <div className="relative space-y-2 p-4">
                <button
                  type="button"
                  className="h-14 w-full rounded-lg text-lg font-extrabold uppercase tracking-wider shadow-md active:scale-95"
                  style={{ background: `linear-gradient(180deg, #fff8, ${theme.accent} 45%)`, color: theme.buttonText }}
                  onClick={() => onSelectMode(mode)}
                  disabled={busy}
                  data-testid={testId}
                >
                  {busy && mode === "digital" ? "Checking..." : label}
                </button>
                <p className="text-center text-sm font-semibold text-white" style={{ textShadow: "0 1px 3px #000" }}>
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" className="mx-auto mt-6 h-12 w-full max-w-xs text-base uppercase tracking-widest" onClick={onBack} data-testid="button-mode-back">
          Back
        </Button>
      </div>
    </div>
  );
}
