import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { LOGO_URL } from "@/lib/constants";
import { useTournament } from "@/contexts/TournamentContext";
import { PlayerSelectionDialog } from "./PlayerSelectionDialog";

interface SplashScreenProps {
  onNewGame: () => void;
  onLoadGame: () => void;
  onStartTournamentGame?: () => void;
}

export function SplashScreen({ onNewGame, onLoadGame, onStartTournamentGame }: SplashScreenProps) {
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showPlayerSelection, setShowPlayerSelection] = useState(false);
  const tournament = useTournament();

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim()) return;
    setJoinError(null);
    const success = await tournament.joinRoom(roomCodeInput.trim());
    if (success) {
      setRoomCodeInput("");
      setShowPlayerSelection(true);
    } else {
      setJoinError(tournament.error || "Failed to join");
    }
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

        {/* Tournament Join Section */}
        <Card className="p-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Join Tournament</h3>
          </div>
          
          {tournament.isConnected ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                <div>
                  <p className="font-medium">{tournament.tournamentInfo?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Room: {tournament.roomCode}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPlayerSelection(true)}
                  data-testid="button-manage-players-splash"
                >
                  Manage Players
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => tournament.leaveRoom()}
                data-testid="button-leave-room-splash"
              >
                Leave Tournament
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="Enter room code"
                  className="flex-1 font-mono text-center tracking-widest text-lg"
                  maxLength={6}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJoinRoom();
                  }}
                  data-testid="input-room-code-splash"
                />
                <Button
                  onClick={handleJoinRoom}
                  disabled={tournament.isLoading || !roomCodeInput.trim()}
                  data-testid="button-join-room-splash"
                >
                  {tournament.isLoading ? "..." : "Join"}
                </Button>
              </div>
              {joinError && (
                <p className="text-sm text-destructive text-center">{joinError}</p>
              )}
            </div>
          )}
        </Card>
      </div>

      {showPlayerSelection && tournament.isConnected && (
        <PlayerSelectionDialog
          onClose={() => setShowPlayerSelection(false)}
          onStartGame={() => {
            setShowPlayerSelection(false);
            if (onStartTournamentGame) {
              onStartTournamentGame();
            }
          }}
        />
      )}

    </div>
  );
}
