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

  // Create a new game
  socket.on('create-game', (name) => {
    playerName = name;
    const gameData = game.createGame(socket.id, name);
    currentGame = gameData.code;
    socket.join(currentGame);
    socket.emit('game-created', { code: currentGame });
    socket.emit('game-state', game.getGameState(currentGame, socket.id));
  });

  // Join an existing game
  socket.on('join-game', ({ code, name }) => {
    const result = game.joinGame(code.toUpperCase(), socket.id, name);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    playerName = name;
    currentGame = code.toUpperCase();
    socket.join(currentGame);

    // Notify everyone in the game
    const player = { id: socket.id, name };
    socket.to(currentGame).emit('player-joined', player);
    socket.emit('game-joined', { code: currentGame });

    // Send current game state to all players
    io.to(currentGame).emit('game-state', game.getGameState(currentGame, socket.id));

    // Send personalized state to each player (for their number)
    const gameData = game.getGame(currentGame);
    if (gameData) {
      gameData.players.forEach(p => {
        io.to(p.id).emit('game-state', game.getGameState(currentGame, p.id));
      });
    }
  });

  // Start a new round
  socket.on('start-round', () => {
    if (!currentGame) return;

    const result = game.startRound(currentGame, socket.id);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    // Send personalized state to each player (with their number)
    result.game.players.forEach(p => {
      io.to(p.id).emit('round-started', {
        yourNumber: p.number
      });
      io.to(p.id).emit('game-state', game.getGameState(currentGame, p.id));
    });
  });

  // Place a card
  socket.on('place-card', (position) => {
    if (!currentGame) return;

    const result = game.placeCard(currentGame, socket.id, position);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    io.to(currentGame).emit('card-placed', {
      playerId: socket.id,
      playerName,
      position: result.position
    });

    // Update game state for all
    const gameData = game.getGame(currentGame);
    if (gameData) {
      gameData.players.forEach(p => {
        io.to(p.id).emit('game-state', game.getGameState(currentGame, p.id));
      });
    }
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

    // Update game state for all
    const gameData = game.getGame(currentGame);
    if (gameData) {
      gameData.players.forEach(p => {
        io.to(p.id).emit('game-state', game.getGameState(currentGame, p.id));
      });
    }
  });

  // Start reveal phase
  socket.on('start-reveal', () => {
    if (!currentGame) return;

    const result = game.startReveal(currentGame);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    io.to(currentGame).emit('reveal-started');

    // Update game state for all
    const gameData = game.getGame(currentGame);
    if (gameData) {
      gameData.players.forEach(p => {
        io.to(p.id).emit('game-state', game.getGameState(currentGame, p.id));
      });
    }
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

    // Update game state for all
    const gameData = game.getGame(currentGame);
    if (gameData) {
      gameData.players.forEach(p => {
        io.to(p.id).emit('game-state', game.getGameState(currentGame, p.id));
      });
    }
  });

  // Play again
  socket.on('play-again', () => {
    if (!currentGame) return;

    const result = game.startRound(currentGame, socket.id);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    // Send personalized state to each player (with their number)
    result.game.players.forEach(p => {
      io.to(p.id).emit('round-started', {
        yourNumber: p.number
      });
      io.to(p.id).emit('game-state', game.getGameState(currentGame, p.id));
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    if (currentGame) {
      const updatedGame = game.removePlayer(currentGame, socket.id);
      if (updatedGame) {
        io.to(currentGame).emit('player-left', { playerId: socket.id, playerName });

        // Update game state for remaining players
        updatedGame.players.forEach(p => {
          io.to(p.id).emit('game-state', game.getGameState(currentGame, p.id));
        });

        // Notify about new host if changed
        io.to(currentGame).emit('host-changed', { newHostId: updatedGame.hostId });
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Ito Online server running on http://localhost:${PORT}`);
});
