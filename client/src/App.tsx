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
import { EditionSelectionScreen } from "@/components/EditionSelectionScreen";
import { PlayModeSelectionScreen } from "@/components/PlayModeSelectionScreen";
import { DigitalAccessScreen } from "@/components/DigitalAccessScreen";
import { DigitalExperiencePlaceholder } from "@/components/DigitalExperiencePlaceholder";
import { getEditionById, type EditionDefinition } from "@/lib/editions";
import { hasDigitalAccess, purchaseDigitalEdition } from "@/lib/entitlements";
import { getTurnOrder, isLeader } from "@/lib/game-utils";

type Screen =
  | "splash"
  | "edition"
  | "mode"
  | "setup"
  | "game"
  | "summary"
  | "digital-access"
  | "digital-experience";
type ActiveTab = "game" | "summary" | "settings" | "save";

function GameApp() {
  const game = useGame();
  const tournament = useTournament();
  const { setTheme } = useTheme();

  const [screen, setScreen] = useState<Screen>("splash");
  const [activeTab, setActiveTab] = useState<ActiveTab>("game");
  const [showSaveLoad, setShowSaveLoad] = useState<"load" | null>(null);
  const [selectedEdition, setSelectedEdition] = useState<EditionDefinition | null>(null);
  const [isPurchasingDigital, setIsPurchasingDigital] = useState(false);
  const [digitalAccessError, setDigitalAccessError] = useState<string | null>(null);

  useEffect(() => {
    setTheme(game.settings.theme);
  }, [game.settings.theme, setTheme]);

  const handleNewGame = () => {
    game.resetGame();
    setSelectedEdition(null);
    setDigitalAccessError(null);
    setScreen("edition");
  };

  const handleLoadGame = () => {
    setShowSaveLoad("load");
  };

  const handleSelectEdition = (edition: EditionDefinition) => {
    setSelectedEdition(edition);
    setDigitalAccessError(null);
    setScreen("mode");
  };

  const handleStartGame = () => {
    game.startGame();
    setScreen("game");
  };

  const handleSelectPhysicalMode = () => {
    if (!selectedEdition) return;
    game.resetGame();
    game.setGameExperience(selectedEdition.id, "physical");
    setScreen("setup");
  };

  const handleSelectDigitalMode = async () => {
    if (!selectedEdition) return;
    setDigitalAccessError(null);
    game.setGameExperience(selectedEdition.id, "digital");

    const unlocked = await hasDigitalAccess(selectedEdition.id);
    setScreen(unlocked ? "digital-experience" : "digital-access");
  };

  const handlePurchaseDigitalEdition = async () => {
    if (!selectedEdition) return;

    setIsPurchasingDigital(true);
    setDigitalAccessError(null);
    try {
      await purchaseDigitalEdition(selectedEdition.id);
      const unlocked = await hasDigitalAccess(selectedEdition.id);
      if (unlocked) {
        setScreen("digital-experience");
      } else {
        setDigitalAccessError("Unable to unlock digital edition. Please try again.");
      }
    } catch (error) {
      setDigitalAccessError(
        error instanceof Error ? error.message : "Unable to complete digital unlock right now.",
      );
    } finally {
      setIsPurchasingDigital(false);
    }
  };

  const handleUsePhysicalCards = () => {
    if (!selectedEdition) return;
    game.resetGame();
    game.setGameExperience(selectedEdition.id, "physical");
    setScreen("setup");
  };

  const handleStartTournamentGame = async () => {
    let serverScores: Record<string, Array<{ hole: number; par: number; strokes: number; scratches: number; penalties: number }>> = {};
    try {
      const res = await apiRequest("GET", `/api/tournaments/${tournament.roomCode}/my-scores?deviceId=${tournament.deviceId}`);
      const data = await res.json();
      serverScores = data.scores || {};
    } catch (err) {
      console.log("No existing scores to restore or error fetching:", err);
    }

    game.resetGame();
    game.setGameExperience(game.selectedEditionId, "physical");

    tournament.myPlayers.forEach((tp, idx) => {
      game.addPlayer(tp.playerName, idx);
    });

    game.startGame();

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
    const savedGames = game.getSavedGames() as Record<string, { selectedEditionId?: string }>;
    const savedEditionId = savedGames[slot]?.selectedEditionId;
    if (savedEditionId) {
      try {
        setSelectedEdition(getEditionById(savedEditionId as EditionDefinition["id"]));
      } catch {
        setSelectedEdition(getEditionById("classic"));
      }
    } else {
      setSelectedEdition(getEditionById("classic"));
    }

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

  const turnOrderPlayers = getTurnOrder(game.players, game.scores, game.currentHole);
  const currentPlayerIndex = turnOrderPlayers.length > 0 ? game.currentPlayerIndex % turnOrderPlayers.length : 0;
  const currentPlayer = turnOrderPlayers[currentPlayerIndex];
  const playerIsLeader = currentPlayer ? isLeader(currentPlayer.id, game.players, game.scores) : false;

  if (screen === "splash") {
    return (
      <>
        <SplashScreen onNewGame={handleNewGame} onLoadGame={handleLoadGame} onStartTournamentGame={handleStartTournamentGame} />
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

  if (screen === "edition") {
    return <EditionSelectionScreen onSelectEdition={handleSelectEdition} onBack={() => setScreen("splash")} />;
  }

  if ((screen === "mode" || screen === "digital-access" || screen === "digital-experience") && !selectedEdition) {
    return <EditionSelectionScreen onSelectEdition={handleSelectEdition} onBack={() => setScreen("splash")} />;
  }

  if (screen === "mode" && selectedEdition) {
    return (
      <PlayModeSelectionScreen
        edition={selectedEdition}
        onSelectMode={(mode) => {
          if (mode === "physical") {
            handleSelectPhysicalMode();
          } else {
            void handleSelectDigitalMode();
          }
        }}
        onBack={() => setScreen("edition")}
      />
    );
  }

  if (screen === "digital-access" && selectedEdition) {
    return (
      <DigitalAccessScreen
        edition={selectedEdition}
        isPurchasing={isPurchasingDigital}
        error={digitalAccessError}
        onPurchase={() => void handlePurchaseDigitalEdition()}
        onUsePhysicalCards={handleUsePhysicalCards}
        onBack={() => setScreen("mode")}
      />
    );
  }

  if (screen === "digital-experience" && selectedEdition) {
    return <DigitalExperiencePlaceholder edition={selectedEdition} onBack={() => setScreen("mode")} />;
  }

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

  return (
    <div className="pb-16">
      {activeTab === "game" && currentPlayer && (
        <GameScreen
          players={turnOrderPlayers}
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
          onUpdateHoleScore={(playerId, hole, strokes) => game.updateScore(playerId, hole, { hole, strokes })}
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

