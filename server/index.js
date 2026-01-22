const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  let currentGame = null;
  let playerName = null;
  let currentPlayerId = null;

  // Create a new game
  socket.on('create-game', ({ playerId, name }) => {
    playerName = name;
    currentPlayerId = playerId;
    const gameData = game.createGame(playerId, name);
    currentGame = gameData.code;
    game.setPlayerSocket(currentGame, playerId, socket.id);
    socket.join(currentGame);
    socket.emit('game-created', { code: currentGame });
    socket.emit('game-state', game.getGameState(currentGame, playerId));
  });

  // Join an existing game
  socket.on('join-game', ({ code, name, playerId }) => {
    const result = game.joinGame(code.toUpperCase(), playerId, name);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    playerName = name;
    currentPlayerId = playerId;
    currentGame = code.toUpperCase();
    game.setPlayerSocket(currentGame, playerId, socket.id);
    socket.join(currentGame);

    // Notify everyone in the game
    const player = { id: playerId, name };
    socket.to(currentGame).emit('player-joined', player);
    socket.emit('game-joined', { code: currentGame });

    // Send personalized state to each player (for their number)
    const gameData = game.getGame(currentGame);
    if (gameData) {
      gameData.players.forEach(p => {
        const socketId = game.getPlayerSocket(currentGame, p.id);
        if (socketId) {
          io.to(socketId).emit('game-state', game.getGameState(currentGame, p.id));
        }
      });
    }
  });

  // Rejoin after page reload
  socket.on('rejoin-game', ({ code, name, playerId }) => {
    const gameData = game.getGame(code.toUpperCase());
    if (!gameData) {
      socket.emit('rejoin-failed');
      return;
    }

    const player = gameData.players.find(p => p.id === playerId);
    if (!player) {
      socket.emit('rejoin-failed');
      return;
    }

    // Update socket mapping and rejoin room
    playerName = name;
    currentPlayerId = playerId;
    currentGame = code.toUpperCase();
    game.setPlayerSocket(currentGame, playerId, socket.id);
    socket.join(currentGame);

    // Send current state to rejoined player (use rejoin-success instead of game-joined to avoid lobby flash)
    socket.emit('rejoin-success', { code: currentGame });
    socket.emit('game-state', game.getGameState(currentGame, playerId));

    // If game ended, send the final results
    if (gameData.status === 'ended') {
      socket.emit('round-ended', {
        result: gameData.result,
        finalOrder: game.getFinalResults(currentGame)
      });
    }

    console.log(`Player ${name} (${playerId}) rejoined game ${currentGame}`);
  });

  // Helper to send state to all players in a game
  function broadcastGameState(gameCode) {
    const gameData = game.getGame(gameCode);
    if (gameData) {
      gameData.players.forEach(p => {
        const socketId = game.getPlayerSocket(gameCode, p.id);
        if (socketId) {
          io.to(socketId).emit('game-state', game.getGameState(gameCode, p.id));
        }
      });
    }
  }

  // Start a new round
  socket.on('start-round', () => {
    if (!currentGame || !currentPlayerId) return;

    const result = game.startRound(currentGame, currentPlayerId);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    // Send personalized state to each player (with their number)
    result.game.players.forEach(p => {
      const socketId = game.getPlayerSocket(currentGame, p.id);
      if (socketId) {
        io.to(socketId).emit('round-started', { yourNumber: p.number });
        io.to(socketId).emit('game-state', game.getGameState(currentGame, p.id));
      }
    });
  });

  // Place a card
  socket.on('place-card', (position) => {
    if (!currentGame || !currentPlayerId) return;

    const result = game.placeCard(currentGame, currentPlayerId, position);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    io.to(currentGame).emit('card-placed', {
      playerId: currentPlayerId,
      playerName,
      position: result.position
    });

    broadcastGameState(currentGame);
  });

  // Move a card
  socket.on('move-card', ({ fromIndex, toIndex }) => {
    if (!currentGame) return;

    const result = game.moveCard(currentGame, fromIndex, toIndex);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    io.to(currentGame).emit('card-moved', { fromIndex, toIndex });
    broadcastGameState(currentGame);
  });

  // Start reveal phase - also reveals first card immediately
  socket.on('start-reveal', () => {
    if (!currentGame) return;

    const result = game.startReveal(currentGame);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    io.to(currentGame).emit('reveal-started');

    // Immediately reveal the first card
    const revealResult = game.revealNext(currentGame);
    if (!revealResult.error) {
      io.to(currentGame).emit('card-revealed', revealResult.revealData);

      if (revealResult.game.status === 'ended') {
        io.to(currentGame).emit('round-ended', {
          result: revealResult.game.result,
          finalOrder: game.getFinalResults(currentGame)
        });
      }
    }

    broadcastGameState(currentGame);
  });

  // Reveal next card
  socket.on('reveal-next', () => {
    if (!currentGame) return;

    const result = game.revealNext(currentGame);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    io.to(currentGame).emit('card-revealed', result.revealData);

    if (result.game.status === 'ended') {
      io.to(currentGame).emit('round-ended', {
        result: result.game.result,
        finalOrder: game.getFinalResults(currentGame)
      });
    }

    broadcastGameState(currentGame);
  });

  // Play again
  socket.on('play-again', () => {
    if (!currentGame || !currentPlayerId) return;

    const result = game.startRound(currentGame, currentPlayerId);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    // Send personalized state to each player (with their number)
    result.game.players.forEach(p => {
      const socketId = game.getPlayerSocket(currentGame, p.id);
      if (socketId) {
        io.to(socketId).emit('round-started', { yourNumber: p.number });
        io.to(socketId).emit('game-state', game.getGameState(currentGame, p.id));
      }
    });
  });

  // Handle disconnect - don't remove player immediately, allow reconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    // Don't remove player from game - they might reconnect
    // The game cleanup timer will handle stale games
  });
});

server.listen(PORT, () => {
  console.log(`Ito Online server running on http://localhost:${PORT}`);
});
