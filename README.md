# Five

An offline five-in-a-row game. Open `index.html` in your browser. No server, installation, or internet connection is needed.

- 15 × 15 board. X starts; players alternate placing one mark in an empty square.
- Five or more consecutive matching marks horizontally, vertically, or diagonally win. A full board without a line is a draw.
- Play with a friend on one device or against the computer (you play X).
- Undo a move; against the computer, undo takes back the computer response and your preceding move.
- **Computer vs Computer:** choose a difficulty for both sides, then press **Start game**. The computers alternate automatically until a win or draw. **New round** clears the board and waits for Start again. Undo is disabled in this mode.
- Separate session scores for all three modes. Reloading clears the game and scores.
- Select **Vs computer**, then choose a difficulty. You play X; the computer plays O.
- **Easy:** takes immediate wins, blocks immediate losses, and chooses moves by nearby line strength.
- **Medium:** recognizes broken lines and double threats, and considers the opponent’s reply.
- **Hard:** uses iterative minimax search with alpha-beta pruning, looking up to four plies ahead with a limited set of promising moves. Search has a 250 ms budget (checked between search nodes) to keep turns short.
- **Master:** iterative alpha-beta search up to eight plies, a wider candidate set, broken-line and fork-aware move ordering, cached exact positions, and up to four extra forced-block plies at the search horizon. Uses an approximately 1.8-second search budget plus the turn delay. Search yields between batches so Undo and New round can cancel it. It keeps the best fully completed iteration if time expires.
- Master is the strongest search setting, but is not mathematically unbeatable: time and candidate limits still apply, and it plays second under the same rules as you.
- Change difficulty during a round; the next computer calculation uses the new setting. The computer runs entirely offline, without an API or service.
- This is a bounded tactical opponent, not an unbeatable or tournament-level Gomoku engine.
- Keyboard: Tab to an empty square, arrow keys to navigate, Enter or Space to place a mark.

Run rule checks with `node test.js`.

- **God mod:** toggle this on in Two players or Vs computer to give human X two placements per turn. O still places one mark. A win ends the match immediately, even on the first placement. Finish both marks (or undo) before toggling it off. After a computer reply, Undo removes that reply and the entire preceding X turn. The setting persists across new rounds but never applies in Computer vs Computer. The AI continues to evaluate normal alternating-play rules; this is a player advantage, not a new AI ruleset.

## Chinese chess tab

Select **Chinese chess** to play Xiangqi against the computer. You are Red and move first. Click a red piece and then a highlighted legal destination. Chinese characters have small English labels and accessible full names. Undo takes back your move and Black's reply. Tabs retain their separate matches and pause background thinking.

Easy searches up to 1 ply / 100 ms, Medium 2 / 350 ms, Hard 4 / 900 ms, and Master 6 / 2,000 ms, with up to two additional check-evasion plies in Master. All use iterative alpha-beta search, capture ordering, material and positional evaluation. These are bounded custom engines, not rated or unbeatable opponents.

Rules cover palace restrictions, flying generals, horse legs, elephant eyes and river restrictions, cannon screens, soldier movement after crossing, self-check, checkmate, and stalemate as a loss. Casual draws use three occurrences of the same position and side to move, or 120 half-moves without a capture. Tournament perpetual-check/chasing adjudication is not implemented. God mod is only for Gomoku.

Rule references: https://www.xiangqi.com/help/pieces-and-moves and https://www.xiangqi.com/help/board-and-set-up
Run `node xiangqi-test.js` for rules and AI checks, and `node test.js` for both games' controller checks. Browser visual verification remains pending because the browser tool blocks local file URLs.
