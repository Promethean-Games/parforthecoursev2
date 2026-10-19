import { useState, useEffect, useRef, Component, type ReactNode, type ErrorInfo } from "react";
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
import { finalizeStripeCheckoutFromUrl, getDigitalStorePricing, getDigitalEntitlements, hasCachedDigitalAccess, hasDigitalAccess, purchaseDigitalEdition, restoreDigitalPurchases } from "@/lib/entitlements";
import { RulesOverlay } from "@/components/RulesViewer";
import { closeRules, openRules, RULES_CLOSED, selectRulesEdition, type RulesState } from "@/lib/rules-session";
import { useToast } from "@/hooks/use-toast";
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

class AppErrorBoundary extends Component<{
  children: ReactNode;
}, {
  hasError: boolean;
  error: Error | null;
}> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
   return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
   console.error("App render error", error, errorInfo);
  }

  render() {
   if (this.state.hasError) {
     return (
       <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
         <div className="max-w-md rounded-lg border border-destructive/40 bg-card p-6 shadow-lg">
           <h1 className="mb-3 text-2xl font-bold text-foreground">Something went wrong</h1>
           <p className="mb-4 text-sm text-muted-foreground">
             The app could not finish loading. Please reload and try again.
           </p>
           <button
             type="button"
             onClick={() => window.location.reload()}
             className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
           >
             Reload app
           </button>
         </div>
       </div>
     );
   }

   return this.props.children;
  }
}

interface RulesHandlers {
  onOpenRules: (editionId?: EditionDefinition["id"], fromGame?: boolean) => void;
}

function GameScreens({ onOpenRules }: RulesHandlers) {
  const game = useGame();
  const tournament = useTournament();
  const { setTheme } = useTheme();

  const [screen, setScreen] = useState<Screen>("splash");
  const [activeTab, setActiveTab] = useState<ActiveTab>("game");
  const [showSaveLoad, setShowSaveLoad] = useState<"load" | null>(null);
  const [selectedEdition, setSelectedEdition] = useState<EditionDefinition | null>(null);
  const [isPurchasingDigital, setIsPurchasingDigital] = useState(false);
  const [digitalAccessError, setDigitalAccessError] = useState<string | null>(null);
  const [isCheckingDigital, setIsCheckingDigital] = useState(false);
  const checkingDigitalRef = useRef(false);
  const [isRestoringDigital, setIsRestoringDigital] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [digitalEditionPriceLabel, setDigitalEditionPriceLabel] = useState<string | null | undefined>(undefined);
  const [digitalUnlockAllPriceLabel, setDigitalUnlockAllPriceLabel] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setTheme(game.settings.theme);
  }, [game.settings.theme, setTheme]);

  useEffect(() => {
    void finalizeStripeCheckoutFromUrl().catch((error) => {
      setDigitalAccessError(
        error instanceof Error
          ? error.message
          : "Unable to finalize payment. Please try opening Digital Cards again.",
      );
    });
  }, []);

  useEffect(() => {
    if (screen !== "digital-access" || !selectedEdition) return;
    let mounted = true;

    void getDigitalStorePricing()
      .then((pricing) => {
        if (!mounted) return;
        setDigitalEditionPriceLabel(pricing.editionPrices[selectedEdition.id] ?? null);
        setDigitalUnlockAllPriceLabel(pricing.unlockAllPrice);
      })
      .catch(() => {
        if (!mounted) return;
        setDigitalEditionPriceLabel(null);
        setDigitalUnlockAllPriceLabel(null);
      });

    return () => {
      mounted = false;
    };
  }, [screen, selectedEdition]);

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
    setDigitalEditionPriceLabel(undefined);
    setDigitalUnlockAllPriceLabel(undefined);
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
    if (!selectedEdition || checkingDigitalRef.current) return;
    checkingDigitalRef.current = true;
    setIsCheckingDigital(true);
    setDigitalAccessError(null);
    game.setGameExperience(selectedEdition.id, "digital");
    try {
      // Previously verified owners start immediately; the cache is refreshed in the background.
      const cachedUnlocked = hasCachedDigitalAccess(selectedEdition.id);
      if (cachedUnlocked) void getDigitalEntitlements().catch(() => undefined);
      const unlocked = cachedUnlocked || await hasDigitalAccess(selectedEdition.id);
      if (!unlocked) {
        setScreen("digital-access");
        return;
      }

      if (
        selectedEdition.id === "classic"
        || selectedEdition.id === "reracked"
        || selectedEdition.id === "sequential"
        || selectedEdition.id === "teed-off"
        || selectedEdition.id === "tournament"
      ) {
        game.resetGame();
        game.setGameExperience(selectedEdition.id, "digital");
        setScreen("setup");
        return;
      }

      setScreen("digital-experience");
    } catch (error) {
      setDigitalAccessError(
        error instanceof Error
          ? error.message
          : "Unable to verify digital access right now. You can still purchase this edition below.",
      );
      setScreen("digital-access");
    } finally {
      checkingDigitalRef.current = false;
      setIsCheckingDigital(false);
    }
  };

  const handlePurchaseDigitalEdition = async () => {
    if (!selectedEdition) return;

    setIsPurchasingDigital(true);
    setDigitalAccessError(null);
    try {
      const purchaseResult = await purchaseDigitalEdition(selectedEdition.id);
      if (purchaseResult === "pending") {
        setDigitalAccessError("Purchase is pending in Google Play. Your edition will unlock after payment confirmation.");
        return;
      }
      if (purchaseResult === "cancelled") {
        setDigitalAccessError("Purchase was cancelled.");
        return;
      }

      const unlocked = await hasDigitalAccess(selectedEdition.id);
      if (unlocked) {
        game.resetGame();
        game.setGameExperience(selectedEdition.id, "digital");
        setScreen("setup");
      }
    } catch (error) {
      setDigitalAccessError(
        error instanceof Error ? error.message : "Unable to complete digital unlock right now.",
      );
    } finally {
      setIsPurchasingDigital(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (!selectedEdition) return;
    setIsRestoringDigital(true);
    setRestoreFailed(false);
    setDigitalAccessError(null);
    try {
      const { status, entitlements } = await restoreDigitalPurchases();
      if (entitlements[selectedEdition.id]) {
        game.resetGame();
        game.setGameExperience(selectedEdition.id, "digital");
        setScreen("setup");
        return;
      }

      const messages: Record<string, string> = {
        restored: `Your purchases were restored, but ${selectedEdition.name} isn't included. You can buy it below.`,
        none: "No Google Play purchases were found for this account. If you bought on another account, switch to it in Google Play and retry.",
        unavailable: "We couldn't verify your purchase right now. Check your connection and tap Retry.",
        rejected: "Google Play purchase could not be verified. Tap Retry, or contact support if this continues.",
        "not-configured": "Purchase verification isn't available in this version of the app yet. Your purchase is safe; please update the app and retry.",
        "no-play": "Restoring purchases requires Google Play on this device.",
      };
      setDigitalAccessError(messages[status] ?? "Unable to restore purchases right now.");
      setRestoreFailed(status === "unavailable" || status === "rejected" || status === "not-configured");
    } catch (error) {
      setRestoreFailed(true);
      setDigitalAccessError(
        error instanceof Error ? `${error.message} Tap Retry.` : "Unable to restore purchases right now. Tap Retry.",
      );
    } finally {
      setIsRestoringDigital(false);
    }
  };

  const handleUnlockAllDigitalEditions = async () => {
    if (!selectedEdition) return;
    setIsPurchasingDigital(true);
    setDigitalAccessError(null);
    try {
      const purchaseResult = await purchaseDigitalEdition("all");
      if (purchaseResult === "pending") {
        setDigitalAccessError("Bundle purchase is pending in Google Play. Editions unlock after payment confirmation.");
        return;
      }
      if (purchaseResult === "cancelled") {
        setDigitalAccessError("Purchase was cancelled.");
        return;
      }

      const unlocked = await hasDigitalAccess(selectedEdition.id);
      if (unlocked) {
        game.resetGame();
        game.setGameExperience(selectedEdition.id, "digital");
        setScreen("setup");
      }
    } catch (error) {
      setDigitalAccessError(
        error instanceof Error ? error.message : "Unable to start unlock-all checkout right now.",
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

  const handleHome = () => {
    game.resetGame();
    setSelectedEdition(null);
    setDigitalAccessError(null);
    setShowSaveLoad(null);
    setScreen("splash");
    setActiveTab("game");
  };

  const handleTabChange = (tab: ActiveTab) => {
    if (game.isComplete && tab === "game") {
      handleHome();
      return;
    }
    setActiveTab(tab);
  };

  const handleLoadSlot = (slot: string) => {
    const savedGames = game.getSavedGames();
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

  const activeEdition = selectedEdition ?? getEditionById(game.selectedEditionId);
  const totalHoles = (activeEdition.cardCount ?? 18) + activeEdition.jokerCount;

  const turnOrderPlayers = getTurnOrder(game.players, game.scores, game.currentHole);
  const currentPlayerIndex = turnOrderPlayers.length > 0 ? game.currentPlayerIndex % turnOrderPlayers.length : 0;
  const currentPlayer = turnOrderPlayers[currentPlayerIndex];
  const playerIsLeader = currentPlayer ? isLeader(currentPlayer.id, game.players, game.scores) : false;

  if (screen === "splash") {
    return (
      <>
        <SplashScreen onNewGame={handleNewGame} onLoadGame={handleLoadGame} onStartTournamentGame={handleStartTournamentGame} onHowToPlay={() => onOpenRules()} />
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
    return <EditionSelectionScreen onSelectEdition={handleSelectEdition} onBack={() => setScreen("splash")} onViewRules={(id) => onOpenRules(id)} />;
  }

  if ((screen === "mode" || screen === "digital-access" || screen === "digital-experience") && !selectedEdition) {
    return <EditionSelectionScreen onSelectEdition={handleSelectEdition} onBack={() => setScreen("splash")} />;
  }

  if (screen === "mode" && selectedEdition) {
    return (
      <PlayModeSelectionScreen
        edition={selectedEdition}
        busy={isCheckingDigital}
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
        editionPriceLabel={digitalEditionPriceLabel}
        unlockAllPriceLabel={digitalUnlockAllPriceLabel}
        isPurchasing={isPurchasingDigital}
        isRestoring={isRestoringDigital}
        restoreFailed={restoreFailed}
        onRestore={() => void handleRestorePurchases()}
        error={digitalAccessError}
        onPurchase={() => void handlePurchaseDigitalEdition()}
        onUnlockAll={() => void handleUnlockAllDigitalEditions()}
        onUsePhysicalCards={handleUsePhysicalCards}
        onBack={() => setScreen("mode")}
        onPreviewRules={() => onOpenRules(selectedEdition.id)}
      />
    );
  }

  if (screen === "digital-experience" && selectedEdition) {
   if (
     selectedEdition.id === "classic"
     || selectedEdition.id === "reracked"
     || selectedEdition.id === "sequential"
     || selectedEdition.id === "teed-off"
     || selectedEdition.id === "tournament"
   ) {
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
    <div className="pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {activeTab === "game" && currentPlayer && (
        <GameScreen
          players={turnOrderPlayers}
          currentPlayer={currentPlayer}
          currentHole={game.currentHole}
          scores={game.scores}
          isLeader={playerIsLeader}
          playMode={game.playMode}
          edition={activeEdition}
          totalHoles={totalHoles}
          leftHandedMode={game.settings.leftHandedMode}
          onPreviousPlayer={game.previousPlayer}
          onNextPlayer={game.nextPlayer}
          onUpdateScore={(score) => game.updateScore(currentPlayer.id, game.currentHole, score)}
          onNextCard={game.nextCard}
          onRemovePlayersAndAdvance={game.removePlayersAndAdvance}
          onUndo={game.undo}
          canUndo={true}
          onSetParForAll={(par) => game.setParForAllPlayers(game.currentHole, par)}
          onRecordSetupTime={game.recordSetupTime}
          onOpenRules={() => onOpenRules(activeEdition.id, true)}
        />
      )}

      {activeTab === "summary" && (
        <SummaryScreen
          players={game.players}
          scores={game.scores}
          currentHole={game.currentHole}
          totalHoles={totalHoles}
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
          onHome={handleHome}
        />
      )}

      <BottomNav activeTab={activeTab} isGameEnded={game.isComplete} onHome={handleHome} onTabChange={handleTabChange} />
    </div>
  );
}

function GameApp() {
  const game = useGame();
  const { toast } = useToast();
  const [rulesState, setRulesState] = useState<RulesState>(RULES_CLOSED);

  const saveForRules = () => {
    if (!game.autoSaveNow() && game.settings.autoSave && game.players.length > 0) {
      toast({
        title: "Couldn't save progress",
        description: "Your game is still in progress, but the automatic save failed.",
        variant: "destructive",
      });
    }
  };

  const handleOpenRules = (editionId?: EditionDefinition["id"], fromGame?: boolean) => {
    const next = openRules(rulesState, { editionId, fromGame });
    if (next.state === rulesState) return;
    if (next.save) saveForRules();
    setRulesState(next.state);
  };

  const handleCloseRules = () => {
    const next = closeRules(rulesState);
    if (next.save) saveForRules();
    setRulesState(next.state);
  };

  return (
    <>
      <GameScreens onOpenRules={handleOpenRules} />
      <RulesOverlay
        state={rulesState}
        onSelectEdition={(id) => setRulesState((prev) => selectRulesEdition(prev, id).state)}
        onClose={handleCloseRules}
      />
    </>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
}
