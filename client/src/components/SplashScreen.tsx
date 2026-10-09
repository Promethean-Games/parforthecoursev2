import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Settings } from "lucide-react";
import { LOGO_URL } from "@/lib/constants";
import { unlockAllTestEntitlements } from "@/lib/entitlements";
import { TDSignInModal } from "./TDSignInModal";
import { TournamentManagementPage } from "./TournamentManagementPage";

interface SplashScreenProps {
  onNewGame: () => void;
  onLoadGame: () => void;
  onStartTournamentGame?: () => void;
}

export function SplashScreen({ onNewGame, onLoadGame, onStartTournamentGame }: SplashScreenProps) {
  const [showTDSignIn, setShowTDSignIn] = useState(false);
  const [showTournamentManagement, setShowTournamentManagement] = useState(false);
  const [verifiedPin, setVerifiedPin] = useState<string | null>(null);
  const [testerCodeStep, setTesterCodeStep] = useState<"prompt" | "code" | null>(null);
  const [testerCodeInput, setTesterCodeInput] = useState("");
  const [testerCodeError, setTesterCodeError] = useState<string | null>(null);

  const handleTDSignInSuccess = (pin: string) => {
    setVerifiedPin(pin);
    setShowTournamentManagement(true);
  };

  const resetTesterCodeFlow = () => {
    setTesterCodeStep(null);
    setTesterCodeInput("");
    setTesterCodeError(null);
  };

  const handleNewGameClick = () => {
    setTesterCodeInput("");
    setTesterCodeError(null);
    setTesterCodeStep("prompt");
  };

  const handleNormalNewGame = () => {
    resetTesterCodeFlow();
    onNewGame();
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

  if (showTournamentManagement && verifiedPin) {
    return (
      <TournamentManagementPage 
        onClose={() => {
          setShowTournamentManagement(false);
          setVerifiedPin(null);
        }} 
        directorPin={verifiedPin}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative">
      {/* TD Sign-In Gear Icon - Upper Right */}
      <div className="absolute top-4 right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
              data-testid="button-td-menu"
            >
              <Settings className="w-6 h-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={() => setShowTDSignIn(true)}
              data-testid="menu-item-td-signin"
            >
              TD Sign-In
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
          {testerCodeStep === "prompt" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Playtesting access</AlertDialogTitle>
                <AlertDialogDescription>
                  Do you have a code for unlocking playtesting mode?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleNormalNewGame}>No</AlertDialogCancel>
                <AlertDialogAction onClick={() => setTesterCodeStep("code")}>Yes</AlertDialogAction>
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
                <AlertDialogCancel onClick={resetTesterCodeFlow}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleTesterCodeSubmit()}>Unlock</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <TDSignInModal
        isOpen={showTDSignIn}
        onClose={() => setShowTDSignIn(false)}
        onSuccess={handleTDSignInSuccess}
      />
    </div>
  );
}
