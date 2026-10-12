import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LOGO_URL } from "@/lib/constants";
import { hasTestingAccess, setTestingAccess, unlockAllTestEntitlements } from "@/lib/entitlements";

interface SplashScreenProps {
  onNewGame: () => void;
  onLoadGame: () => void;
  onStartTournamentGame?: () => void;
}

export function SplashScreen({ onNewGame, onLoadGame, onStartTournamentGame }: SplashScreenProps) {
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative">
      <div className="mb-8">
        <img 
          src={LOGO_URL} 
          alt="Par for the Course" 
          className="w-full max-w-[280px] h-auto"
        />
      </div>
      
      <div className="w-full max-w-md space-y-4">
        <Button 
          size="lg"
          className="w-full text-lg h-14"
          onClick={handleNewGameClick}
          data-testid="button-new-game"
        >
          New Game
        </Button>
        <Button 
          size="lg"
          variant="outline"
          className="w-full text-lg h-14"
          onClick={onLoadGame}
          data-testid="button-load-game"
        >
          Load Game
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full text-lg h-14"
          onClick={handleTestButtonClick}
          data-testid="button-test"
        >
          Test
        </Button>

        {/* Submit Feedback */}
        <button
          onClick={() => window.open("https://forms.gle/dss9Ksbenx3WTzh29", "_blank")}
          className="w-full text-sm text-muted-foreground hover:text-primary transition-colors py-2"
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
