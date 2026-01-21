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

## Priority Fix: Landing Page UX

Current layout is confusing:
```
[Name input]
[Create Game button]
-- or --
[Game code input] [Join Game button]
```

Problem: If joining a game, user has to look past "Create Game" to find join. Name input purpose is unclear.

**Better approach:**
- Two clear paths side-by-side or tabbed: "Create Game" vs "Join Game"
- Name input appears after choosing which path
- Or: Single flow where you enter code (optional) + name, then one button figures out create vs join

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

Recommend option 1: Remove drag and drop functionality for a simpler interaction.
Consider a click-based slot approach. There should be click targets along the line that allows users to
position their cards anywhere along the line. It should also be keyboard accessible. So perhaps it can use
radio buttons behind the scenes.

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
