import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LOGO_URL } from "@/lib/constants";
import { EDITION_THEMES, type EditionTheme } from "@/lib/edition-theme";
import newGameArt from "@assets/editions/splash-new-game.jpg";
import loadGameArt from "@assets/editions/splash-load-game.jpg";
import howToPlayArt from "@assets/editions/splash-how-to-play.jpg";
import testArt from "@assets/editions/splash-test.jpg";
import { ArcadeCarousel } from "@/components/arcade/ArcadeCarousel";
import { SceneBackdrop } from "@/components/arcade/SceneBackdrop";
import { hasTestingAccess, setTestingAccess, unlockAllTestEntitlements } from "@/lib/entitlements";

interface SplashScreenProps {
  onNewGame: () => void;
  onLoadGame: () => void;
  onStartTournamentGame?: () => void;
  onHowToPlay?: () => void;
}

interface SplashAction {
  id: string;
  title: string;
  art: string;
  theme: EditionTheme;
  testId: string;
  run: () => void;
}

export function SplashScreen({ onNewGame, onLoadGame, onStartTournamentGame, onHowToPlay }: SplashScreenProps) {
  const [testerCodeStep, setTesterCodeStep] = useState<"code" | "sign-out" | null>(null);
  const [testerCodeInput, setTesterCodeInput] = useState("");
  const [testerCodeError, setTesterCodeError] = useState<string | null>(null);

  const resetTesterCodeFlow = () => {
    setTesterCodeStep(null);
    setTesterCodeInput("");
    setTesterCodeError(null);
  };

  const handleNewGameClick = () => {
    resetTesterCodeFlow();
    onNewGame();
  };

  const handleTestButtonClick = () => {
    if (hasTestingAccess()) {
      setTesterCodeInput("");
      setTesterCodeError(null);
      setTesterCodeStep("sign-out");
      return;
    }

    setTesterCodeInput("");
    setTesterCodeError(null);
    setTesterCodeStep("code");
  };

  const handleTesterCodeSubmit = async () => {
    const success = await unlockAllTestEntitlements(testerCodeInput);
    if (!success) {
      setTesterCodeError("Invalid code. Please try again.");
      return;
    }

    resetTesterCodeFlow();
    onNewGame();
  };

  const handleTesterSignOut = () => {
    setTestingAccess(false);
    resetTesterCodeFlow();
  };

  const [activeIndex, setActiveIndex] = useState(0);

  const actions = (() => {
    const list: SplashAction[] = [
      { id: "new-game", title: "New Game", art: newGameArt, theme: EDITION_THEMES.classic, testId: "button-new-game", run: handleNewGameClick },
      { id: "load-game", title: "Load Game", art: loadGameArt, theme: EDITION_THEMES.reracked, testId: "button-load-game", run: onLoadGame },
    ];
    if (onHowToPlay) {
      list.push({ id: "how-to-play", title: "How to Play", art: howToPlayArt, theme: EDITION_THEMES.sequential, testId: "button-how-to-play", run: onHowToPlay });
    }
    list.push({ id: "test", title: "Test", art: testArt, theme: EDITION_THEMES.tournament, testId: "button-test", run: handleTestButtonClick });
    return list;
  })();

  const items = actions.map((action) => ({ id: action.id, label: action.title, accent: action.theme.accent, action }));

  return (
    <div
      className="relative flex min-h-[560px] w-full flex-col overflow-hidden text-white"
      style={{ height: "100dvh", background: "#120b22" }}
      data-testid="splash-screen"
    >
      <SceneBackdrop />

      <div className="relative z-10 flex justify-center px-6 pb-1 pt-[max(1rem,env(safe-area-inset-top))]">
        <img
          src={LOGO_URL}
          alt="Par for the Course"
          className="h-auto max-h-[14vh] w-full max-w-[240px] object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.8)]"
        />
      </div>

      <ArcadeCarousel
        items={items}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        ariaLabel="Main menu"
        testIdPrefix="splash"
        aspect={1}
        maxCardHeight={320}
        renderCard={({ action }, { isActive, cardWidth }) => (
          <>
            <div
              className="flex shrink-0 items-center justify-center px-2 py-2.5"
              style={{
                background: `linear-gradient(180deg, ${action.theme.headerFrom}, ${action.theme.headerTo})`,
                borderBottom: `2px solid ${action.theme.accent}`,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
              }}
            >
              <span
                className="truncate text-center font-black uppercase leading-none tracking-wide"
                style={{ fontSize: Math.max(15, Math.min(26, cardWidth * 0.095)), textShadow: "0 2px 3px #000" }}
              >
                {action.title}
              </span>
            </div>
            <div className="relative min-h-0 flex-1">
              <img src={action.art} alt="" draggable={false} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/25" />
            </div>
            <div
              className="shrink-0 p-2"
              style={{ background: `linear-gradient(180deg, ${action.theme.headerTo}, #000)`, borderTop: `2px solid ${action.theme.accent}` }}
              data-no-swipe
            >
              <button
                type="button"
                className="h-11 w-full rounded-lg text-base font-extrabold uppercase tracking-wider shadow-md active:scale-95"
                style={{ background: `linear-gradient(180deg, #fff8, ${action.theme.accent} 45%)`, color: action.theme.buttonText }}
                tabIndex={isActive ? 0 : -1}
                onClick={(event) => {
                  event.stopPropagation();
                  if (isActive) action.run();
                  else setActiveIndex(actions.findIndex((item) => item.id === action.id));
                }}
                data-testid={action.testId}
              >
                {action.title}
              </button>
            </div>
          </>
        )}
      />

      <div className="relative z-10 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center">
        <button
          onClick={() => window.open("https://forms.gle/dss9Ksbenx3WTzh29", "_blank")}
          className="min-h-11 px-4 text-sm font-semibold uppercase tracking-widest text-white/80 underline-offset-4 hover:text-white hover:underline"
          style={{ textShadow: "0 1px 3px #000" }}
          data-testid="button-submit-feedback"
        >
          Submit Feedback
        </button>
      </div>
      <AlertDialog open={testerCodeStep !== null} onOpenChange={(open) => {
        if (!open) {
          resetTesterCodeFlow();
        }
      }}>
        <AlertDialogContent>
          {testerCodeStep === "sign-out" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Tester access active</AlertDialogTitle>
                <AlertDialogDescription>
                  You are currently signed in with the test unlock code. Sign out to return to normal entitlement checks?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button variant="outline" onClick={resetTesterCodeFlow}>
                  Cancel
                </Button>
                <Button onClick={handleTesterSignOut}>
                  Sign out
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Enter playtesting code</AlertDialogTitle>
                <AlertDialogDescription>
                  Use the tester code to unlock all entitlements for this session.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Input
                  value={testerCodeInput}
                  onChange={(e) => {
                    setTesterCodeError(null);
                    setTesterCodeInput(e.target.value.toUpperCase());
                  }}
                  placeholder="Enter code"
                  className="font-mono tracking-widest text-center"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handleTesterCodeSubmit();
                    }
                  }}
                  autoFocus
                />
                {testerCodeError && (
                  <p className="text-sm text-destructive">{testerCodeError}</p>
                )}
              </div>
              <AlertDialogFooter>
                <Button variant="outline" onClick={resetTesterCodeFlow}>
                  Cancel
                </Button>
                <Button onClick={() => void handleTesterCodeSubmit()}>
                  Unlock
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
