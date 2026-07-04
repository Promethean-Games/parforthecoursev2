import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Settings } from "lucide-react";
import { LOGO_URL } from "@/lib/constants";
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

  const handleTDSignInSuccess = (pin: string) => {
    setVerifiedPin(pin);
    setShowTournamentManagement(true);
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
            <DropdownMenuItem
              onClick={() => window.open("https://forms.gle/41CE3SGQLPukQcw17", "_blank")}
              data-testid="menu-item-send-feedback"
            >
              Send Feedback
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open("https://forms.gle/dss9Ksbenx3WTzh29", "_blank")}
              data-testid="menu-item-submit-feedback"
            >
              Submit Feedback
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
          onClick={onNewGame}
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


      <TDSignInModal
        isOpen={showTDSignIn}
        onClose={() => setShowTDSignIn(false)}
        onSuccess={handleTDSignInSuccess}
      />
    </div>
  );
}
