import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { GameProvider, useGame } from "@/contexts/GameContext";
import { TournamentProvider, useTournament } from "@/contexts/TournamentContext";
import { SplashScreen } from "@/components/SplashScreen";
import { PlayerSetup } from "@/components/PlayerSetup";
import { GameScreen } from "@/components/GameScreen";
import { SummaryScreen } from "@/components/SummaryScreen";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SaveLoadDialog } from "@/components/SaveLoadDialog";
import { BottomNav } from "@/components/BottomNav";
import { isLeader } from "@/lib/game-utils";

type Screen = "splash" | "setup" | "game" | "summary";
type ActiveTab = "game" | "summary" | "settings" | "save";

function GameApp() {
  const game = useGame();
  const tournament = useTournament();
  const { theme, setTheme } = useTheme();
  
  const [screen, setScreen] = useState<Screen>("splash");
  const [activeTab, setActiveTab] = useState<ActiveTab>("game");
  const [showSaveLoad, setShowSaveLoad] = useState<"load" | null>(null);

  // Sync theme with game settings
  useEffect(() => {
    setTheme(game.settings.theme);
  }, [game.settings.theme, setTheme]);

  const handleNewGame = () => {
    game.resetGame();
    setScreen("setup");
  };

  const handleLoadGame = () => {
    setShowSaveLoad("load");
  };

  const handleStartGame = () => {
    game.startGame();
    setScreen("game");
  };

  const handleStartTournamentGame = async () => {
    // Fetch existing scores from server first
    let serverScores: Record<string, Array<{ hole: number; par: number; strokes: number; scratches: number; penalties: number }>> = {};
    try {
      const res = await apiRequest("GET", `/api/tournaments/${tournament.roomCode}/my-scores?deviceId=${tournament.deviceId}`);
      const data = await res.json();
      serverScores = data.scores || {};
    } catch (err) {
      console.log("No existing scores to restore or error fetching:", err);
    }
    
    // Reset local game and populate with tournament players
    game.resetGame();
    
    // Add players and restore their scores immediately
    tournament.myPlayers.forEach((tp, idx) => {
      game.addPlayer(tp.playerName, idx);
    });
    
    game.startGame();
    
    // Use a small delay to ensure state is updated, then restore scores
    setTimeout(() => {
      tournament.myPlayers.forEach((tp, idx) => {
        const scores = serverScores[tp.id.toString()];
        if (scores && game.players[idx]) {
          const localPlayerId = game.players[idx].id;
          for (const score of scores) {
            game.updateScore(localPlayerId, score.hole, {
              hole: score.hole,
              par: score.par,
              strokes: score.strokes,
              scratches: score.scratches,
              penalties: score.penalties,
            });
          }
        }
      });
    }, 100);
    
    setScreen("game");
    setActiveTab("game");
  };

  const handleEndGame = () => {
    game.endGame();
    setActiveTab("summary");
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
  };

  const handleLoadSlot = (slot: string) => {
    game.loadGame(slot);
    setShowSaveLoad(null);
    setScreen("game");
    setActiveTab("game");
  };

  const handleSaveSlot = (slot: string) => {
    game.saveGame(slot);
  };

  const handleRenameSlot = (oldSlot: string, newSlot: string) => {
    game.renameSlot(oldSlot, newSlot);
  };

  const handleDeleteSlot = (slot: string) => {
    game.deleteSlot(slot);
  };

  const currentPlayer = game.players[game.currentPlayerIndex];
  const playerIsLeader = currentPlayer ? isLeader(currentPlayer.id, game.players, game.scores) : false;

  // Splash Screen
  if (screen === "splash") {
    return (
      <>
        <SplashScreen 
          onNewGame={handleNewGame} 
          onLoadGame={handleLoadGame}
          onStartTournamentGame={handleStartTournamentGame}
        />
        {showSaveLoad === "load" && (
          <SaveLoadDialog
            mode="load"
            savedGames={game.getSavedGames()}
            onLoad={handleLoadSlot}
            onRename={handleRenameSlot}
            onDelete={handleDeleteSlot}
            onClose={() => setShowSaveLoad(null)}
          />
        )}
      </>
    );
  }

  // Setup Screen
  if (screen === "setup") {
    return (
      <PlayerSetup
        players={game.players}
        onAddPlayer={game.addPlayer}
        onRemovePlayer={game.removePlayer}
        onUpdatePlayerName={game.updatePlayerName}
        onUpdatePlayerColor={game.updatePlayerColor}
        onMovePlayer={game.movePlayer}
        onStartGame={handleStartGame}
      />
    );
  }

  // Game/Summary/Save/Settings with Bottom Nav
  return (
    <div className="pb-16">
      {activeTab === "game" && currentPlayer && (
        <GameScreen
          players={game.players}
          currentPlayer={currentPlayer}
          currentHole={game.currentHole}
          scores={game.scores}
          isLeader={playerIsLeader}
          leftHandedMode={game.settings.leftHandedMode}
          onPreviousPlayer={game.previousPlayer}
          onNextPlayer={game.nextPlayer}
          onUpdateScore={(score) => game.updateScore(currentPlayer.id, game.currentHole, score)}
          onNextCard={game.nextCard}
          onUndo={game.undo}
          canUndo={true}
          onSetParForAll={(par) => game.setParForAllPlayers(game.currentHole, par)}
          onRecordSetupTime={game.recordSetupTime}
        />
      )}

      {activeTab === "summary" && (
        <SummaryScreen
          players={game.players}
          scores={game.scores}
          onNewGame={handleNewGame}
          isGameOver={game.isComplete}
        />
      )}

      {activeTab === "save" && (
        <SaveLoadDialog
          mode="save"
          savedGames={game.getSavedGames()}
          onSave={handleSaveSlot}
          onLoad={handleLoadSlot}
          onRename={handleRenameSlot}
          onDelete={handleDeleteSlot}
          onEndGame={handleEndGame}
          onNewGame={handleNewGame}
          onClose={() => setActiveTab("game")}
        />
      )}

      {activeTab === "settings" && (
        <SettingsPanel
          settings={game.settings}
          players={game.players}
          onUpdateSettings={game.updateSettings}
          onAddPlayer={game.addPlayer}
          onEndGame={handleEndGame}
        />
      )}

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <TournamentProvider>
            <GameProvider>
              <GameApp />
            </GameProvider>
          </TournamentProvider>
        </ThemeProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
