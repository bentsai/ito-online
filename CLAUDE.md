# Ito Online - Project Context

## What This Is
Online multiplayer version of the cooperative card game "ito". Players get secret numbers (1-100), discuss vaguely via external voice chat, arrange face-down cards in ascending order, then reveal to see if they got it right.

## Current State: MVP Complete, Needs Testing

The core game is implemented and running. Needs real browser testing to find bugs.

## Tech Stack
- **Backend**: Node.js + Express + Socket.io
- **Frontend**: Vanilla HTML/CSS/JS (single-page app)
- **State**: In-memory (no database)

## File Structure
```
server/
  index.js    - Express + Socket.io server, all event handlers
  game.js     - Game state management (create, join, place, move, reveal)
  utils.js    - Code generation, shuffle

public/
  index.html  - Single HTML file with 4 screens
  css/style.css
  js/app.js   - All frontend logic + Socket.io client
```

## Game Flow
1. Landing: Enter name → Create Game or Join Game (with 4-char code)
2. Lobby: See players, host clicks "Start Round"
3. Playing: See your number, click to place card, drag to reorder any card
4. Reveal: Click "Reveal Next" to flip cards one by one
5. Result: Win/Lose screen, host can click "Play Again"

## To Run
```bash
npm start
# Open http://localhost:3000
```

## Priority Fix: Card Placement UX

The current interaction for placing cards is confusing. Players don't know where their card will go.

**Current (bad):**
- Click on drop zone → card goes to end of line
- No visual feedback about placement position

**Better approach ideas:**
1. **Slot-based**: Show empty slots between cards. Click a slot to place your card there.
2. **Your card visible**: Show your face-down card in a "Your Card" area. Drag it into the line at any position.
3. **Insert markers**: When dragging, show insertion points between existing cards.
4. **Preview ghost**: Show a translucent preview of where your card will land.

Recommend option 2: Show player's unplaced card visually, let them drag it into the line. This makes it clear:
- You have a card to place
- Where it will go when you drop it

## Known Issues / To Test
- [ ] Fix card placement UX (priority)
- [ ] Test with 2+ browsers to verify real-time sync
- [ ] Test drag-and-drop card reordering
- [ ] Test host disconnect (should transfer host role)
- [ ] Test reveal flow (win and lose scenarios)
- [ ] Mobile responsiveness

## Design Doc
Full design spec at: `docs/plans/2026-01-21-ito-online-mvp-design.md`

## Next Steps (if MVP works)
- Add sound effects for card placement/reveal
- Add theme/clue prompts for describing numbers
- Add multiple rounds with scoring
- Deploy somewhere (Railway, Fly.io, etc.)
