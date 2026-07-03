import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTournamentSchema, insertTournamentPlayerSchema, insertTournamentScoreSchema, batchUpdateGroupsSchema, insertUniversalPlayerSchema, type TournamentScore } from "@shared/schema";
import { z } from "zod";

const createUniversalPlayerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().nullable().optional(),
  contactInfo: z.string().nullable().optional(),
});

const searchUniversalPlayerSchema = z.object({
  query: z.string().min(1, "Search query is required"),
});

const linkUniversalPlayerSchema = z.object({
  universalPlayerId: z.number().int().positive(),
});

const updateUniversalPlayerSchema = z.object({
  directorPin: z.string().min(1, "Director PIN is required"),
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  contactInfo: z.string().nullable().optional(),
  handicap: z.number().nullable().optional(),
  isProvisional: z.boolean().optional(),
});

const mergeUniversalPlayersSchema = z.object({
  directorPin: z.string().min(1, "Director PIN is required"),
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
});

const createTournamentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  directorPin: z.string().min(1, "Director PIN is required"),
  isHandicapped: z.boolean().optional().default(false),
});

const addPlayerSchema = z.object({
  playerName: z.string().min(1, "Player name is required"),
  deviceId: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  universalId: z.string().nullable().optional(),
  contactInfo: z.string().nullable().optional(),
});

const syncScoreSchema = z.object({
  tournamentPlayerId: z.number().int().positive(),
  hole: z.number().int().positive(),
  par: z.number().int().min(0),
  strokes: z.number().int().min(0),
  scratches: z.number().int().min(0).optional(),
  penalties: z.number().int().min(0).optional(),
});

const verifyDirectorSchema = z.object({
  pin: z.string().min(1, "PIN is required"),
});

const assignDeviceSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
});

const batchScoreSchema = z.object({
  scores: z.array(syncScoreSchema),
});

const directorActionSchema = z.object({
  directorPin: z.string().min(1, "Director PIN is required"),
});

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const MASTER_DIRECTOR_PIN = "3141";

export async function registerRoutes(app: Express): Promise<Server> {
  // Verify master director PIN
  app.post("/api/director/verify", async (req, res) => {
    try {
      const { pin } = req.body;
      if (pin === MASTER_DIRECTOR_PIN) {
        res.json({ isValid: true });
      } else {
        res.json({ isValid: false });
      }
    } catch (error) {
      console.error("Error verifying director:", error);
      res.status(500).json({ error: "Failed to verify" });
    }
  });

  // List all tournaments (requires master director PIN)
  app.get("/api/tournaments", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const tournaments = await storage.getAllTournaments();
      const safeTournaments = tournaments.map(t => {
        const { directorPin: _, ...safe } = t;
        return safe;
      });
      res.json(safeTournaments);
    } catch (error) {
      console.error("Error listing tournaments:", error);
      res.status(500).json({ error: "Failed to list tournaments" });
    }
  });

  // Create a new tournament room (requires master director PIN)
  app.post("/api/tournaments", async (req, res) => {
    try {
      const parsed = createTournamentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }

      // Verify master director PIN for creation
      if (parsed.data.directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      let roomCode = generateRoomCode();
      let attempts = 0;
      while (await storage.getTournamentByCode(roomCode) && attempts < 10) {
        roomCode = generateRoomCode();
        attempts++;
      }
      if (attempts >= 10 && await storage.getTournamentByCode(roomCode)) {
        return res.status(500).json({ error: "Failed to generate unique room code" });
      }

      const tournament = await storage.createTournament({
        roomCode,
        name: parsed.data.name,
        directorPin: parsed.data.directorPin,
        isActive: true,
        isHandicapped: parsed.data.isHandicapped,
      });

      res.json(tournament);
    } catch (error) {
      console.error("Error creating tournament:", error);
      res.status(500).json({ error: "Failed to create tournament" });
    }
  });

  // Get tournament by room code
  app.get("/api/tournaments/:roomCode", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      const { directorPin, ...safe } = tournament;
      res.json(safe);
    } catch (error) {
      console.error("Error getting tournament:", error);
      res.status(500).json({ error: "Failed to get tournament" });
    }
  });

  // Verify director PIN
  app.post("/api/tournaments/:roomCode/verify-director", async (req, res) => {
    try {
      const parsed = verifyDirectorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      const isValid = await storage.verifyDirectorPin(req.params.roomCode, parsed.data.pin);
      res.json({ isValid });
    } catch (error) {
      console.error("Error verifying PIN:", error);
      res.status(500).json({ error: "Failed to verify PIN" });
    }
  });

  // Delete tournament (director only - master PIN or tournament PIN)
  app.delete("/api/tournaments/:roomCode", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const { directorPin } = req.body;
      const isMasterDirector = directorPin === MASTER_DIRECTOR_PIN;
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      await storage.deleteTournament(tournament.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tournament:", error);
      res.status(500).json({ error: "Failed to delete tournament" });
    }
  });

  // Get tournament backup (director only)
  app.get("/api/tournaments/:roomCode/backup", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const directorPin = req.query.directorPin as string;
      const isMasterDirector = directorPin === MASTER_DIRECTOR_PIN;
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const backup = await storage.getTournamentBackup(tournament.id);
      const { directorPin: _, ...safeTournament } = backup.tournament;
      res.json({
        ...backup,
        tournament: safeTournament,
        exportedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error getting tournament backup:", error);
      res.status(500).json({ error: "Failed to get backup" });
    }
  });

  // Start tournament (director only - master PIN or tournament PIN)
  app.post("/api/tournaments/:roomCode/start", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const { directorPin } = req.body;
      const isMasterDirector = directorPin === MASTER_DIRECTOR_PIN;
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      await storage.startTournament(tournament.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error starting tournament:", error);
      res.status(500).json({ error: "Failed to start tournament" });
    }
  });

  // Close tournament (director only - master PIN or tournament PIN)
  app.post("/api/tournaments/:roomCode/close", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const { directorPin } = req.body;
      const isMasterDirector = directorPin === MASTER_DIRECTOR_PIN;
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      await storage.closeTournament(tournament.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error closing tournament:", error);
      res.status(500).json({ error: "Failed to close tournament" });
    }
  });

  // Get players in tournament
  app.get("/api/tournaments/:roomCode/players", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      const players = await storage.getPlayersInTournament(tournament.id);
      res.json(players);
    } catch (error) {
      console.error("Error getting players:", error);
      res.status(500).json({ error: "Failed to get players" });
    }
  });

  // Add player to tournament
  app.post("/api/tournaments/:roomCode/players", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const parsed = addPlayerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const player = await storage.addPlayerToTournament({
        tournamentId: tournament.id,
        playerName: parsed.data.playerName,
        deviceId: parsed.data.deviceId || null,
        groupName: parsed.data.groupName || null,
        universalId: parsed.data.universalId || null,
        contactInfo: parsed.data.contactInfo || null,
      });

      res.json(player);
    } catch (error) {
      console.error("Error adding player:", error);
      res.status(500).json({ error: "Failed to add player" });
    }
  });

  // Assign device to player
  app.post("/api/tournaments/:roomCode/players/:playerId/assign", async (req, res) => {
    try {
      const parsed = assignDeviceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      await storage.assignDeviceToPlayer(parseInt(req.params.playerId), parsed.data.deviceId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error assigning device:", error);
      res.status(500).json({ error: "Failed to assign device" });
    }
  });

  // Unassign device from player (director only)
  app.post("/api/tournaments/:roomCode/players/:playerId/unassign-device", async (req, res) => {
    try {
      const directorPin = req.body.directorPin;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        const tournament = await storage.getTournamentByCode(req.params.roomCode);
        if (!tournament || tournament.directorPin !== directorPin) {
          return res.status(403).json({ error: "Invalid director credentials" });
        }
      }
      
      await storage.unassignDeviceFromPlayer(parseInt(req.params.playerId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error unassigning device:", error);
      res.status(500).json({ error: "Failed to unassign device" });
    }
  });

  // Get players assigned to this device
  app.get("/api/tournaments/:roomCode/my-players", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const deviceId = req.query.deviceId as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }

      const players = await storage.getPlayersByDevice(tournament.id, deviceId);
      res.json(players);
    } catch (error) {
      console.error("Error getting device players:", error);
      res.status(500).json({ error: "Failed to get players" });
    }
  });

  // Get scores for players assigned to this device (for session restoration)
  app.get("/api/tournaments/:roomCode/my-scores", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const deviceId = req.query.deviceId as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }

      const players = await storage.getPlayersByDevice(tournament.id, deviceId);
      const allScores: Record<number, TournamentScore[]> = {};
      
      for (const player of players) {
        const scores = await storage.getPlayerScores(player.id);
        allScores[player.id] = scores;
      }

      res.json({ players, scores: allScores });
    } catch (error) {
      console.error("Error getting device scores:", error);
      res.status(500).json({ error: "Failed to get scores" });
    }
  });

  // Update player info (director only)
  app.patch("/api/tournaments/:roomCode/players/:playerId", async (req, res) => {
    try {
      // Get tournament and verify director PIN
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const { directorPin, ...playerData } = req.body;
      const isDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      // Verify player belongs to this tournament
      const players = await storage.getPlayersInTournament(tournament.id);
      const playerId = parseInt(req.params.playerId);
      const playerExists = players.some(p => p.id === playerId);
      if (!playerExists) {
        return res.status(404).json({ error: "Player not found in this tournament" });
      }
      
      const parsed = addPlayerSchema.partial().safeParse(playerData);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      const player = await storage.updatePlayer(playerId, {
        playerName: parsed.data.playerName,
        groupName: parsed.data.groupName,
        universalId: parsed.data.universalId,
        contactInfo: parsed.data.contactInfo,
      });
      res.json(player);
    } catch (error) {
      console.error("Error updating player:", error);
      res.status(500).json({ error: "Failed to update player" });
    }
  });

  // Batch update player groups (director only)
  app.post("/api/tournaments/:roomCode/players/batch-update-groups", async (req, res) => {
    try {
      // Validate request body with Zod schema
      const parsed = batchUpdateGroupsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const { directorPin, updates } = parsed.data;
      const isDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      // Verify all players belong to this tournament
      const players = await storage.getPlayersInTournament(tournament.id);
      const playerIds = new Set(players.map(p => p.id));
      
      for (const update of updates) {
        if (!playerIds.has(update.playerId)) {
          return res.status(404).json({ error: `Player ${update.playerId} not found in this tournament` });
        }
      }
      
      // Apply all updates (convert empty string to null for consistency)
      const results = [];
      for (const update of updates) {
        const groupName = update.groupName || null;
        const player = await storage.updatePlayer(update.playerId, { groupName });
        results.push(player);
      }
      
      res.json({ success: true, players: results });
    } catch (error) {
      console.error("Error batch updating players:", error);
      res.status(500).json({ error: "Failed to update players" });
    }
  });

  // Remove player from tournament (director only)
  app.delete("/api/tournaments/:roomCode/players/:playerId", async (req, res) => {
    try {
      // Get tournament and verify director PIN
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const directorPin = req.query.directorPin as string;
      const isDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      // Verify player belongs to this tournament
      const players = await storage.getPlayersInTournament(tournament.id);
      const playerId = parseInt(req.params.playerId);
      const playerExists = players.some(p => p.id === playerId);
      if (!playerExists) {
        return res.status(404).json({ error: "Player not found in this tournament" });
      }
      
      await storage.removePlayerFromTournament(playerId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing player:", error);
      res.status(500).json({ error: "Failed to remove player" });
    }
  });

  // Update/sync score
  app.post("/api/tournaments/:roomCode/scores", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const parsed = syncScoreSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const score = await storage.upsertScore({
        tournamentPlayerId: parsed.data.tournamentPlayerId,
        hole: parsed.data.hole,
        par: parsed.data.par,
        strokes: parsed.data.strokes,
        scratches: parsed.data.scratches || 0,
        penalties: parsed.data.penalties || 0,
      });

      res.json(score);
    } catch (error) {
      console.error("Error syncing score:", error);
      res.status(500).json({ error: "Failed to sync score" });
    }
  });

  // Get leaderboard
  app.get("/api/tournaments/:roomCode/leaderboard", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const leaderboard = await storage.getLeaderboard(tournament.id);
      res.json({
        tournament: {
          id: tournament.id,
          name: tournament.name,
          roomCode: tournament.roomCode,
          isActive: tournament.isActive,
          isStarted: tournament.isStarted,
        },
        leaderboard,
      });
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      res.status(500).json({ error: "Failed to get leaderboard" });
    }
  });

  // Batch sync multiple scores at once
  app.post("/api/tournaments/:roomCode/scores/batch", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const parsed = batchScoreSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const results = [];
      for (const score of parsed.data.scores) {
        const saved = await storage.upsertScore({
          tournamentPlayerId: score.tournamentPlayerId,
          hole: score.hole,
          par: score.par,
          strokes: score.strokes,
          scratches: score.scratches || 0,
          penalties: score.penalties || 0,
        });
        results.push(saved);
      }

      res.json(results);
    } catch (error) {
      console.error("Error batch syncing scores:", error);
      res.status(500).json({ error: "Failed to batch sync scores" });
    }
  });

  // ===== UNIVERSAL PLAYERS API =====

  // Get all universal players (requires master director PIN)
  app.get("/api/universal-players", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const players = await storage.getAllUniversalPlayers();
      res.json(players);
    } catch (error) {
      console.error("Error getting universal players:", error);
      res.status(500).json({ error: "Failed to get universal players" });
    }
  });

  // Search universal players by name/email
  app.get("/api/universal-players/search", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const query = req.query.query as string;
      if (!query || query.length < 1) {
        return res.status(400).json({ error: "Search query required" });
      }
      
      const players = await storage.searchUniversalPlayers(query);
      res.json(players);
    } catch (error) {
      console.error("Error searching universal players:", error);
      res.status(500).json({ error: "Failed to search universal players" });
    }
  });

  // Create a universal player
  app.post("/api/universal-players", async (req, res) => {
    try {
      const directorPin = req.body.directorPin;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const parsed = createUniversalPlayerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      const uniqueCode = await storage.getNextUniqueCode();
      
      const player = await storage.createUniversalPlayer({
        uniqueCode,
        name: parsed.data.name,
        email: parsed.data.email || null,
        contactInfo: parsed.data.contactInfo || null,
      });
      
      res.json(player);
    } catch (error) {
      console.error("Error creating universal player:", error);
      res.status(500).json({ error: "Failed to create universal player" });
    }
  });

  // Update a universal player
  app.patch("/api/universal-players/:id", async (req, res) => {
    try {
      const parsed = updateUniversalPlayerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      if (parsed.data.directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const playerId = parseInt(req.params.id);
      if (isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid player ID" });
      }
      
      const { name, email, contactInfo, handicap, isProvisional } = parsed.data;
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (contactInfo !== undefined) updateData.contactInfo = contactInfo;
      if (handicap !== undefined) updateData.handicap = handicap;
      if (isProvisional !== undefined) updateData.isProvisional = isProvisional;
      
      const player = await storage.updateUniversalPlayer(playerId, updateData);
      res.json(player);
    } catch (error) {
      console.error("Error updating universal player:", error);
      res.status(500).json({ error: "Failed to update universal player" });
    }
  });

  // Delete a universal player
  app.delete("/api/universal-players/:id", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const playerId = parseInt(req.params.id);
      if (isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid player ID" });
      }
      
      await storage.deleteUniversalPlayer(playerId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting universal player:", error);
      res.status(500).json({ error: "Failed to delete universal player" });
    }
  });

  // Merge two universal players (source into target)
  app.post("/api/universal-players/merge", async (req, res) => {
    try {
      const parsed = mergeUniversalPlayersSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      if (parsed.data.directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      if (parsed.data.sourceId === parsed.data.targetId) {
        return res.status(400).json({ error: "Cannot merge a player into themselves" });
      }
      
      const mergedPlayer = await storage.mergeUniversalPlayers(parsed.data.sourceId, parsed.data.targetId);
      res.json(mergedPlayer);
    } catch (error) {
      console.error("Error merging universal players:", error);
      res.status(500).json({ error: "Failed to merge universal players" });
    }
  });

  // Get universal player by ID with handicap info
  app.get("/api/universal-players/:id", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const playerId = parseInt(req.params.id);
      if (isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid player ID" });
      }
      
      const player = await storage.getUniversalPlayer(playerId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      const history = await storage.getPlayerTournamentHistory(playerId, 5);
      
      res.json({ ...player, recentHistory: history });
    } catch (error) {
      console.error("Error getting universal player:", error);
      res.status(500).json({ error: "Failed to get universal player" });
    }
  });

  // Link a tournament player to a universal player
  app.post("/api/tournaments/:roomCode/players/:playerId/link-universal", async (req, res) => {
    try {
      const directorPin = req.body.directorPin;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const playerId = parseInt(req.params.playerId);
      if (isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid player ID" });
      }
      
      const parsed = linkUniversalPlayerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      const updated = await storage.linkTournamentPlayerToUniversal(playerId, parsed.data.universalPlayerId);
      res.json(updated);
    } catch (error) {
      console.error("Error linking universal player:", error);
      res.status(500).json({ error: "Failed to link universal player" });
    }
  });

  // Complete tournament - saves results to history and updates handicaps
  app.post("/api/tournaments/:roomCode/complete", async (req, res) => {
    try {
      const directorPin = req.body.directorPin;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      // Get all players and their scores
      const players = await storage.getTournamentPlayers(tournament.id);
      const leaderboard = await storage.getLeaderboard(tournament.id);
      
      // Save results for players with universal IDs and recalculate handicaps
      for (const entry of leaderboard) {
        const player = players.find(p => p.id === entry.playerId);
        if (player?.universalPlayerId && entry.holesCompleted > 0) {
          // Save to history
          await storage.addTournamentHistory({
            universalPlayerId: player.universalPlayerId,
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            totalStrokes: entry.totalStrokes,
            totalPar: entry.totalPar,
            holesPlayed: entry.holesCompleted,
            relativeToPar: entry.relativeToPar,
          });
          
          // Recalculate handicap
          await storage.recalculateHandicap(player.universalPlayerId);
        }
      }
      
      // Mark tournament as inactive
      await storage.closeTournament(tournament.id);
      
      res.json({ success: true, message: "Tournament completed and handicaps updated" });
    } catch (error) {
      console.error("Error completing tournament:", error);
      res.status(500).json({ error: "Failed to complete tournament" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
