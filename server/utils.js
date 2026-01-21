// Generate a random 4-character game code
function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous: I, O, 0, 1
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate a unique game code that doesn't exist in the games map
function generateUniqueGameCode(games) {
  let code;
  do {
    code = generateGameCode();
  } while (games.has(code));
  return code;
}

// Shuffle an array in place (Fisher-Yates)
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Deal unique numbers to players
function dealNumbers(playerCount) {
  const deck = [];
  for (let i = 1; i <= 100; i++) {
    deck.push(i);
  }
  shuffle(deck);
  return deck.slice(0, playerCount);
}

module.exports = {
  generateUniqueGameCode,
  shuffle,
  dealNumbers
};
