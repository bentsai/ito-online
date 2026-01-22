// Connect to Socket.io
const socket = io();

// Generate or retrieve persistent player ID
function getPlayerId() {
  let id = sessionStorage.getItem('playerId');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('playerId', id);
  }
  return id;
}

// State
let gameState = null;
let myId = getPlayerId();
let isHost = false;
let myNumber = null;

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
const tabCreate = document.getElementById('tab-create');
const tabJoin = document.getElementById('tab-join');
const panelCreate = document.getElementById('panel-create');
const panelJoin = document.getElementById('panel-join');
const createNameInput = document.getElementById('create-name');
const joinNameInput = document.getElementById('join-name');
const joinCodeInput = document.getElementById('join-code');
const createGameBtn = document.getElementById('create-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const landingError = document.getElementById('landing-error');

// Tab switching
function switchTab(tab) {
  landingError.textContent = '';
  if (tab === 'create') {
    tabCreate.classList.add('active');
    tabJoin.classList.remove('active');
    panelCreate.classList.add('active');
    panelJoin.classList.remove('active');
    createNameInput.focus();
  } else {
    tabJoin.classList.add('active');
    tabCreate.classList.remove('active');
    panelJoin.classList.add('active');
    panelCreate.classList.remove('active');
    joinCodeInput.focus();
  }
}

tabCreate.addEventListener('click', () => switchTab('create'));
tabJoin.addEventListener('click', () => switchTab('join'));

createGameBtn.addEventListener('click', () => {
  const name = createNameInput.value.trim();
  if (!name) {
    landingError.textContent = 'Please enter your name';
    return;
  }
  sessionStorage.setItem('playerName', name);
  socket.emit('create-game', { playerId: myId, name });
});

joinGameBtn.addEventListener('click', () => {
  const code = joinCodeInput.value.trim().toUpperCase();
  const name = joinNameInput.value.trim();
  if (!code || code.length !== 4) {
    landingError.textContent = 'Please enter a valid 4-character game code';
    return;
  }
  if (!name) {
    landingError.textContent = 'Please enter your name';
    return;
  }
  sessionStorage.setItem('playerName', name);
  sessionStorage.setItem('gameCode', code);
  socket.emit('join-game', { code, name, playerId: myId });
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
const placementHint = document.getElementById('placement-hint');
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

  // Update card line with slots
  cardLine.innerHTML = '';
  const placedIds = new Set(state.cardLine);
  const myCardPlaced = placedIds.has(myId);
  const showSlots = state.status === 'playing';

  // Add Low label
  const lowLabel = document.createElement('span');
  lowLabel.className = 'end-label';
  lowLabel.textContent = 'Low';
  cardLine.appendChild(lowLabel);

  if (showSlots) {
    // Create fieldset for accessibility
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'slot-fieldset';

    const legend = document.createElement('legend');
    legend.className = 'visually-hidden';
    legend.textContent = 'Choose position for your card';
    fieldset.appendChild(legend);

    // Find current position of player's card (if placed)
    const myCurrentIndex = myCardPlaced ? state.cardLine.indexOf(myId) : -1;

    // Render slots interleaved with cards
    for (let i = 0; i <= state.cardLine.length; i++) {
      // Skip slots adjacent to player's current position (they're redundant)
      const isRedundantSlot = myCardPlaced && (i === myCurrentIndex || i === myCurrentIndex + 1);

      if (!isRedundantSlot) {
        const slot = createSlot(i, myCardPlaced);
        fieldset.appendChild(slot);
      }

      // Add card after slot (if there is one)
      if (i < state.cardLine.length) {
        const playerId = state.cardLine[i];
        const player = state.players.find(p => p.id === playerId);
        const playerIndex = state.players.findIndex(p => p.id === playerId);
        const card = createCard(player, i, state.status, state.revealedCards, playerIndex);
        fieldset.appendChild(card);
      }
    }

    cardLine.appendChild(fieldset);
  } else {
    // No slots during reveal - just show cards
    state.cardLine.forEach((playerId, index) => {
      const player = state.players.find(p => p.id === playerId);
      const playerIndex = state.players.findIndex(p => p.id === playerId);
      const card = createCard(player, index, state.status, state.revealedCards, playerIndex);
      cardLine.appendChild(card);
    });
  }

  // Add High label
  const highLabel = document.createElement('span');
  highLabel.className = 'end-label';
  highLabel.textContent = 'High';
  cardLine.appendChild(highLabel);

  // Update placement hint
  if (state.status === 'playing') {
    if (!myCardPlaced) {
      placementHint.textContent = 'Click a slot to place your card';
    } else {
      placementHint.textContent = 'Click a slot to move your card';
    }
  } else {
    placementHint.textContent = '';
  }

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
  } else if (state.status === 'revealing') {
    revealBtn.textContent = 'Reveal Next';
    revealBtn.disabled = false;
    revealBtn.style.display = 'block';
  } else {
    revealBtn.style.display = 'none';
  }
}

function createCard(player, index, status, revealedCards, playerIndex) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.index = index;
  card.dataset.playerId = player.id;

  // Add player color class
  if (playerIndex !== undefined) {
    card.classList.add(`player-${playerIndex % 10}`);
  }

  if (player.id === myId) {
    card.classList.add('my-card');
  }

  // Check if this card has been revealed
  const revealedInfo = revealedCards && revealedCards[player.id];
  if (revealedInfo) {
    card.classList.add('revealed');
    card.classList.add(revealedInfo.isCorrect ? 'correct' : 'wrong');
  }

  // Card content
  const nameSpan = document.createElement('span');
  nameSpan.className = 'card-name';
  nameSpan.textContent = player.name;

  const numberSpan = document.createElement('span');
  numberSpan.className = 'card-number';
  numberSpan.textContent = revealedInfo ? revealedInfo.number : '?';

  card.appendChild(numberSpan);
  card.appendChild(nameSpan);

  return card;
}

// Create a slot element for placing/moving cards
function createSlot(position, myCardPlaced) {
  const label = document.createElement('label');
  label.className = 'slot';

  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'card-position';
  radio.value = position;
  radio.className = 'visually-hidden';

  const indicator = document.createElement('div');
  indicator.className = 'slot-indicator';

  label.appendChild(radio);
  label.appendChild(indicator);

  // Handle click/selection
  const handleSelect = () => {
    handleSlotClick(position, myCardPlaced);
  };

  label.addEventListener('click', handleSelect);
  radio.addEventListener('change', handleSelect);

  return label;
}

// Handle slot selection
function handleSlotClick(position, myCardPlaced) {
  if (!gameState || gameState.status !== 'playing') return;

  if (!myCardPlaced) {
    // Place card at position
    socket.emit('place-card', position);
  } else {
    // Move card to new position
    const currentIndex = gameState.cardLine.indexOf(myId);
    if (currentIndex !== -1 && currentIndex !== position) {
      // Adjust position if moving to a later slot (accounting for removal)
      const toIndex = position > currentIndex ? position - 1 : position;
      if (currentIndex !== toIndex) {
        socket.emit('move-card', { fromIndex: currentIndex, toIndex });
      }
    }
  }
}

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
  // Attempt to rejoin if we have stored session
  const storedCode = sessionStorage.getItem('gameCode');
  const storedName = sessionStorage.getItem('playerName');
  if (storedCode && storedName) {
    socket.emit('rejoin-game', { code: storedCode, name: storedName, playerId: myId });
  }
});

socket.on('game-created', ({ code }) => {
  sessionStorage.setItem('gameCode', code);
  showScreen('lobby');
});

socket.on('game-joined', ({ code }) => {
  sessionStorage.setItem('gameCode', code);
  showScreen('lobby');
});

socket.on('rejoin-failed', () => {
  // Clear stale session data
  sessionStorage.removeItem('gameCode');
  sessionStorage.removeItem('playerName');
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
