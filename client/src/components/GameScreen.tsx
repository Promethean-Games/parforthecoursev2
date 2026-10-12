import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Eye, Undo2 } from "lucide-react";
import type { Player, HoleScore, SetupTime } from "@shared/schema";
import { PAR_OPTIONS, LEADER_ICON_URL } from "@/lib/constants";
import { getScoreCallout } from "@/lib/game-utils";
import { cn } from "@/lib/utils";
import { DrawDialog } from "./DrawDialog";
import { DigitalDrawDialog } from "./DigitalDrawDialog";
import { TableSetupDialog } from "./TableSetupDialog";
import { useTournament } from "@/contexts/TournamentContext";
import type { EditionDefinition } from "@/lib/editions";
import type { PlayMode } from "@/lib/play-mode";

interface GameScreenProps {
  players: Player[];
  currentPlayer: Player;
  currentHole: number;
  scores: Record<string, HoleScore[]>;
  isLeader: boolean;
  playMode: PlayMode;
  edition?: EditionDefinition;
  totalHoles?: number;
  leftHandedMode?: boolean;
  onPreviousPlayer: () => void;
  onNextPlayer: () => void;
  onUpdateScore: (score: Partial<HoleScore>) => void;
  onNextCard: () => void;
  onRemovePlayersAndAdvance: (ids: string[]) => void;
  onUndo: () => void;
  canUndo: boolean;
  onSetParForAll: (par: number) => void;
  onRecordSetupTime: (setupTime: SetupTime) => void;
}

export function GameScreen({
  players,
  currentPlayer,
  currentHole,
  scores,
  isLeader,
  playMode,
  edition,
  totalHoles = 18,
  leftHandedMode = false,
  onPreviousPlayer,
  onNextPlayer,
  onUpdateScore,
  onNextCard,
  onRemovePlayersAndAdvance,
  onUndo,
  canUndo,
  onSetParForAll,
  onRecordSetupTime,
}: GameScreenProps) {
  interface DigitalCard {
    id: string;
    imageSrc: string;
    label: string;
    par: number | null;
  }

  const cardAssetPath = (fileName: string) => `${import.meta.env.BASE_URL}cards/${fileName}`;
  const createClassicDeck = (): DigitalCard[] => [
    { id: "2-01", imageSrc: cardAssetPath("2-01.png"), label: "Par 2", par: 2 },
    { id: "2-02", imageSrc: cardAssetPath("2-02.png"), label: "Par 2", par: 2 },
    { id: "2-03", imageSrc: cardAssetPath("2-03.png"), label: "Par 2", par: 2 },
    { id: "3-01", imageSrc: cardAssetPath("3-01.png"), label: "Par 3", par: 3 },
    { id: "3-02", imageSrc: cardAssetPath("3-02.png"), label: "Par 3", par: 3 },
    { id: "3-03", imageSrc: cardAssetPath("3-03.png"), label: "Par 3", par: 3 },
    { id: "3-04", imageSrc: cardAssetPath("3-04.png"), label: "Par 3", par: 3 },
    { id: "4-01", imageSrc: cardAssetPath("4-01.png"), label: "Par 4", par: 4 },
    { id: "4-02", imageSrc: cardAssetPath("4-02.png"), label: "Par 4", par: 4 },
    { id: "4-03", imageSrc: cardAssetPath("4-03.png"), label: "Par 4", par: 4 },
    { id: "4-04", imageSrc: cardAssetPath("4-04.png"), label: "Par 4", par: 4 },
    { id: "4-05", imageSrc: cardAssetPath("4-05.png"), label: "Par 4", par: 4 },
    { id: "5-01", imageSrc: cardAssetPath("5-01.png"), label: "Par 5", par: 5 },
    { id: "5-02", imageSrc: cardAssetPath("5-02.png"), label: "Par 5", par: 5 },
    { id: "5-03", imageSrc: cardAssetPath("5-03.png"), label: "Par 5", par: 5 },
    { id: "6-01", imageSrc: cardAssetPath("6-01.png"), label: "Par 6", par: 6 },
    { id: "joker-01", imageSrc: cardAssetPath("joker.png"), label: "Joker", par: null },
    { id: "joker-02", imageSrc: cardAssetPath("joker.png"), label: "Joker", par: null },
  ];
  const createRerackedDeck = (): DigitalCard[] => [
    { id: "2-01", imageSrc: cardAssetPath("reracked/2-01.png"), label: "Par 2", par: 2 },
    { id: "3-01", imageSrc: cardAssetPath("reracked/3-01.png"), label: "Par 3", par: 3 },
    { id: "3-02", imageSrc: cardAssetPath("reracked/3-02.png"), label: "Par 3", par: 3 },
    { id: "3-03", imageSrc: cardAssetPath("reracked/3-03.png"), label: "Par 3", par: 3 },
    { id: "4-01", imageSrc: cardAssetPath("reracked/4-01.png"), label: "Par 4", par: 4 },
    { id: "4-02", imageSrc: cardAssetPath("reracked/4-02.png"), label: "Par 4", par: 4 },
    { id: "4-03", imageSrc: cardAssetPath("reracked/4-03.png"), label: "Par 4", par: 4 },
    { id: "4-04", imageSrc: cardAssetPath("reracked/4-04.png"), label: "Par 4", par: 4 },
    { id: "4-05", imageSrc: cardAssetPath("reracked/4-05.png"), label: "Par 4", par: 4 },
    { id: "5-01", imageSrc: cardAssetPath("reracked/5-01.png"), label: "Par 5", par: 5 },
    { id: "5-02", imageSrc: cardAssetPath("reracked/5-02.png"), label: "Par 5", par: 5 },
    { id: "6-01", imageSrc: cardAssetPath("reracked/6-01.png"), label: "Par 6", par: 6 },
    { id: "6-02", imageSrc: cardAssetPath("reracked/6-02.png"), label: "Par 6", par: 6 },
    { id: "6-03", imageSrc: cardAssetPath("reracked/6-03.png"), label: "Par 6", par: 6 },
    { id: "7-01", imageSrc: cardAssetPath("reracked/7-01.png"), label: "Par 7", par: 7 },
    { id: "7-02", imageSrc: cardAssetPath("reracked/7-02.png"), label: "Par 7", par: 7 },
    { id: "joker-01", imageSrc: cardAssetPath("reracked/joker-01.png"), label: "Joker", par: null },
    { id: "joker-02", imageSrc: cardAssetPath("reracked/joker-02.png"), label: "Joker", par: null },
  ];
  const createSequentialDeck = (): DigitalCard[] => [
    { id: "SEQ-C-03_01", imageSrc: cardAssetPath("sequential/SEQ-C-03_01.png"), label: "Par 3", par: 3 },
    { id: "SEQ-C-03_02", imageSrc: cardAssetPath("sequential/SEQ-C-03_02.png"), label: "Par 3", par: 3 },
    { id: "SEQ-C-03_03", imageSrc: cardAssetPath("sequential/SEQ-C-03_03.png"), label: "Par 3", par: 3 },
    { id: "SEQ-C-03_04", imageSrc: cardAssetPath("sequential/SEQ-C-03_04.png"), label: "Par 3", par: 3 },
    { id: "SEQ-C-04_01", imageSrc: cardAssetPath("sequential/SEQ-C-04_01.png"), label: "Par 4", par: 4 },
    { id: "SEQ-C-04_02", imageSrc: cardAssetPath("sequential/SEQ-C-04_02.png"), label: "Par 4", par: 4 },
    { id: "SEQ-C-04_03", imageSrc: cardAssetPath("sequential/SEQ-C-04_03.png"), label: "Par 4", par: 4 },
    { id: "SEQ-C-04_04", imageSrc: cardAssetPath("sequential/SEQ-C-04_04.png"), label: "Par 4", par: 4 },
    { id: "SEQ-C-04_05", imageSrc: cardAssetPath("sequential/SEQ-C-04_05.png"), label: "Par 4", par: 4 },
    { id: "SEQ-C-05_01", imageSrc: cardAssetPath("sequential/SEQ-C-05_01.png"), label: "Par 5", par: 5 },
    { id: "SEQ-C-05_02", imageSrc: cardAssetPath("sequential/SEQ-C-05_02.png"), label: "Par 5", par: 5 },
    { id: "SEQ-C-05_03", imageSrc: cardAssetPath("sequential/SEQ-C-05_03.png"), label: "Par 5", par: 5 },
    { id: "SEQ-C-06_01", imageSrc: cardAssetPath("sequential/SEQ-C-06_01.png"), label: "Par 6", par: 6 },
    { id: "SEQ-C-06_02", imageSrc: cardAssetPath("sequential/SEQ-C-06_02.png"), label: "Par 6", par: 6 },
    { id: "SEQ-C-07_01", imageSrc: cardAssetPath("sequential/SEQ-C-07_01.png"), label: "Par 7", par: 7 },
    { id: "SEQ-C-07_02", imageSrc: cardAssetPath("sequential/SEQ-C-07_02.png"), label: "Par 7", par: 7 },
    { id: "SEQ-C-08_01", imageSrc: cardAssetPath("sequential/SEQ-C-08_01.png"), label: "Par 8", par: 8 },
    { id: "SEQ-C-09_01", imageSrc: cardAssetPath("sequential/SEQ-C-09_01.png"), label: "Par 9", par: 9 },
  ];
  const createDeckForEdition = (editionId: EditionDefinition["id"]): DigitalCard[] => {
    switch (editionId) {
      case "sequential":
        return createSequentialDeck();
      case "reracked":
        return createRerackedDeck();
      case "classic":
      default:
        return createClassicDeck();
    }
  };
  const shuffleDeck = (cards: DigitalCard[]): DigitalCard[] => {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const [showDrawDialog, setShowDrawDialog] = useState(false);
  const [showTableSetupDialog, setShowTableSetupDialog] = useState(false);
  const [pendingPar, setPendingPar] = useState<number | null>(null);
  const [drawConfirmTime, setDrawConfirmTime] = useState<number | null>(null);
  const [isJokerDraw, setIsJokerDraw] = useState(false);
  const [showAdvanceBlockedDialog, setShowAdvanceBlockedDialog] = useState(false);
  const [showRemovePlayersConfirmation, setShowRemovePlayersConfirmation] = useState(false);
  const [showCoursePreview, setShowCoursePreview] = useState(false);
  const [digitalDrawPile, setDigitalDrawPile] = useState<DigitalCard[]>([]);
  const [digitalDrawsByHole, setDigitalDrawsByHole] = useState<Record<number, DigitalCard>>({});
  const [lastHole, setLastHole] = useState(currentHole);
  const isInitialMount = useRef(true);
  const lastPlayerId = useRef(currentPlayer.id);
  const tournament = useTournament();
  const isDigitalDeckEdition = playMode === "digital" && !!edition && (edition.id === "classic" || edition.id === "reracked" || edition.id === "sequential");

  useEffect(() => {
    if (!isDigitalDeckEdition || !edition) return;
    setDigitalDrawPile(shuffleDeck(createDeckForEdition(edition.id)));
    setDigitalDrawsByHole({});
  }, [isDigitalDeckEdition, edition?.id]);
  
  // Swipe gesture handling
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      onNextPlayer();
    } else if (isRightSwipe) {
      onPreviousPlayer();
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };
  
  const currentScore = scores[currentPlayer.id]?.find((s) => s.hole === currentHole) || {
    hole: currentHole,
    par: 0,
    strokes: 0,
    scratches: 0,
    penalties: 0,
  };

  const [par, setPar] = useState(currentScore.par || 0);
  const [strokes, setStrokes] = useState(currentScore.strokes || 0);
  const [scratches, setScratches] = useState(currentScore.scratches || 0);
  const [penalties, setPenalties] = useState(currentScore.penalties || 0);

  // Show DRAW dialog when hole changes
  useEffect(() => {
    if (currentHole !== lastHole) {
      setLastHole(currentHole);
      // Check if par is already set for this hole
      const existingPar = scores[currentPlayer.id]?.find((s) => s.hole === currentHole)?.par;
      if (!existingPar || existingPar === 0) {
        setShowDrawDialog(true);
      }
    }
  }, [currentHole, lastHole, scores, currentPlayer.id]);

  // Show DRAW dialog on initial load if no par set
  useEffect(() => {
    if (currentScore.par === 0) {
      setShowDrawDialog(true);
    }
  }, []);

  useEffect(() => {
    // Track player changes to avoid updating score during player switch
    if (currentPlayer.id !== lastPlayerId.current) {
      lastPlayerId.current = currentPlayer.id;
      isInitialMount.current = true;
    }
    setPar(currentScore.par || 0);
    setStrokes(currentScore.strokes || 0);
    setScratches(currentScore.scratches || 0);
    setPenalties(currentScore.penalties || 0);
  }, [currentPlayer.id, currentHole, currentScore]);

  useEffect(() => {
    // Skip the initial mount and player switches to avoid double updates
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onUpdateScore({ par, strokes, scratches, penalties });
  }, [par, strokes, scratches, penalties]);

  // Sync scores to tournament server when connected (only on meaningful changes)
  const lastSyncedScore = useRef<string>("");
  
  useEffect(() => {
    if (!tournament.isConnected || isInitialMount.current || par === 0) return;
    
    // Find matching tournament player by name (case-insensitive)
    const tournamentPlayer = tournament.myPlayers.find(
      tp => tp.playerName.toLowerCase().trim() === currentPlayer.name.toLowerCase().trim()
    );
    
    if (!tournamentPlayer) return;
    
    // Create a score key to avoid duplicate syncs
    const scoreKey = `${tournamentPlayer.id}-${currentHole}-${par}-${strokes}-${scratches}-${penalties}`;
    if (scoreKey === lastSyncedScore.current) return;
    
    // Debounce: only sync when strokes > 0 (hole has been played)
    if (strokes > 0) {
      lastSyncedScore.current = scoreKey;
      tournament.syncScore(
        tournamentPlayer.id,
        currentHole,
        par,
        strokes,
        scratches,
        penalties
      );
    }
  }, [par, strokes, scratches, penalties, tournament.isConnected, currentHole, currentPlayer.name, tournament.myPlayers]);

  const playerStats = (scores[currentPlayer.id] || []).reduce((acc, score) => ({
    scratches: acc.scratches + score.scratches,
    strokes: acc.strokes + score.strokes + score.scratches + score.penalties,
    penalties: acc.penalties + score.penalties,
  }), { scratches: 0, strokes: 0, penalties: 0 });

  const handleMercy = () => {
    if (par > 0) {
      setStrokes(par + 5);
      setTimeout(() => onNextCard(), 300);
    }
  };

  const handleDrawPar = (selectedPar: number) => {
    // Store the selected par and start timing
    setPendingPar(selectedPar);
    setDrawConfirmTime(Date.now());
    setShowDrawDialog(false);
    // Show table setup dialog (except for first hole where table isn't set up yet)
    if (currentHole === 1) {
      // First hole - apply par immediately without table setup confirmation
      onSetParForAll(selectedPar);
      setPar(selectedPar);
    } else {
      // Subsequent holes - show table setup confirmation
      setShowTableSetupDialog(true);
    }
  };

  const handleTableReady = () => {
    if (pendingPar !== null && drawConfirmTime !== null) {
      const setupTimeMs = Date.now() - drawConfirmTime;
      // Record the setup time
      onRecordSetupTime({
        hole: currentHole,
        par: pendingPar,
        setupTimeMs,
        timestamp: new Date().toISOString(),
      });
      // Apply the par
      onSetParForAll(pendingPar);
      setPar(pendingPar);
    }
    // Reset state
    setPendingPar(null);
    setDrawConfirmTime(null);
    setShowTableSetupDialog(false);
  };

  const handleDigitalReady = (drawnCard: DigitalCard, jokerPar?: number) => {
    if (!drawnCard) return;

    setDigitalDrawsByHole((prev) => ({ ...prev, [currentHole]: drawnCard }));
    setDigitalDrawPile((prev) => prev.filter((card) => card.id !== drawnCard.id));

    const selectedPar = drawnCard.par ?? jokerPar;
    if (typeof selectedPar === "number") {
      onSetParForAll(selectedPar);
      setPar(selectedPar);
    }
    setShowDrawDialog(false);
  };

  // Check if all players have non-zero scores for current hole
  const allPlayersHaveScores = players.every((player) => {
    const playerScore = scores[player.id]?.find((s) => s.hole === currentHole);
    return playerScore && playerScore.strokes > 0;
  });

  const canAdvance = par > 0 && strokes > 0 && allPlayersHaveScores;

  const playersMissingScores = players.filter((player) => {
    const playerScore = scores[player.id]?.find((s) => s.hole === currentHole);
    return !playerScore || playerScore.strokes === 0;
  });
  const shootersRemaining = playersMissingScores.length;
  const playerInfo = `${shootersRemaining} player${shootersRemaining !== 1 ? "s" : ""} remaining`;
  const removablePlayerIds = playersMissingScores.map((player) => player.id);
  const canRemovePlayers = removablePlayerIds.length > 0 && removablePlayerIds.length < players.length;
  const currentHoleCard = isDigitalDeckEdition ? digitalDrawsByHole[currentHole] ?? null : null;
  const currentHolePreviewLabel = currentHoleCard?.par === null
    ? `Joker - Par ${par || "?"}`
    : currentHoleCard?.label ?? "";

  const handleNextCard = () => {
    if (!canAdvance) {
      setShowAdvanceBlockedDialog(true);
      return;
    }

    setIsJokerDraw(false);
    onNextCard();
  };

  const handleRemovePlayers = () => {
    if (!canRemovePlayers) return;

    setShowAdvanceBlockedDialog(false);
    setShowRemovePlayersConfirmation(true);
  };

  const handleConfirmRemovePlayers = () => {
    if (!canRemovePlayers) return;

    setShowRemovePlayersConfirmation(false);
    setIsJokerDraw(false);
    onRemovePlayersAndAdvance(removablePlayerIds);
  };

  return (
    <div 
      className={cn("flex flex-col min-h-screen p-4 pb-6", leftHandedMode && "left-handed")}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Player Navigation */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          size="icon"
          variant="outline"
          onClick={onPreviousPlayer}
          className="w-20 h-11 text-xl"
          data-testid="button-prev-player"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        
        <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border" style={{
          borderColor: currentPlayer.color,
          borderWidth: "2px"
        }}>
          {isLeader && (
            <img src={LEADER_ICON_URL} alt="Leader" className="w-5 h-5" data-testid="img-leader" />
          )}
          <span className="text-2xl font-bold" data-testid="text-player-name">{currentPlayer.name}</span>
        </div>
        
        <Button
          size="icon"
          variant="outline"
          onClick={onNextPlayer}
          className="w-20 h-11 text-xl"
          data-testid="button-next-player"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-xs uppercase text-muted-foreground font-semibold">Scratches</div>
          <div className="text-2xl font-bold" data-testid="text-scratches">{playerStats.scratches}</div>
        </div>
        <div className="text-center">
          <div className="text-xs uppercase text-muted-foreground font-semibold">Total Strokes</div>
          <div className="text-2xl font-bold" data-testid="text-total-strokes">{playerStats.strokes}</div>
        </div>
        <div className="text-center">
          <div className="text-xs uppercase text-muted-foreground font-semibold">Penalties</div>
          <div className="text-2xl font-bold" data-testid="text-penalties">{playerStats.penalties}</div>
        </div>
      </div>

      <div className="h-0.5 mb-4" style={{ backgroundColor: currentPlayer.color }} />

      {/* Hole & Shooters Remaining */}
      <div className="flex justify-between items-start mb-3">
        <div className="text-lg font-bold" data-testid="text-hole">Hole {currentHole}</div>
        <div className={cn("flex flex-col items-end gap-2", leftHandedMode && "items-start")}>
          <div className="text-sm text-muted-foreground" data-testid="text-players-remaining">{playerInfo}</div>
          {currentHoleCard && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-xs font-semibold"
              onClick={() => setShowCoursePreview(true)}
              data-testid="button-view-hole"
            >
              <Eye className="h-4 w-4" />
              View Hole
            </Button>
          )}
        </div>
      </div>

      {/* Par Selection */}
      <div className={cn("flex items-center gap-3 mb-3", leftHandedMode && "flex-row-reverse")}>
        <label htmlFor="par-select" className="text-base font-medium">Par:</label>
        <Select value={par > 0 ? par.toString() : ""} onValueChange={(v) => setPar(parseInt(v))}>
          <SelectTrigger className="w-32 h-11" id="par-select" data-testid="select-par">
            <SelectValue placeholder="--" />
          </SelectTrigger>
          <SelectContent>
            {PAR_OPTIONS.map((p) => (
              <SelectItem key={p} value={p.toString()}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {par > 0 && strokes >= par + 5 && (
          <Button
            variant="outline"
            onClick={handleMercy}
            className="h-11 px-4"
            data-testid="button-mercy"
          >
            Mercy (+5)
          </Button>
        )}
      </div>

      {/* Scratch & Penalty */}
      <div className={cn("flex gap-3 mb-4", leftHandedMode && "flex-row-reverse")}>
        <Button
          variant="destructive"
          className="flex-1 h-12"
          onClick={() => setScratches(scratches + 1)}
          data-testid="button-scratch"
        >
          Scratch (+1)
        </Button>
        <Button
          variant="destructive"
          className="flex-1 h-12"
          onClick={() => setPenalties(penalties + 1)}
          data-testid="button-penalty"
        >
          Penalty (+1)
        </Button>
      </div>

      {/* Score Display & Controls */}
      <div className={cn("flex gap-4 items-center mb-4", leftHandedMode && "flex-row-reverse")}>
        <div className="flex-1 text-center">
          <div className="text-8xl font-extrabold leading-none" data-testid="text-score">
            {strokes + scratches + penalties}
          </div>
          {(scratches > 0 || penalties > 0) && (
            <div className="text-xs text-muted-foreground" data-testid="text-score-breakdown">
              {strokes} + {scratches > 0 && `${scratches}S`}{scratches > 0 && penalties > 0 && " + "}{penalties > 0 && `${penalties}P`}
            </div>
          )}
          <div className="text-sm font-bold min-h-[20px] mt-1" data-testid="text-callout">
            {par > 0 && strokes > 0 && getScoreCallout(strokes + scratches + penalties, par)}
          </div>
        </div>
        <div className="flex flex-col gap-3 w-28">
          <Button
            className="h-20 text-3xl"
            onClick={() => setStrokes(Math.max(0, strokes + 1))}
            data-testid="button-score-plus"
          >
            ▲
          </Button>
          <Button
            className="h-20 text-3xl"
            onClick={() => setStrokes(Math.max(0, strokes - 1))}
            data-testid="button-score-minus"
          >
            ▼
          </Button>
        </div>
      </div>

      {/* Undo & Next Card */}
      <div className={cn("flex gap-3", leftHandedMode && "flex-row-reverse")}>
        <Button
          variant="destructive"
          className="flex-1 h-12 text-base"
          onClick={onUndo}
          disabled={!canUndo}
          data-testid="button-undo"
        >
          <Undo2 className="w-5 h-5 mr-2" />
          Undo
        </Button>
        <Button
          className={cn(
            "flex-1 h-12 text-base",
            canAdvance
              ? "next-card-button-ready"
              : "cursor-not-allowed opacity-50",
          )}
          onClick={handleNextCard}
          aria-disabled={!canAdvance}
          data-testid="button-next-card"
        >
          Next Card
        </Button>
      </div>

      {showDrawDialog && (
        isDigitalDeckEdition ? (
          <DigitalDrawDialog
            cards={digitalDrawPile.slice(0, Math.min(5, Math.max(1, totalHoles - currentHole + 1)))}
            playerName={currentPlayer.name}
            onReady={handleDigitalReady}
          />
        ) : (
          <DrawDialog
            onSelectPar={handleDrawPar}
            onClose={() => setShowDrawDialog(false)}
            isFirstDraw={currentHole === 1}
            isJoker={isJokerDraw}
          />
        )
      )}

      {showTableSetupDialog && pendingPar !== null && (
        <TableSetupDialog
          hole={currentHole}
          par={pendingPar}
          onConfirm={handleTableReady}
        />
      )}

      <AlertDialog open={showAdvanceBlockedDialog} onOpenChange={setShowAdvanceBlockedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish this hole first</AlertDialogTitle>
            <AlertDialogDescription>
              {canRemovePlayers
                ? "Some players have not recorded a score for this hole. Remove them and continue, or cancel to return to the game."
                : "At least one player needs a recorded score before you can remove anyone and continue to the next card."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {playersMissingScores.length > 0 && (
            <div className="space-y-2">
              {playersMissingScores.map((player) => (
                <div
                  key={player.id}
                  className="rounded-md bg-muted/50 px-3 py-2 text-sm font-medium"
                >
                  {player.name}
                </div>
              ))}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-next-card-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemovePlayers}
              disabled={!canRemovePlayers}
              data-testid="button-next-card-remove-players"
            >
              Remove Players
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRemovePlayersConfirmation} onOpenChange={setShowRemovePlayersConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm player removal</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Removed players will be scored null for all future
              holes, which may negatively affect game statistics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {playersMissingScores.length > 0 && (
            <div className="space-y-2">
              {playersMissingScores.map((player) => (
                <div
                  key={player.id}
                  className="rounded-md bg-muted/50 px-3 py-2 text-sm font-medium"
                >
                  {player.name}
                </div>
              ))}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-remove-players-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemovePlayers}
              data-testid="button-confirm-remove-players"
            >
              Remove Players
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showCoursePreview} onOpenChange={setShowCoursePreview}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hole {currentHole} Preview</DialogTitle>
            <DialogDescription>{currentHolePreviewLabel}</DialogDescription>
          </DialogHeader>
          {currentHoleCard && (
            <div className="space-y-4">
              <img
                src={currentHoleCard.imageSrc}
                alt={`Hole ${currentHole} course card`}
                className="mx-auto max-h-[60vh] rounded-xl object-contain shadow-lg"
                data-testid="img-hole-preview"
              />
              <DialogClose asChild>
                <Button variant="outline" className="w-full" data-testid="button-close-hole-preview">
                  Close
                </Button>
              </DialogClose>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
