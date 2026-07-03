import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Trophy, Users, RefreshCw, Smartphone } from "lucide-react";
import type { Player, HoleScore } from "@shared/schema";
import { calculatePlayerTotal, getLeaderboard } from "@/lib/game-utils";
import { useTournament } from "@/contexts/TournamentContext";
import { cn } from "@/lib/utils";

interface SummaryScreenProps {
  players: Player[];
  scores: Record<string, HoleScore[]>;
  onNewGame: () => void;
  onSubmitToSheets?: () => void;
  isGameOver?: boolean;
}

export function SummaryScreen({ players, scores, onNewGame, onSubmitToSheets, isGameOver = false }: SummaryScreenProps) {
  const [isLandscape, setIsLandscape] = useState(false);
  const [activeTab, setActiveTab] = useState<"local" | "tournament">("local");
  const [showLandscapeHint, setShowLandscapeHint] = useState(false);
  const [editingScore, setEditingScore] = useState<{ playerId: string; hole: number; value: string } | null>(null);
  const [localScores, setLocalScores] = useState<Record<string, HoleScore[]>>(scores);
  const tournament = useTournament();
  
  useEffect(() => {
    const checkOrientation = () => {
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, []);

  // Show landscape hint on first mount when in portrait
  useEffect(() => {
    if (!isLandscape && !localStorage.getItem("landscapeHintShown")) {
      setShowLandscapeHint(true);
      localStorage.setItem("landscapeHintShown", "true");
    }
  }, []);

  useEffect(() => {
    if (tournament.isConnected && activeTab === "tournament") {
      tournament.refreshLeaderboard();
      const interval = setInterval(() => {
        tournament.refreshLeaderboard();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [tournament.isConnected, activeTab]);

  const handleEditScore = (playerId: string, hole: number, currentValue: number) => {
    setEditingScore({ playerId, hole, value: currentValue.toString() });
  };

  const handleSaveScore = () => {
    if (!editingScore) return;
    const newValue = parseInt(editingScore.value);
    if (isNaN(newValue) || newValue < 0) return;

    const updated = { ...localScores };
    const playerScores = updated[editingScore.playerId] || [];
    const scoreIndex = playerScores.findIndex(s => s.hole === editingScore.hole);

    if (scoreIndex >= 0) {
      playerScores[scoreIndex] = {
        ...playerScores[scoreIndex],
        strokes: newValue,
      };
    } else {
      // Create new score entry
      const par = playerScores.find(s => s.hole === editingScore.hole)?.par || 3;
      playerScores.push({
        hole: editingScore.hole,
        par,
        strokes: newValue,
        scratches: 0,
        penalties: 0,
      });
    }

    updated[editingScore.playerId] = playerScores;
    setLocalScores(updated);
    setEditingScore(null);
  };

  const leaderboard = getLeaderboard(players, localScores);
  const leader = leaderboard[0];

  const allHoles = Array.from(
    new Set(
      Object.values(localScores)
        .flat()
        .map((s) => s.hole)
    )
  ).sort((a, b) => a - b);

  return (
    <div className="flex flex-col min-h-screen p-6 pb-8">
      <h1 className="text-3xl font-bold text-center mb-2">Session Summary</h1>
      
      {leader && activeTab === "local" && (
        <p className="text-center text-muted-foreground mb-4">
          {isGameOver ? "Winner" : "Leader"}: <span className="font-bold" style={{ color: leader.player.color }}>{leader.player.name}</span> ({leader.total} strokes)
        </p>
      )}

      {/* Tab Switcher for Tournament Mode */}
      {tournament.isConnected && (
        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === "local" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setActiveTab("local")}
            data-testid="button-tab-local"
          >
            <Users className="w-4 h-4 mr-2" />
            My Group
          </Button>
          <Button
            variant={activeTab === "tournament" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setActiveTab("tournament")}
            data-testid="button-tab-tournament"
          >
            <Trophy className="w-4 h-4 mr-2" />
            Tournament
          </Button>
        </div>
      )}

      {/* Tournament Leaderboard */}
      {activeTab === "tournament" && tournament.isConnected && (
        <>
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold">{tournament.tournamentInfo?.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Room: {tournament.roomCode} • {tournament.leaderboard.length} players
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => tournament.refreshLeaderboard()}
                data-testid="button-refresh-tournament"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          <Card className="p-4 mb-6 flex-1 overflow-auto">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Live Leaderboard
            </h3>
            <div className="space-y-2">
              {tournament.leaderboard.map((entry, index) => {
                const isMyPlayer = tournament.myPlayers.some(p => p.id === entry.playerId);
                return (
                  <div
                    key={entry.playerId}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      index === 0 && "border-primary border-2 bg-primary/5",
                      isMyPlayer && "bg-muted/50"
                    )}
                    data-testid={`tournament-leaderboard-${entry.playerId}`}
                  >
                    <span className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                      index === 0 && "bg-primary text-primary-foreground",
                      index === 1 && "bg-muted",
                      index === 2 && "bg-muted"
                    )}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-medium truncate", isMyPlayer && "text-primary")}>
                        {entry.playerName}
                        {isMyPlayer && " (You)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.groupName || "No group"} • {entry.holesCompleted} holes
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-mono font-bold text-lg",
                        entry.relativeToPar < 0 && "text-green-500",
                        entry.relativeToPar > 0 && "text-red-500"
                      )}>
                        {entry.relativeToPar > 0 ? "+" : ""}{entry.relativeToPar}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.totalStrokes} strokes
                      </p>
                    </div>
                  </div>
                );
              })}
              {tournament.leaderboard.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No scores yet. Play some holes!
                </p>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Local Summary */}
      {activeTab === "local" && (
        <>
          {/* Summary Stats */}
           <Card className="p-4 mb-6">
             <div className="grid grid-cols-2 gap-4 text-sm">
               <div className="flex justify-between border-b border-dashed pb-2">
                 <span>Total Players:</span>
                 <span className="font-semibold">{players.length}</span>
               </div>
               <div className="flex justify-between border-b border-dashed pb-2">
                 <span>Holes Played:</span>
                 <span className="font-semibold">{allHoles.length}</span>
               </div>
               <div className="flex justify-between border-b border-dashed pb-2">
                 <span>Total Strokes:</span>
                 <span className="font-semibold">
                   {Object.values(localScores).reduce((sum, playerScores) =>
                     sum + calculatePlayerTotal(playerScores).totalStrokes, 0
                   )}
                 </span>
               </div>
               <div className="flex justify-between border-b border-dashed pb-2">
                 <span>Total Scratches:</span>
                 <span className="font-semibold">
                   {Object.values(localScores).reduce((sum, playerScores) =>
                     sum + calculatePlayerTotal(playerScores).totalScratches, 0
                   )}
                 </span>
               </div>
             </div>
           </Card>

          {/* Leaderboard - Collapsed View (Portrait) */}
          {!isLandscape && (
            <Card className="p-4 mb-6">
              <h3 className="font-bold mb-3">Leaderboard</h3>
               <div className="space-y-2">
                 {leaderboard.map((entry, index) => {
                   const stats = calculatePlayerTotal(localScores[entry.player.id] || []);
                   const isLeader = index === 0;

                   return (
                     <div
                       key={entry.player.id}
                       className={cn(
                         "grid grid-cols-[1.5fr_repeat(4,1fr)] gap-2 items-center p-3 rounded-lg border",
                         isLeader && "border-primary border-2"
                       )}
                       data-testid={`leaderboard-${entry.player.id}`}
                     >
                       <div className="flex items-center gap-2">
                         <div
                           className="w-6 h-6 rounded-full flex-shrink-0"
                           style={{ backgroundColor: entry.player.color }}
                         />
                         <span className="font-semibold truncate">{entry.player.name}</span>
                       </div>
                       <div className="text-center text-sm">
                         <div className="font-bold">{entry.total}</div>
                         <div className="text-xs text-muted-foreground">Total</div>
                       </div>
                       <div className="text-center text-sm">
                         <div>{stats.totalScratches}</div>
                         <div className="text-xs text-muted-foreground">Scratch</div>
                       </div>
                       <div className="text-center text-sm">
                         <div>{stats.totalPenalties}</div>
                         <div className="text-xs text-muted-foreground">Penalty</div>
                       </div>
                       <div className="text-center text-sm font-bold">
                         #{index + 1}
                       </div>
                     </div>
                   );
                 })}
               </div>
            </Card>
          )}

          {/* Detailed Box Score & Stats (Landscape) */}
          {isLandscape && (
            <Card className="p-4 mb-6">
              <h3 className="font-bold mb-3">Detailed Box Score & Statistics</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px] sticky left-0 bg-card">Player</TableHead>
                      {allHoles.map((hole) => (
                        <TableHead key={hole} className="text-center min-w-[50px]">H{hole}</TableHead>
                      ))}
                      <TableHead className="text-center min-w-[60px]">Strokes</TableHead>
                      <TableHead className="text-center min-w-[60px]">Scratch</TableHead>
                      <TableHead className="text-center min-w-[60px]">Penalty</TableHead>
                      <TableHead className="text-center min-w-[60px] font-bold">Total</TableHead>
                      <TableHead className="text-center min-w-[50px]">Rank</TableHead>
                    </TableRow>
                  </TableHeader>
                   <TableBody>
                     {leaderboard.map((entry, index) => {
                       const playerScores = localScores[entry.player.id] || [];
                       const stats = calculatePlayerTotal(playerScores);
                       const isLeader = index === 0;
                       const rawStrokes = playerScores.reduce((sum, s) => sum + s.strokes, 0);

                       return (
                         <TableRow key={entry.player.id} className={cn(isLeader && "border-2 border-primary")}>
                           <TableCell className="font-semibold sticky left-0 bg-card">
                             <div className="flex items-center gap-2">
                               <div
                                 className="w-4 h-4 rounded-full flex-shrink-0"
                                 style={{ backgroundColor: entry.player.color }}
                               />
                               <span className="truncate">{entry.player.name}</span>
                             </div>
                           </TableCell>
                           {allHoles.map((hole) => {
                             const holeScore = playerScores.find((s) => s.hole === hole);
                             const par = holeScore?.par || 0;
                             const strokes = holeScore?.strokes || 0;
                             const diff = strokes - par;
                             return (
                               <TableCell
                                 key={hole}
                                 className={cn(
                                   "text-center cursor-pointer hover:bg-muted/50 transition-colors",
                                   diff < 0 && "text-green-500 font-semibold",
                                   diff > 0 && "text-red-500"
                                 )}
                                 onClick={() => holeScore && handleEditScore(entry.player.id, hole, strokes)}
                                 data-testid={`score-cell-${entry.player.id}-${hole}`}
                               >
                                 {holeScore ? strokes : "-"}
                               </TableCell>
                             );
                           })}
                           <TableCell className="text-center">{rawStrokes}</TableCell>
                           <TableCell className="text-center">{stats.totalScratches}</TableCell>
                           <TableCell className="text-center">{stats.totalPenalties}</TableCell>
                           <TableCell className="text-center font-bold">{entry.total}</TableCell>
                           <TableCell className="text-center font-bold">#{index + 1}</TableCell>
                         </TableRow>
                       );
                     })}
                   </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* Box Score (Portrait) */}
          {!isLandscape && (
            <Card className="p-4 mb-6">
              <h3 className="font-bold mb-2">Box Score</h3>
              <p className="text-xs text-muted-foreground mb-3">Rotate device to view detailed stats.</p>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">Player</TableHead>
                      {allHoles.map((hole) => (
                        <TableHead key={hole} className="text-center min-w-[50px]">H{hole}</TableHead>
                      ))}
                      <TableHead className="text-center min-w-[60px]">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                   <TableBody>
                     {leaderboard.map((entry, index) => {
                       const playerScores = localScores[entry.player.id] || [];
                       const isLeader = index === 0;

                       return (
                         <TableRow key={entry.player.id} className={cn(isLeader && "border-2 border-primary")}>
                           <TableCell className="font-semibold">
                             <div className="flex items-center gap-2">
                               <div
                                 className="w-4 h-4 rounded-full"
                                 style={{ backgroundColor: entry.player.color }}
                               />
                               {entry.player.name}
                             </div>
                           </TableCell>
                           {allHoles.map((hole) => {
                             const holeScore = playerScores.find((s) => s.hole === hole);
                             return (
                               <TableCell
                                 key={hole}
                                 className="text-center cursor-pointer hover:bg-muted/50 transition-colors"
                                 onClick={() => holeScore && handleEditScore(entry.player.id, hole, holeScore.strokes)}
                                 data-testid={`score-cell-portrait-${entry.player.id}-${hole}`}
                               >
                                 {holeScore ? holeScore.strokes : "-"}
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
            </Card>
          )}

          <div className="space-y-3">
            {onSubmitToSheets && (
              <Button 
                variant="outline" 
                className="w-full h-12"
                onClick={onSubmitToSheets}
                data-testid="button-submit-sheets"
              >
                Submit to Google Sheets
              </Button>
            )}
          </div>
         </>
       )}
     </div>

     {/* Landscape Mode Hint Dialog */}
     <AlertDialog open={showLandscapeHint} onOpenChange={setShowLandscapeHint}>
       <AlertDialogContent>
         <AlertDialogHeader>
           <AlertDialogTitle className="flex items-center gap-2">
             <Smartphone className="w-5 h-5" />
             Landscape Mode Available
           </AlertDialogTitle>
           <AlertDialogDescription>
             Turn your device into landscape mode to view and edit the detailed box score with all player statistics!
           </AlertDialogDescription>
         </AlertDialogHeader>
         <AlertDialogFooter>
           <AlertDialogCancel data-testid="button-close-landscape-hint">
             Got it
           </AlertDialogCancel>
         </AlertDialogFooter>
       </AlertDialogContent>
     </AlertDialog>

     {/* Score Editing Dialog */}
     <AlertDialog open={editingScore !== null} onOpenChange={(open) => !open && setEditingScore(null)}>
       <AlertDialogContent>
         <AlertDialogHeader>
           <AlertDialogTitle>Edit Score</AlertDialogTitle>
           <AlertDialogDescription>
             {editingScore && `Enter new strokes for Hole ${editingScore.hole}`}
           </AlertDialogDescription>
         </AlertDialogHeader>
         {editingScore && (
           <div className="space-y-4">
             <Input
               type="number"
               inputMode="numeric"
               min="0"
               value={editingScore.value}
               onChange={(e) => setEditingScore({ ...editingScore, value: e.target.value })}
               placeholder="Enter strokes"
               autoFocus
               data-testid="input-edit-score"
             />
           </div>
         )}
         <AlertDialogFooter>
           <AlertDialogCancel data-testid="button-cancel-edit">
             Cancel
           </AlertDialogCancel>
           <AlertDialogAction
             onClick={handleSaveScore}
             data-testid="button-save-score"
           >
             Save
           </AlertDialogAction>
         </AlertDialogFooter>
       </AlertDialogContent>
     </AlertDialog>
   </div>
 );
}
