const { generateUniqueGameCode, dealNumbers } = require('./utils');

// In-memory game storage
const games = new Map();

// Clean up inactive games after 1 hour
const GAME_TIMEOUT = 60 * 60 * 1000;

function createGame(hostId, hostName) {
  const code = generateUniqueGameCode(games);
  const game = {
    code,
    hostId,
    status: 'lobby',
    players: [{ id: hostId, name: hostName, number: null }],
    cardLine: [],
    revealIndex: 0,
    result: null,
    category: null,
    lastActivity: Date.now()
  };
  games.set(code, game);
  return game;
}

function setCategory(code, playerId, category) {
  const game = getGame(code);
  if (!game) {
    return { error: 'Game not found' };
  }
  if (game.hostId !== playerId) {
    return { error: 'Only host can set category' };
  }
  game.category = category.trim().substring(0, 100);
  return { game };
}

function getGame(code) {
  const game = games.get(code);
  if (game) {
    game.lastActivity = Date.now();
  }
  return game;
}

function joinGame(code, playerId, playerName) {
  const game = getGame(code);
  if (!game) {
    return { error: 'Game not found' };
  }
  if (game.status !== 'lobby') {
    return { error: 'Game already started' };
  }
  if (game.players.length >= 10) {
    return { error: 'Game is full' };
  }
  if (game.players.some(p => p.id === playerId)) {
    return { error: 'Already in game' };
  }

  game.players.push({ id: playerId, name: playerName, number: null });
  return { game };
}

function removePlayer(code, playerId) {
  const game = getGame(code);
  if (!game) return null;

  game.players = game.players.filter(p => p.id !== playerId);

  // Remove player's card from line if present
  game.cardLine = game.cardLine.filter(id => id !== playerId);

  // If host left, assign new host
  if (game.hostId === playerId && game.players.length > 0) {
    game.hostId = game.players[0].id;
  }

  // Delete game if empty
  if (game.players.length === 0) {
    games.delete(code);
    return null;
  }

  return game;
}

function startRound(code, playerId) {
  const game = getGame(code);
  if (!game) {
    return { error: 'Game not found' };
  }
  if (game.hostId !== playerId) {
    return { error: 'Only host can start' };
  }
  if (game.players.length < 2) {
    return { error: 'Need at least 2 players' };
  }

  // Deal numbers
  const numbers = dealNumbers(game.players.length);
  game.players.forEach((player, index) => {
    player.number = numbers[index];
  });

  // Reset game state
  game.status = 'playing';
  game.cardLine = [];
  game.revealIndex = 0;
  game.result = null;
  game.category = null;
  game.hasError = false;

  return { game };
}

function placeCard(code, playerId, position) {
  const game = getGame(code);
  if (!game) {
    return { error: 'Game not found' };
  }
  if (game.status !== 'playing') {
    return { error: 'Game not in playing state' };
  }

  // Remove player from current position if already placed
  game.cardLine = game.cardLine.filter(id => id !== playerId);

  // Insert at new position
  const insertPos = Math.min(Math.max(0, position), game.cardLine.length);
  game.cardLine.splice(insertPos, 0, playerId);

  return { game, position: insertPos };
}

function moveCard(code, fromIndex, toIndex) {
  const game = getGame(code);
  if (!game) {
    return { error: 'Game not found' };
  }
  if (game.status !== 'playing') {
    return { error: 'Game not in playing state' };
  }
  if (fromIndex < 0 || fromIndex >= game.cardLine.length) {
    return { error: 'Invalid from index' };
  }

  // Remove card from old position
  const [playerId] = game.cardLine.splice(fromIndex, 1);

  // Insert at new position
  const insertPos = Math.min(Math.max(0, toIndex), game.cardLine.length);
  game.cardLine.splice(insertPos, 0, playerId);

  return { game };
}

function startReveal(code) {
  const game = getGame(code);
  if (!game) {
    return { error: 'Game not found' };
  }
  if (game.status !== 'playing') {
    return { error: 'Game not in playing state' };
  }
  if (game.cardLine.length !== game.players.length) {
    return { error: 'All players must place their cards first' };
  }

  game.status = 'revealing';
  game.revealIndex = 0;

  return { game };
}

function revealNext(code) {
  const game = getGame(code);
  if (!game) {
    return { error: 'Game not found' };
  }
  if (game.status !== 'revealing') {
    return { error: 'Game not in revealing state' };
  }
  if (game.revealIndex >= game.cardLine.length) {
    return { error: 'All cards revealed' };
  }

  const currentPlayerId = game.cardLine[game.revealIndex];
  const currentPlayer = game.players.find(p => p.id === currentPlayerId);
  const currentNumber = currentPlayer.number;

  // Check if this card is in correct order
  let isCorrect = true;
  if (game.revealIndex > 0) {
    const prevPlayerId = game.cardLine[game.revealIndex - 1];
    const prevPlayer = game.players.find(p => p.id === prevPlayerId);
    if (currentNumber < prevPlayer.number) {
      isCorrect = false;
    }
  }

  const revealData = {
    index: game.revealIndex,
    playerId: currentPlayerId,
    playerName: currentPlayer.name,
    number: currentNumber,
    isCorrect
  };

  game.revealIndex++;

  // Track if any card was out of order
  if (!isCorrect) {
    game.hasError = true;
  }

  // Only end game when all cards have been revealed
  if (game.revealIndex >= game.cardLine.length) {
    game.status = 'ended';
    game.result = game.hasError ? 'lose' : 'win';
  }

  return { game, revealData };
}

function getGameState(code, playerId) {
  const game = getGame(code);
  if (!game) return null;

  // Return game state with only this player's number visible
  const player = game.players.find(p => p.id === playerId);

  // Build revealed cards info (cards that have been flipped)
  const revealedCards = {};
  if (game.status === 'revealing' || game.status === 'ended') {
    let prevNumber = -1;
    for (let i = 0; i < game.revealIndex; i++) {
      const cardPlayerId = game.cardLine[i];
      const cardPlayer = game.players.find(p => p.id === cardPlayerId);
      if (cardPlayer) {
        const isCorrect = cardPlayer.number >= prevNumber;
        revealedCards[cardPlayerId] = {
          number: cardPlayer.number,
          isCorrect
        };
        prevNumber = cardPlayer.number;
      }
    }
  }

  return {
    code: game.code,
    hostId: game.hostId,
    status: game.status,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      hasNumber: p.number !== null
    })),
    myNumber: player ? player.number : null,
    cardLine: game.cardLine,
    revealIndex: game.revealIndex,
    revealedCards,
    result: game.result,
    category: game.category
  };
}

function getFinalResults(code) {
  const game = getGame(code);
  if (!game || game.status !== 'ended') return null;

  let prevNumber = -1;
  return game.cardLine.map(playerId => {
    const player = game.players.find(p => p.id === playerId);
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    const isCorrect = player.number >= prevNumber;
    prevNumber = player.number;
    return {
      playerId,
      name: player.name,
      number: player.number,
      playerIndex,
      isCorrect
    };
  });
}

// Cleanup old games periodically
setInterval(() => {
  const now = Date.now();
  for (const [code, game] of games) {
    if (now - game.lastActivity > GAME_TIMEOUT) {
      games.delete(code);
    }
  }
}, 60000); // Check every minute

// Socket ID mapping (playerId -> socketId) per game
const socketMappings = new Map();

function setPlayerSocket(code, playerId, socketId) {
  if (!socketMappings.has(code)) {
    socketMappings.set(code, new Map());
  }
  socketMappings.get(code).set(playerId, socketId);
}

function getPlayerSocket(code, playerId) {
  const gameMap = socketMappings.get(code);
  return gameMap ? gameMap.get(playerId) : null;
}

module.exports = {
  createGame,
  getGame,
  joinGame,
  removePlayer,
  startRound,
  placeCard,
  moveCard,
  startReveal,
  revealNext,
  getGameState,
  getFinalResults,
  setPlayerSocket,
  getPlayerSocket,
  setCategory
};
