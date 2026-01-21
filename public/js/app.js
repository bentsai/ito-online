// Connect to Socket.io
const socket = io();

// State
let gameState = null;
let myId = null;
let isHost = false;
let myNumber = null;
let draggedCardIndex = null;

// DOM Elements
const screens = {
  landing: document.getElementById('landing-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  result: document.getElementById('result-screen')
};

// Show a specific screen
function showScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[screenName].classList.add('active');
}

// Landing Screen
const playerNameInput = document.getElementById('player-name');
const createGameBtn = document.getElementById('create-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const gameCodeInput = document.getElementById('game-code-input');
const landingError = document.getElementById('landing-error');

createGameBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    landingError.textContent = 'Please enter your name';
    return;
  }
  socket.emit('create-game', name);
});

joinGameBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  const code = gameCodeInput.value.trim().toUpperCase();
  if (!name) {
    landingError.textContent = 'Please enter your name';
    return;
  }
  if (!code || code.length !== 4) {
    landingError.textContent = 'Please enter a valid 4-character game code';
    return;
  }
  socket.emit('join-game', { code, name });
});

// Lobby Screen
const lobbyGameCode = document.getElementById('lobby-game-code');
const copyCodeBtn = document.getElementById('copy-code-btn');
const playersList = document.getElementById('players-list');
const startGameBtn = document.getElementById('start-game-btn');
const lobbyStatus = document.getElementById('lobby-status');

copyCodeBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(lobbyGameCode.textContent);
  copyCodeBtn.textContent = 'Copied!';
  setTimeout(() => copyCodeBtn.textContent = 'Copy', 1500);
});

startGameBtn.addEventListener('click', () => {
  socket.emit('start-round');
});

function updateLobby(state) {
  lobbyGameCode.textContent = state.code;
  document.getElementById('game-code-display').textContent = state.code;

  playersList.innerHTML = '';
  state.players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name;
    if (p.id === state.hostId) {
      li.textContent += ' (host)';
      li.classList.add('host');
    }
    if (p.id === myId) {
      li.classList.add('you');
    }
    playersList.appendChild(li);
  });

  isHost = state.hostId === myId;
  startGameBtn.style.display = isHost ? 'block' : 'none';
  startGameBtn.disabled = state.players.length < 2;

  if (isHost) {
    lobbyStatus.textContent = state.players.length < 2
      ? 'Need at least 2 players to start'
      : 'Ready to start!';
  } else {
    lobbyStatus.textContent = 'Waiting for host to start...';
  }
}

// Game Screen
const yourNumberSpan = document.getElementById('your-number');
const cardLine = document.getElementById('card-line');
const dropZone = document.getElementById('drop-zone');
const notPlacedList = document.getElementById('not-placed-list');
const revealBtn = document.getElementById('reveal-btn');
const gameStatus = document.getElementById('game-status');

revealBtn.addEventListener('click', () => {
  if (gameState.status === 'playing') {
    socket.emit('start-reveal');
  } else if (gameState.status === 'revealing') {
    socket.emit('reveal-next');
  }
});

function updateGame(state) {
  gameState = state;
  yourNumberSpan.textContent = state.myNumber || '?';

  // Update card line
  cardLine.innerHTML = '';
  const placedIds = new Set(state.cardLine);

  state.cardLine.forEach((playerId, index) => {
    const player = state.players.find(p => p.id === playerId);
    const card = createCard(player, index, state.status);
    cardLine.appendChild(card);
  });

  // Update not placed list
  const notPlaced = state.players.filter(p => !placedIds.has(p.id));
  notPlacedList.textContent = notPlaced.length > 0
    ? notPlaced.map(p => p.name).join(', ')
    : 'Everyone has placed!';

  // Update reveal button
  const allPlaced = state.cardLine.length === state.players.length;
  if (state.status === 'playing') {
    revealBtn.textContent = 'Reveal Cards';
    revealBtn.disabled = !allPlaced;
    revealBtn.style.display = 'block';
    dropZone.style.display = 'flex';
  } else if (state.status === 'revealing') {
    revealBtn.textContent = 'Reveal Next';
    revealBtn.disabled = false;
    revealBtn.style.display = 'block';
    dropZone.style.display = 'none';
  } else {
    revealBtn.style.display = 'none';
    dropZone.style.display = 'none';
  }

  // Check if my card is placed
  const myCardPlaced = placedIds.has(myId);
  dropZone.style.display = (state.status === 'playing' && !myCardPlaced) ? 'flex' : 'none';
}

function createCard(player, index, status) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.index = index;
  card.dataset.playerId = player.id;

  if (player.id === myId) {
    card.classList.add('my-card');
  }

  // Card content
  const nameSpan = document.createElement('span');
  nameSpan.className = 'card-name';
  nameSpan.textContent = player.name;

  const numberSpan = document.createElement('span');
  numberSpan.className = 'card-number';
  numberSpan.textContent = '?';

  card.appendChild(numberSpan);
  card.appendChild(nameSpan);

  // Drag and drop for playing state
  if (status === 'playing') {
    card.draggable = true;
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
  }

  return card;
}

// Drag and Drop
function handleDragStart(e) {
  draggedCardIndex = parseInt(e.target.dataset.index);
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  draggedCardIndex = null;
  document.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.target.closest('.card');
  if (card) {
    document.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over'));
    card.classList.add('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  const targetCard = e.target.closest('.card');
  if (targetCard && draggedCardIndex !== null) {
    const toIndex = parseInt(targetCard.dataset.index);
    if (draggedCardIndex !== toIndex) {
      socket.emit('move-card', { fromIndex: draggedCardIndex, toIndex });
    }
  }
}

// Drop zone for placing new cards
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
});

// Click to place your card
dropZone.addEventListener('click', () => {
  if (gameState && gameState.status === 'playing') {
    const myCardPlaced = gameState.cardLine.includes(myId);
    if (!myCardPlaced) {
      socket.emit('place-card', gameState.cardLine.length);
    }
  }
});

// Also allow clicking on card line area to place
cardLine.addEventListener('click', (e) => {
  if (gameState && gameState.status === 'playing' && !e.target.closest('.card')) {
    const myCardPlaced = gameState.cardLine.includes(myId);
    if (!myCardPlaced) {
      socket.emit('place-card', gameState.cardLine.length);
    }
  }
});

// Result Screen
const resultTitle = document.getElementById('result-title');
const finalOrder = document.getElementById('final-order');
const playAgainBtn = document.getElementById('play-again-btn');

playAgainBtn.addEventListener('click', () => {
  if (isHost) {
    socket.emit('play-again');
  }
});

function showResult(result, order) {
  resultTitle.textContent = result === 'win' ? 'You Win!' : 'You Lose!';
  resultTitle.className = result;

  finalOrder.innerHTML = '';
  order.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <span class="result-number">${item.number}</span>
      <span class="result-name">${item.name}</span>
    `;

    // Mark if out of order
    if (index > 0 && item.number < order[index - 1].number) {
      card.classList.add('wrong');
    }

    finalOrder.appendChild(card);
  });

  playAgainBtn.style.display = isHost ? 'block' : 'none';
  showScreen('result');
}

// Socket Events
socket.on('connect', () => {
  myId = socket.id;
});

socket.on('game-created', ({ code }) => {
  showScreen('lobby');
});

socket.on('game-joined', ({ code }) => {
  showScreen('lobby');
});

socket.on('game-state', (state) => {
  gameState = state;
  isHost = state.hostId === myId;

  if (state.status === 'lobby') {
    updateLobby(state);
    if (screens.landing.classList.contains('active')) {
      showScreen('lobby');
    }
  } else if (state.status === 'playing' || state.status === 'revealing') {
    updateGame(state);
    if (!screens.game.classList.contains('active') && !screens.result.classList.contains('active')) {
      showScreen('game');
    }
  }
});

socket.on('round-started', ({ yourNumber }) => {
  myNumber = yourNumber;
  showScreen('game');
});

socket.on('player-joined', (player) => {
  // State update will handle UI refresh
});

socket.on('player-left', ({ playerId, playerName }) => {
  gameStatus.textContent = `${playerName} left the game`;
  setTimeout(() => gameStatus.textContent = '', 3000);
});

socket.on('card-revealed', ({ index, playerId, playerName, number, isCorrect }) => {
  const cards = cardLine.querySelectorAll('.card');
  if (cards[index]) {
    const card = cards[index];
    const numberSpan = card.querySelector('.card-number');
    numberSpan.textContent = number;
    card.classList.add('revealed');
    card.classList.add(isCorrect ? 'correct' : 'wrong');
  }
});

socket.on('round-ended', ({ result, finalOrder: order }) => {
  showResult(result, order);
});

socket.on('host-changed', ({ newHostId }) => {
  isHost = newHostId === myId;
  if (gameState) {
    gameState.hostId = newHostId;
    if (gameState.status === 'lobby') {
      updateLobby(gameState);
    }
  }
});

socket.on('error', (message) => {
  if (screens.landing.classList.contains('active')) {
    landingError.textContent = message;
  } else {
    gameStatus.textContent = message;
    setTimeout(() => gameStatus.textContent = '', 3000);
  }
});
