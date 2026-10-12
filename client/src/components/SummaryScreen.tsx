import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { AlertTriangle, BarChart3, Flag, ListOrdered, Skull, Star, Target, Trophy } from "lucide-react";
import type { Player, HoleScore } from "@shared/schema";
import {
  calculatePlayerTotal,
  calculateScoreVsPar,
  formatScoreVsPar,
  getBestHoleScore,
  getCompletedHoleScores,
  getCurrentHolePar,
  getHolesAtParOrBetter,
  getLeaderboard,
  getPlayerRank,
} from "@/lib/game-utils";
import { useTournament } from "@/contexts/TournamentContext";
import { cn } from "@/lib/utils";

interface SummaryScreenProps {
  players: Player[];
  scores: Record<string, HoleScore[]>;
  currentHole: number;
  totalHoles: number;
  onNewGame: () => void;
  onUpdateHoleScore?: (playerId: string, hole: number, strokes: number) => void;
  isGameOver?: boolean;
}

interface StatCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClassName?: string;
}

function StatCard({ icon: Icon, label, value, valueClassName }: StatCardProps) {
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
    </Card>
  );
}

function getScoreColorClass(scoreVsPar: number): string {
  if (scoreVsPar < 0) return "text-green-500";
  if (scoreVsPar > 0) return "text-red-500";
  return "text-foreground";
}

export function SummaryScreen({
  players,
  scores,
  currentHole,
  totalHoles,
  onUpdateHoleScore,
  isGameOver = false,
}: SummaryScreenProps) {
  const [activeTab, setActiveTab] = useState<"local" | "tournament">("local");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [showScorecard, setShowScorecard] = useState(false);
  const [editingScore, setEditingScore] = useState<{ playerId: string; hole: number; value: string } | null>(null);
  const tournament = useTournament();

  const leaderboard = useMemo(() => getLeaderboard(players, scores, 2), [players, scores]);
  const leader = leaderboard[0];
  const normalizedTotalHoles = Math.max(1, totalHoles);
  const boundedCurrentHole = Math.min(Math.max(1, currentHole), normalizedTotalHoles);
  const currentHolePar = getCurrentHolePar(scores, boundedCurrentHole);

  useEffect(() => {
    if (leaderboard.length === 0) {
      setSelectedPlayerId("");
      return;
    }

    setSelectedPlayerId((previous) => {
      const previousExists = leaderboard.some((entry) => entry.player.id === previous);
      if (previousExists) return previous;
      return leaderboard[0].player.id;
    });
  }, [leaderboard]);

  useEffect(() => {
    if (tournament.isConnected && activeTab === "tournament") {
      tournament.refreshLeaderboard();
      const interval = setInterval(() => {
        tournament.refreshLeaderboard();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [tournament.isConnected, activeTab]);

  useEffect(() => {
    if (!carouselApi) return;

    const selectedIndex = leaderboard.findIndex((entry) => entry.player.id === selectedPlayerId);
    if (selectedIndex >= 0) {
      carouselApi.scrollTo(selectedIndex);
    }
  }, [carouselApi, leaderboard, selectedPlayerId]);

  useEffect(() => {
    if (!carouselApi) return;

    const handleSelect = () => {
      const selectedIndex = carouselApi.selectedScrollSnap();
      const selectedEntry = leaderboard[selectedIndex];
      if (selectedEntry && selectedEntry.player.id !== selectedPlayerId) {
        setSelectedPlayerId(selectedEntry.player.id);
      }
    };

    carouselApi.on("select", handleSelect);
    return () => {
      carouselApi.off("select", handleSelect);
    };
  }, [carouselApi, leaderboard, selectedPlayerId]);

  const selectedPlayer = leaderboard.find((entry) => entry.player.id === selectedPlayerId)?.player || leader?.player || players[0];

  const allHoles = useMemo(() => {
    const playedHoles = Object.values(scores)
      .flat()
      .map((score) => score.hole);
    const maxHole = Math.max(normalizedTotalHoles, ...playedHoles, 1);
    return Array.from({ length: maxHole }, (_, index) => index + 1);
  }, [scores, normalizedTotalHoles]);

  const handleSaveScore = () => {
    if (!editingScore) return;
    const newValue = parseInt(editingScore.value, 10);
    if (Number.isNaN(newValue) || newValue < 0) return;
    onUpdateHoleScore?.(editingScore.playerId, editingScore.hole, newValue);
    setEditingScore(null);
  };

  if (activeTab === "tournament" && tournament.isConnected) {
    return (
      <div className="min-h-screen pb-20">
        <div className="p-4">
          <div className="mb-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setActiveTab("local")} data-testid="button-tab-local">
              My Group
            </Button>
            <Button className="flex-1" data-testid="button-tab-tournament">
              Tournament
            </Button>
          </div>

          <Card className="p-4">
            <h2 className="mb-3 text-xl font-bold">Live Leaderboard</h2>
            <div className="space-y-2">
              {tournament.leaderboard.map((entry, index) => (
                <div
                  key={entry.playerId}
                  className={cn(
                    "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border px-3 py-2",
                    index === 0 && "border-primary bg-primary/10",
                  )}
                >
                  <div className="w-8 text-center text-lg font-bold">{index + 1}</div>
                  <div>
                    <div className="truncate font-semibold">{entry.playerName}</div>
                    <div className="text-xs text-muted-foreground">{entry.holesCompleted} holes</div>
                  </div>
                  <div className={cn("text-right text-lg font-bold", getScoreColorClass(entry.relativeToPar))}>
                    {formatScoreVsPar(entry.relativeToPar)}
                  </div>
                </div>
              ))}
              {tournament.leaderboard.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No tournament scores yet.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const progressPercent = isGameOver ? 100 : Math.min(100, Math.round((boundedCurrentHole / normalizedTotalHoles) * 100));

  return (
    <>
      <div className="min-h-screen pb-20">
        <div className="p-4">
          {tournament.isConnected && (
            <div className="mb-4 flex gap-2">
              <Button className="flex-1" data-testid="button-tab-local">
                My Group
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setActiveTab("tournament")} data-testid="button-tab-tournament">
                Tournament
              </Button>
            </div>
          )}

          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-4xl font-black leading-tight">Session Summary</h2>
              {!isGameOver && (
                <p className="mt-1 text-lg text-muted-foreground">
                  Hole {boundedCurrentHole} of {normalizedTotalHoles} • Par {currentHolePar ?? "-"}
                </p>
              )}
            </div>
            {isGameOver ? (
              <div className="rounded-full border border-red-500 bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-400">
                GAME COMPLETE
              </div>
            ) : (
              <div className="relative min-w-24 overflow-hidden rounded-full border border-primary/50 bg-primary/10 px-3 py-1.5">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary/25 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
                <div className="relative flex items-center justify-center text-sm font-semibold text-primary">
                  {progressPercent}%
                </div>
              </div>
            )}
          </div>

          {!isGameOver && (
            <div className="mb-4 h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          )}

          {isGameOver && leader && (
            <Card className="mb-4 border-yellow-500/50 bg-yellow-500/10 p-4">
              <div className="flex items-center gap-2 text-2xl font-bold">
                <Trophy className="h-6 w-6 text-yellow-400" />
                <span>
                  Winner: <span style={{ color: leader.player.color }}>{leader.player.name}</span>
                </span>
              </div>
            </Card>
          )}

          <Card className="mb-4 p-4">
            <h3 className="mb-3 text-2xl font-bold">{isGameOver ? "Final Leaderboard" : "Leaderboard"}</h3>
            <div className="mb-2 grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 text-xs uppercase text-muted-foreground">
              <div>#</div>
              <div>Player</div>
              <div className="text-right">Total</div>
              <div className="text-right">+/- Par</div>
            </div>
            <div className="space-y-2">
              {leaderboard.map((entry, index) => {
                const entryScoreVsPar = calculateScoreVsPar(scores[entry.player.id] || []);
                const isLeaderEntry = index === 0;
                const isSelected = selectedPlayer?.id === entry.player.id;

                return (
                  <button
                    key={entry.player.id}
                    type="button"
                    className={cn(
                      "grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-lg border px-3 py-2 text-left",
                      isLeaderEntry && "border-primary bg-primary/10",
                      isGameOver && isLeaderEntry && "border-yellow-500/60 bg-yellow-500/10",
                      isSelected && "ring-1 ring-primary",
                    )}
                    onClick={() => setSelectedPlayerId(entry.player.id)}
                    data-testid={`leaderboard-${entry.player.id}`}
                  >
                    <div className="w-5 text-sm font-bold">{index + 1}</div>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: entry.player.color }} />
                      <span className="truncate text-xl font-bold">{entry.player.name}</span>
                    </div>
                    <div className="text-right text-2xl font-bold">{entry.total}</div>
                    <div className={cn("text-right text-2xl font-bold", getScoreColorClass(entryScoreVsPar))}>
                      {formatScoreVsPar(entryScoreVsPar)}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {selectedPlayer && (
            <Card className="mb-4 overflow-hidden p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-2xl font-bold">
                  <span className="h-5 w-5 rounded-full" style={{ backgroundColor: selectedPlayer.color }} />
                  <span>{isGameOver ? "Performance Breakdown" : "Player Stats"} ({selectedPlayer.name})</span>
                </h3>
                <div className="rounded-full border border-border bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground">
                  {leaderboard.length > 1 ? "Swipe" : "Player"}
                </div>
              </div>

              <div className="mb-3 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span>Swipe to view other players</span>
                </div>
              </div>

              <Carousel
                opts={{ align: "start", loop: false, dragFree: false }}
                setApi={setCarouselApi}
                className="mb-3"
              >
                <CarouselContent>
                  {leaderboard.map((entry) => {
                    const playerScores = scores[entry.player.id] || [];
                    const playerTotal = calculatePlayerTotal(playerScores);
                    const playerScoreVsPar = calculateScoreVsPar(playerScores);
                    const playerRank = getPlayerRank(entry.player.id, players, scores);
                    const playerCompletedHoles = getCompletedHoleScores(playerScores).length;
                    const playerBestHole = getBestHoleScore(playerScores);
                    const playerParOrBetter = getHolesAtParOrBetter(playerScores);

                    return (
                      <CarouselItem key={entry.player.id} className="pl-0">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-lg font-bold text-foreground">
                            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: entry.player.color }} />
                            <span>{entry.player.name}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <StatCard icon={Trophy} label="Total Strokes" value={playerTotal.totalStrokes.toString()} />
                            <StatCard
                              icon={Flag}
                              label="Score vs Par"
                              value={formatScoreVsPar(playerScoreVsPar)}
                              valueClassName={getScoreColorClass(playerScoreVsPar)}
                            />
                            <StatCard icon={BarChart3} label={isGameOver ? "Final Rank" : "Current Rank"} value={playerRank ? `#${playerRank}` : "-"} />
                            <StatCard icon={ListOrdered} label="Holes Played" value={`${playerCompletedHoles} / ${normalizedTotalHoles}`} />
                            <StatCard icon={Skull} label="Scratches" value={playerTotal.totalScratches.toString()} />
                            <StatCard icon={AlertTriangle} label="Penalties" value={playerTotal.totalPenalties.toString()} />
                            <StatCard icon={Star} label="Best Hole" value={playerBestHole !== null ? playerBestHole.toString() : "-"} />
                            <StatCard
                              icon={Target}
                              label="At Par or Better"
                              value={`${playerParOrBetter.atParOrBetter} / ${playerParOrBetter.completedHoles}`}
                            />
                          </div>
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
              </Carousel>

              <div className="flex items-center justify-center gap-2">
                {leaderboard.map((entry, index) => (
                  <button
                    key={entry.player.id}
                    type="button"
                    aria-label={`View ${entry.player.name} stats`}
                    onClick={() => setSelectedPlayerId(entry.player.id)}
                    className={cn(
                      "h-2.5 rounded-full transition-all duration-200",
                      selectedPlayerId === entry.player.id ? "w-8 bg-primary" : "w-2.5 bg-muted-foreground/40",
                    )}
                  />
                ))}
              </div>
            </Card>
          )}

          <Card className="p-3">
            <Button variant="ghost" className="w-full justify-between px-2 text-left text-xl font-bold" onClick={() => setShowScorecard((prev) => !prev)}>
              View Scorecard
              <span className={cn("transition-transform", showScorecard && "rotate-90")}>›</span>
            </Button>
            {showScorecard && (
              <div className="mt-3 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Player</TableHead>
                      {allHoles.map((hole) => (
                        <TableHead key={hole} className="min-w-[48px] text-center">
                          H{hole}
                        </TableHead>
                      ))}
                      <TableHead className="text-center">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((entry) => {
                      const playerScores = scores[entry.player.id] || [];

                      return (
                        <TableRow key={entry.player.id}>
                          <TableCell className="font-semibold">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.player.color }} />
                              <span className="truncate">{entry.player.name}</span>
                            </div>
                          </TableCell>
                          {allHoles.map((hole) => {
                            const holeScore = playerScores.find((score) => score.hole === hole);
                            const holeComplete = holeScore && holeScore.par > 0 && holeScore.strokes > 0;
                            const diff = holeComplete
                              ? holeScore.strokes + holeScore.scratches + holeScore.penalties - holeScore.par
                              : 0;

                            return (
                              <TableCell
                                key={hole}
                                className={cn(
                                  "text-center",
                                  onUpdateHoleScore && holeScore && "cursor-pointer hover:bg-muted/40",
                                  holeComplete && diff < 0 && "text-green-500",
                                  holeComplete && diff > 0 && "text-red-500",
                                )}
                                onClick={() => {
                                  if (!onUpdateHoleScore || !holeScore) return;
                                  setEditingScore({
                                    playerId: entry.player.id,
                                    hole,
                                    value: holeScore.strokes.toString(),
                                  });
                                }}
                              >
                                {holeComplete ? holeScore.strokes : "-"}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold">{entry.total}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <AlertDialog open={editingScore !== null} onOpenChange={(open) => !open && setEditingScore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Score</AlertDialogTitle>
            <AlertDialogDescription>{editingScore ? `Enter new strokes for Hole ${editingScore.hole}.` : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          {editingScore && (
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={editingScore.value}
              onChange={(event) => setEditingScore({ ...editingScore, value: event.target.value })}
              data-testid="input-edit-score"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-edit">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveScore} data-testid="button-save-score">
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
