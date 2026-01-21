# Ito Online - MVP Design

## Overview

A web-based implementation of the cooperative card game "ito" where players receive secret numbers (1-100) and must arrange their cards in ascending order without revealing their exact values.

## User Flow

### Landing Page
- Two options: "Create Game" or "Join Game"
- **Create Game**: Generates a unique 4-character game code (e.g., "AXBQ"), takes player to lobby as host
- **Join Game**: Enter game code + display name, takes player to lobby

### Lobby
- Shows game code prominently (click to copy)
- Lists all players who have joined
- Host sees "Start Round" button (disabled until 2+ players)
- Non-hosts see "Waiting for host to start..."

### Game Round
1. All players see their secret number (only theirs)
2. Shared play area: horizontal line where face-down cards get placed
3. Players drag-and-drop cards into the line; anyone can rearrange any card
4. Any player can click "Reveal" when group is ready
5. Cards flip one at a time via click
6. All ascending = win; first out-of-order card = lose
7. "Play Again" button to start a new round

## Data Model

```javascript
game: {
  code: "AXBQ",                          // 4-char unique identifier
  hostId: "player-uuid",                 // current host
  status: "lobby" | "playing" | "revealing" | "ended",
  players: [
    { id: "uuid", name: "Alice", number: null | 47 }
  ],
  cardLine: ["player-id-1", "player-id-2", ...],  // ordered player IDs
  revealIndex: 0,                        // next card to reveal
  result: null | "win" | "lose"
}
```

### State Transitions
1. `lobby` → `playing`: Host clicks start; server deals unique numbers
2. `playing` → `revealing`: Any player clicks reveal; line is locked
3. `revealing` → `ended`: All cards revealed (win) or out-of-order found (lose)
4. `ended` → `playing`: Host clicks "Play Again"; new numbers dealt

### Number Dealing
- Server shuffles array [1-100], assigns one to each player
- Numbers stay on server until reveal phase
- Client only knows their own number during play

## Real-Time Events (Socket.io)

### Client → Server
| Event | Description |
|-------|-------------|
| `create-game` | Create new game, returns code |
| `join-game(code, name)` | Join existing game |
| `start-round` | Host only, deals numbers |
| `place-card(position)` | Place your card at position |
| `move-card(fromIndex, toIndex)` | Rearrange any card |
| `start-reveal` | Lock line, begin reveals |
| `reveal-next` | Flip next card |
| `play-again` | Host only, reset for new round |

### Server → Clients
| Event | Description |
|-------|-------------|
| `player-joined(player)` | Update lobby list |
| `player-left(playerId)` | Someone disconnected |
| `round-started(yourNumber)` | Private: your number |
| `card-placed(playerId, position)` | Show face-down card |
| `card-moved(fromIndex, toIndex)` | Animate rearrangement |
| `reveal-started` | Lock all dragging |
| `card-revealed(index, playerId, number)` | Show flipped card |
| `round-ended(result, finalOrder)` | Win/lose + all numbers |

## UI Layout

### Lobby Screen
```
┌─────────────────────────────────────┐
│         Game Code: AXBQ             │
│        (click to copy)              │
├─────────────────────────────────────┤
│  Players:                           │
│    • Alice (host)                   │
│    • Bob                            │
│    • Carol                          │
├─────────────────────────────────────┤
│        [ Start Round ]              │  ← host only
└─────────────────────────────────────┘
```

### Playing Screen
```
┌─────────────────────────────────────┐
│  Your Number: 47                    │
├─────────────────────────────────────┤
│  Card Line (drag to reorder):       │
│  ┌───┐ ┌───┐ ┌───┐                  │
│  │ ? │ │ ? │ │ ? │  ← face-down     │
│  │Bob│ │You│ │Car│     cards        │
│  └───┘ └───┘ └───┘                  │
├─────────────────────────────────────┤
│  Not placed: Alice                  │
│                                     │
│        [ Reveal Cards ]             │
└─────────────────────────────────────┘
```

### Reveal Screen
- Same layout, cards flip one by one showing the number
- Green border = correct order so far
- Red border + "FAIL" = out of order, game ends

## File Structure

```
ito-online/
├── server/
│   ├── index.js          # Express + Socket.io setup
│   ├── game.js           # Game state management
│   └── utils.js          # Code generation, shuffle
├── public/
│   ├── index.html        # Landing page (create/join)
│   ├── lobby.html        # Waiting room
│   ├── game.html         # Main game screen
│   ├── css/
│   │   └── style.css     # All styles
│   └── js/
│       ├── socket.js     # Socket.io client wrapper
│       ├── lobby.js      # Lobby logic
│       └── game.js       # Game UI + drag-drop
└── package.json
```

## Tech Stack

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **State**: In-memory (no database)
- **Dependencies**: `express`, `socket.io`

## Edge Cases & Error Handling

### Player Disconnects
- **During lobby**: Remove from player list, notify others
- **During play**: Card remains in line (if placed), others can still move it
- **Host disconnects**: Transfer host role to next player, or end game if empty

### Invalid Actions
- Join non-existent code → "Game not found"
- Join game in progress → "Game already started"
- Start with <2 players → Button disabled
- Reveal before all cards placed → "All players must place their card first"

### Race Conditions
- Two players move same card → Server is source of truth, last write wins
- Player joins as host clicks start → Player joins lobby, waits for next round

### Game Codes
- 4 alphanumeric characters (~1.6M combinations)
- Check for collision before assigning
- Games auto-delete after 1 hour of inactivity

## Out of Scope (Future)

- Theme/clue prompts for describing numbers
- Multiple cards per player
- User accounts/persistence
- Spectator mode
- In-app chat
- Multiple lives/rounds system
