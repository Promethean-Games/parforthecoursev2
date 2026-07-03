import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Users, Check, Play, RefreshCw } from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";

interface PlayerSelectionDialogProps {
  onClose: () => void;
  onStartGame?: () => void;
}

export function PlayerSelectionDialog({ onClose, onStartGame }: PlayerSelectionDialogProps) {
  const tournament = useTournament();
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasAssigned, setHasAssigned] = useState(false);
  const [assignedPlayerNames, setAssignedPlayerNames] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setSelectedPlayerIds(tournament.myPlayers.map(p => p.id));
    if (tournament.myPlayers.length > 0) {
      setHasAssigned(true);
      setAssignedPlayerNames(tournament.myPlayers.map(p => p.playerName));
    }
  }, [tournament.myPlayers]);

  // Auto-refresh player list every 3 seconds for real-time device connection updates
  useEffect(() => {
    const interval = setInterval(() => {
      tournament.refreshPlayers();
    }, 3000);
    return () => clearInterval(interval);
  }, [tournament]);

  // Auto-start removed - players now have a "Begin Playing" button to start when ready

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await tournament.refreshPlayers();
    setIsRefreshing(false);
  };

  const handleTogglePlayer = (playerId: number) => {
    setSelectedPlayerIds(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    const selectedNames = tournament.allPlayers
      .filter(p => selectedPlayerIds.includes(p.id))
      .map(p => p.playerName);
    setAssignedPlayerNames(selectedNames);
    await tournament.assignPlayersToDevice(selectedPlayerIds);
    setIsSaving(false);
    setHasAssigned(true);
  };

  const groupedPlayers = tournament.allPlayers.reduce((acc, player) => {
    const group = player.groupName || "Unassigned";
    if (!acc[group]) acc[group] = [];
    acc[group].push(player);
    return acc;
  }, {} as Record<string, typeof tournament.allPlayers>);

  if (hasAssigned) {
    const playerNames = tournament.myPlayers.length > 0 
      ? tournament.myPlayers.map(p => p.playerName)
      : assignedPlayerNames;
    
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <div className="mb-4">
            <Play className="w-16 h-16 mx-auto text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Ready to Play!</h2>
          <p className="text-muted-foreground mb-4">
            Head to your starting hole and begin when ready.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-muted-foreground">Your players:</p>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {playerNames.map((name, idx) => (
                <span key={idx} className="px-2 py-1 bg-green-500/20 text-green-600 rounded text-sm font-medium">
                  {name}
                </span>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Tournament: <span className="font-mono font-bold">{tournament.roomCode}</span>
          </p>
          <Button 
            onClick={onStartGame}
            className="w-full bg-green-600 hover:bg-green-700 mb-2"
            data-testid="button-begin-playing"
          >
            <Play className="w-4 h-4 mr-2" />
            Begin Playing
          </Button>
          <Button 
            variant="outline" 
            onClick={onClose}
            className="w-full"
          >
            Leave Tournament
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Select Your Players</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh-players"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Choose which players you'll be scoring for on this device.
          </p>

          {Object.entries(groupedPlayers).map(([groupName, players]) => (
            <div key={groupName} className="mb-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {groupName} ({players.length})
              </h3>
              <div className="space-y-2">
                {players.map(player => {
                  const isSelected = selectedPlayerIds.includes(player.id);
                  const isAssignedToOther = player.deviceId && player.deviceId !== tournament.deviceId;
                  
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isSelected 
                          ? "border-green-500 bg-green-500/10" 
                          : isAssignedToOther
                          ? "border-muted bg-muted/50 opacity-50"
                          : "border-muted hover:border-green-500/50"
                      }`}
                      onClick={() => !isAssignedToOther && handleTogglePlayer(player.id)}
                      data-testid={`player-option-${player.id}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={!!isAssignedToOther}
                        className="pointer-events-none"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{player.playerName}</p>
                        {isAssignedToOther && (
                          <p className="text-xs text-muted-foreground">Assigned to another device</p>
                        )}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-green-500" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {tournament.allPlayers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No players registered yet.</p>
              <p className="text-sm">Wait for the Tournament Director to add players.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSaving || selectedPlayerIds.length === 0}
            className="flex-1"
            data-testid="button-confirm-players"
          >
            {isSaving ? "Saving..." : `Confirm (${selectedPlayerIds.length})`}
          </Button>
        </div>
      </Card>
    </div>
  );
}
