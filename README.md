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

## Soccer tab — The Neighborhood Cup

Select **Soccer**, then **Kick off**. Play as Meadow (green), attacking right, against Terracotta. Choose two or four outfield players plus an automatic goalkeeper per team. Matches have two, four, or six minutes of playing time; goal celebrations and pauses stop the clock. A level score at full time is a draw.

- **WASD / arrow keys:** move. Diagonal movement is normalized.
- **Space:** pass ahead of your teammate and automatically select the receiver.
- **Hold J, then release:** charge and shoot. Directional input aims the shot; without it, aim defaults toward the opposing goal. Charging slows your player.
- **K:** switch outfield players; hold a direction to prefer a teammate in that direction. A bright ring and arrow identify the selected player.
- **Shift:** sprint. The energy meter drains while sprinting and recovers afterward. Sprinting pushes the ball farther ahead, making it easier to steal.
- **Esc / Pause:** pause or resume. Leaving the Soccer tab, switching browser tabs, or losing window focus pauses the match. Return and choose **Back to the pitch** to resume.
- Touch screens have directional and action buttons. Hold the on-screen Shoot button to charge, then release it.

Get beside an exposed ball to knock it loose. Fast shots can deflect off outfield players; keepers save nearby shots and pass back out. Boards rebound the ball into play. Goals require the whole ball to cross between the posts. No fouls, offsides, throw-ins, or corners. Easy, Medium, and Hard adjust the computer's speed, reaction time, and shot accuracy. Sound can be toggled during play. New match asks before clearing an unfinished match.

The soccer game uses Phaser 3.90 for rendering and TypeScript for a custom, fixed-step simulation with substepped ball collisions. Players, pitch, and effects are drawn in code; sounds are synthesized locally. No asset services or backend are needed. The generated `soccer/soccer.bundle.js` includes Phaser and is deliberately included in the project so the entire collection still works by opening `index.html` directly, offline.

### Soccer development

Node.js 20.19+ (or 22.12+) is required for the development tooling.

```sh
cd soccer
npm ci
npm run dev
```

Open the local URL printed by Vite. It serves the entire game collection and loads soccer from TypeScript source. Reloading during development resets matches. To regenerate the offline bundle after editing soccer source:

```sh
npm run build
npm test
```

The soccer tests cover movement, sprint energy, passes, shot power, stealing, goal-line rules, board rebounds, goalkeeper collisions and distribution, full-time freezing, and complete simulated matches on all difficulties. The root `node test.js` suite also checks navigation and preservation of pending board-game turns. Phaser's MIT license is included in `soccer/PHASER-LICENSE.txt`.

### Run the server in a detached tmux session

With tmux installed and dependencies installed using `npm ci`, run these commands from the project's `soccer` folder:

```sh
tmux new -s myapp
npm run dev -- --host 0.0.0.0
```

The server listens on all network interfaces. Use the URL and port printed by Vite to access the game collection.

Detach with **Ctrl+B**, then **D**. The server keeps running inside tmux. Reattach anytime with:

```sh
tmux attach -t myapp
```

To stop the server, reattach and press **Ctrl+C**.

### Soccer God mode

Enable **God mode** in the soccer match panel to unlock two extra shots for your selected player while they have possession:

- **H — Homing shot:** tap once to send the ball along an automatically replanned route around players and the goalkeeper toward the opposing goal. A blue glow and trail identify it. It tries to score; normal collisions still apply.
- **N — Guaranteed tackle:** press near an opponent (within 62 pitch units) to knock them off balance for 1.1 seconds. If they have the ball, it rolls away at speed and they cannot immediately recover it. Every in-range tackle succeeds, from any direction, including against the keeper. There is no chance roll or tackle cooldown. Out of range, N does nothing. If several opponents are in reach, the ball carrier takes priority.

Touch controls include Homing H and Tackle N buttons, disabled until God mode is enabled. J remains the ordinary charged shot. N replaces the former curve shot and never works with God mode off. Turning God mode off cancels active homing steering; an already tackled player finishes recovering normally. The toggle survives new matches and tab switches within this page session. Goals and restarts reset stagger effects.

### Team size and match length

Choose **3v3** (one keeper and two outfield players) or **5v5** (one keeper, one defender, two wide midfielders, and one forward). Choose **2, 4, or 6 minutes** of playing time. These selectors apply when you next start a match; changing them does not alter an ongoing match. The match panel shows the active format. Goal celebrations, pauses, and tab switches do not consume playing time.

Hold a direction and press **Space** to prefer a teammate in that direction; without a direction, passing favors nearby teammates with open lanes and forward progress. Control switches to the intended receiver. **K** selects the other outfield player closest to the ball; hold a direction to prefer a teammate in that direction. Keepers remain automatic. In 5v5, AI players spread into a diamond, cover passing lanes when defending, and send one player toward loose balls while supporting players keep their spacing. H homing shots and N guaranteed God mode tackles work with either team size.

### Selected special skill — Dragon Shot

With God mode enabled, the **Special skill** dropdown appears. Select **Dragon Shot**, then press **U** while your selected player has possession. WASD or arrows aim the shot; with no direction, it aims toward the opponent's goal. The on-screen **Skill U** button activates the same selection. H homing, N tackle, J charged shooting, and Space passing are unchanged.

Dragon Shot has an orange glow and trail, travels faster than a fully charged regular shot, passes through teammates, and knocks opposing players (including keepers) sideways off balance. It cannot be intercepted and keeps full speed until it scores or hits the pitch boundary. A boundary rebound returns to normal ball physics. Disabling God mode prevents new activations but does not extinguish an already launched Dragon Shot. Pausing freezes flight; full time and new matches end it.

### Magical Pass

Select **Magical Pass** in the God mode skill dropdown and press **U** with possession. The match and clock freeze while numbered targets highlight your other outfield teammates. Click or tap a target to resume play and launch a purple, curved pass. Opponents in its path are knocked aside; teammates cannot intercept it. The receiver waits for delivery, then takes possession and becomes your controlled player. Esc does not cancel target selection. Goalkeepers and opposing players cannot be selected. Starting a new match resets selection and flight.

### CR7

With God mode on, select **CR7** and press **U**, with or without possession. Your selected player gains a golden aura for **8 seconds**, **1.5× movement speed** (including sprint), and automatic contact knockback against opponents, including the goalkeeper. Contact knocks their ball loose; teammates are unaffected. A countdown appears below the pitch. U refreshes the duration instead of stacking speed. The aura stays with the activating player when you switch control. Pauses freeze its timer; expiry, disabling God mode, goals, full time, and new matches clear it.
