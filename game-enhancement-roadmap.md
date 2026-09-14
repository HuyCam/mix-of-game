# Soccer Game Enhancement Roadmap

Working plan for evolving the Soccer tab ("The Neighborhood Cup") beyond its current
procedural-drawing engine. Captures the direction agreed on in planning discussion —
not a spec, just the shared plan to work from and revise as things change.

## Design philosophy

Not a progression/grind game (no RuneScape-style XP economy, no long unlock chains).
The target is **arcade sports with systems** — closer to Mario Strikers or NBA Jam:
lots of skills, items, and chaos available *now*, in the match, not gated behind
persistent progression. Match-to-match variety comes from randomness and player
choice, not from a save file.

## Art & animation direction

- **Style:** stay low-poly / flat-vector — a direct evolution of the current
  hand-drawn polygon look in `main.ts`, not a pivot to pixel art. Reasoning:
  - Skeletal rigging (bones rotating/scaling attached art) fights pixel art —
    rotation at arbitrary angles blurs a pixel grid. Flat/vector art has no such
    problem.
  - Matches the look of RuneScape, which is low-poly 3D, not pixel art.
- **Animation tech:** [Spine](https://esotericsoftware.com/), via the official
  `@esotericsoftware/spine-phaser-v3` runtime (npm), built specifically for
  Phaser 3.60+. Replaces the current per-frame `g.fillPoints()`/`fillTriangle()`
  player drawing in `main.ts` with real bone-driven animation (idle/run/sprint/
  shoot/tackle), plus mesh-based effects for auras/cloth-like deformation.
  - Cost: Essential $69 one-time (no mesh deformation), Professional $369
    (adds meshes). Upgrade later for the price difference if meshes turn out
    to matter.
  - Free fallback for prototyping the *workflow* before paying: DragonBones
    (open-source, similar bone/atlas model, less actively maintained).

## Game systems to add (not progression — moment-to-moment variety)

- **Field items/pickups** — spawn on the pitch mid-match: speed burst, temporary
  giant-player size, a trip hazard, a ball that splits into multiples. Highest-impact
  addition — introduces real-time decisions ("go for the item or the ball?") that
  nothing in the current design has.
- **Pre-match loadouts** — pick 2 of N skills before kickoff instead of one fixed
  dropdown. Everything is available from match one; the choice is the system, not
  an unlock.
- **Match hazards/variety** — weather, a shrinking pitch in extra time, moving
  obstacles — keeps repeat matches feeling different without needing a save file.
- **Cosmetics** — jersey colors, trail colors, celebration flourishes, picked freely
  from a menu. Fun, not a reward.
- **More skills** (candidates from earlier brainstorm): Meteor Shot (AoE knockback
  landing), Time Freeze, Phantom Dash, Colossus (bulk + unstaggerable), Mirror Shot
  (decoy balls), Force Wall, Magnet Pull.

## Tech stack changes

| Piece | Now | Target |
|---|---|---|
| Player rendering | Procedural polygon drawing every frame (`main.ts`) | Spine `SpineGameObject`s driven by named animations |
| Art assets | None — everything is code | PNG body-part pieces, rigged in Spine Editor, exported as skeleton + atlas |
| VFX | Hand-rolled `sparks` array + manual circles | Phaser particle emitters, possibly combined with Spine mesh attachments |
| Distribution | Single `soccer.bundle.js`, fully offline, no external files | Bundle + an `assets/` folder — still fully offline, just no longer one file. Explicit tradeoff to accept before scaling art. |

No engine change needed (Vite + Phaser + TypeScript stays); this is additive
tooling, not a rewrite.

## Asset acquisition plan

Three tiers, in order of effort vs. customization:

- **Tier 0 — buy an already-rigged character** (a `.spine` project). Fastest,
  zero rigging work, but a generic look.
- **Tier 1 — buy/download unrigged, part-separated art, rig it yourself** in
  the Spine Editor. Originally scoped as sourceable from Kenney.nl — **corrected
  after actually browsing the catalog (see below): Kenney doesn't ship this
  format**, so Tier 1 needs a different source if pursued.
- **Tier 2 — commission custom art/rigging** (Fiverr/Upwork/ArtStation/itch.io
  job boards). Costs real money, gets a genuinely unique character.

AI image generation was considered and ruled out for this specific job — it can't
produce the same character's body parts consistently across dozens of separate,
correctly-posed images, which is exactly what rigging needs. Fine for mood boards,
not for rig-ready source art.

### Kenney.nl findings (browsed directly, not assumed)

Kenney's 2D character packs ship as many **pre-baked pose/frame sprites**, not
separated bone-ready limb layers — e.g. [Toon Characters](https://kenney.nl/assets/toon-characters)
is literally "270 files = 6 characters × 45 poses each," not split parts. This
doesn't satisfy Tier 1 as scoped. It does open a simpler option:

- **[Toon Characters](https://kenney.nl/assets/toon-characters)** — free, CC0.
  Best style match to the current flat/vector look. **Recommended path:**
  use for **frame-based sprite animation** instead of Spine rigging — swap the
  sprite per game state (idle/run/kick), no bones, no rigging session, no Spine
  purchase. Matches the "don't want to fiddle with art much" preference better
  than Tier 1 ever did.
- **[Sports Pack](https://kenney.nl/assets/sports-pack)** — free, CC0. Already
  a top-down soccer asset set: pitch tiles, ball, goal props, small top-down
  player tokens. Worth grabbing for the pitch/ball/environment side regardless
  of the character-art decision.
- **[Platformer Characters](https://kenney.nl/assets/platformer-characters)** —
  free, CC0. Same pre-posed-frame format as Toon Characters; a fallback style
  option.

If real Spine rigging is still wanted without doing the rigging yourself,
itch.io's [assets tagged "spine"](https://itch.io/game-assets/tag-spine) has
cheap, already-rigged options (Tier 0) — e.g. **Warrior Girl ($3)** as a
low-stakes test, or **2D Platformer Characters Bundle ($30, Spine & Sprites)**,
which ships both a Spine rig and plain sprites.

## Alternative path: full 3D migration (low-poly, broadcast camera only) — considered, not pursued

**Decision: staying 2D.** 3D was judged too ambitious for a first pass at
scaling this project up — kept below for reference in case it's revisited
once the 2D/Spine path has shipped and there's a real baseline to compare
against.

Considered as an alternative to the 2D Spine upgrade above — a pure rendering
migration to low-poly 3D (RuneScape/FC26-style), no new features bundled in,
kept deliberately narrow so it can plausibly fit in ~50 hours of work.

### Scope cuts that make this feasible

- **Single camera only** — a fixed broadcast/"Tele" camera like FC26's, not a
  free or multi-angle camera. Cuts an entire category of work: no camera-
  switching UI, no drag/orbit controls, no collision-avoidance for arbitrary
  user-chosen angles. Still needs real camera-follow logic (tracking the ball,
  panning, zooming with play), but that's bounded work, not open-ended.
- **2.5D, not real 3D physics** — keep the existing `engine.ts` simulation
  exactly as-is (flat x/y ground-plane positions, velocities, collisions).
  Only the *renderer* becomes 3D. Ball height for chips/headers is a cosmetic
  visual offset, not real 3D collision physics — invisible as a simplification
  from a broadcast-height camera. This is the actual physics-side scope cut,
  and it's independent of camera choice — but pairing it with a single fixed
  camera removes almost all incentive to ever add real 3D physics.
- **Lower art fidelity is fine** — a broadcast camera sits elevated and
  distant, so low polycounts, simple textures, and no back-of-model detail all
  read fine. Also makes LOD trivial: one polycount target for every asset, no
  multiple detail levels to author.
- **One rigged model, reused everywhere** — a single humanoid rig, palette/
  kit-swapped per team and per player number, the same trick the 2D game (and
  RuneScape) already use. Keeps the actual unique-asset count to roughly 5-8
  items: player, ball, pitch, goal, stadium backdrop.

### Engine choice

**Babylon.js**, not Three.js — TypeScript-first (matches the current stack),
ships built-in tooling (physics, an inspector, a playground), less setup
friction than Three.js's more minimal, build-it-yourself approach.

### AI-assisted asset generation

Checked current tool capability directly rather than assume from memory,
since this space moves fast: **Meshy** does text/image-to-3D generation with
**auto-rigging built in** — a humanoid mesh goes from prompt to a rigged,
game-ready model with 500+ animation presets, exported as FBX/GLB, in well
under a minute of generation time. This is the step that used to take 10-25
hours by hand (model, UV, rig, weight-paint) — now realistically a few hours
including regeneration attempts to land on something usable. Doesn't remove:
cleanup for style consistency across independently generated assets (character,
ball, stadium won't automatically match each other), or the engineering work
of the camera/lighting/animation-blending system itself.

### Revised time estimate

With the single-camera + 2.5D + reused-rig cuts above: **~35-55 hours**, down
from an open/free-camera estimate of 70-120 hours. Contingent on keeping the
2D simulation core completely unchanged.

### Recommended first step

A **2-4 hour timeboxed spike**: generate one character in Meshy with
auto-rig, drop it into a minimal Babylon.js scene, measure actual hours
spent. Turns the estimate above from a guess into a number extrapolated from
real data, before committing further hours either direction.

## Division of labor

**Only the user can do:**
- Pick the specific asset pack (taste call; can be shortlisted, not decided, by AI).
- Any purchase/checkout (Spine license, paid packs, commissions) — payment entry
  is never delegated.
- Install and run the Spine Editor, build the bone hierarchy, author animations,
  and export the rig. No available tooling automates a native desktop app like
  Spine Editor (only a browser and the iOS Simulator are automatable here).
- Playtesting and taste feedback — whether an item feels fun, whether an effect
  is too much, whether a run cycle looks right.

**Claude/AI can do:**
- Shortlist candidate low-poly packs from Kenney.nl/itch.io.
- Download chosen files into the repo (with per-file confirmation).
- Install and wire `@esotericsoftware/spine-phaser-v3`, build the loader and
  `SpineGameObject` integration once a rig exists.
- Build all new systems in code: item/pickup spawner, loadout picker, hazards,
  particle VFX, and tests for each — following the existing `engine.ts`/
  `engine.test.ts` pattern.

## Suggested order of work

1. **Spine spike on one player** — rig just the controlled player (idle/run/shoot),
   integrate the runtime, validate the feel before going further.
2. **Roll out to the full roster** — Spine supports skin-swapping on one skeleton,
   so both teams' kits can reuse a single rig.
3. **VFX pass** — particle emitters + Spine-driven auras for existing skills.
4. **New systems** — field items/pickups, pre-match loadout picker, match hazards.
5. **Cosmetics** — jersey/trail/celebration options, freely chosen.

## Frame-based path (recommended, revised after browsing Kenney)

Since Kenney doesn't ship rig-ready parts (see findings above), the simpler
and now-recommended path: skip Spine entirely, use
[Toon Characters](https://kenney.nl/assets/toon-characters)'s pre-posed
sprite frames directly, and animate by **swapping the sprite per game state**
(idle/run/kick/tackle/celebrate) instead of bone-driven animation. No rigging
session, no Spine purchase, no bone/pivot work.

**1. Get:**
- Download [Toon Characters](https://kenney.nl/assets/toon-characters) (free,
  CC0) and [Sports Pack](https://kenney.nl/assets/sports-pack) (free, CC0, for
  pitch/ball/environment art).
- Pick one character from the pack to use as the base (recolored per team via
  code, the same way team colors are already handled).

**2. Hand back for integration:**
- The downloaded pack folder(s), or just the specific character's pose frames
  if trimming before handoff.
- Which pose(s) map to which game state — e.g. which frame(s) read as
  "running," which as "kicking" — so they can be wired to the right
  animation triggers in code.

Suggested drop location: `soccer/src/assets/player/` — flag if a different
path is preferred before the loader code is wired up.

## Spine asset handoff checklist (alternative — Tier 0/Tier 2 only)

Kept for reference if real bone-driven animation is wanted later (via a
pre-rigged Tier 0 purchase from itch.io, or a Tier 2 commission) rather than
the frame-based path above, which is now the primary recommendation.

**1. Get (Tier 0: an already-rigged `.spine` project, e.g. from
[itch.io's spine tag](https://itch.io/game-assets/tag-spine); or Tier 2:
commissioned rig-ready parts):**
- A low-poly/flat character with **separated body-part layers** — head,
  torso, upper arm × 2, lower arm/hand × 2, upper leg × 2, lower leg/foot × 2 —
  not one flattened sprite, if rigging it yourself (Tier 2 source art). If
  buying an already-rigged Tier 0 project, this step is done for you.
- Keep the pack's/commission's license terms.

**2. Do in the Spine Editor (only needed if rigging from Tier 2 source art —
skip entirely for a Tier 0 pre-rigged purchase):**
1. Import each body-part PNG as an image attachment.
2. Build the bone hierarchy: root → hip → torso → head; hip → upper leg →
   lower leg → foot (×2 for left/right); torso → upper arm → lower arm/hand
   (×2).
3. Attach each image to its bone with the pivot point at the actual joint
   (e.g. the shoulder, not the image's center), so rotation looks natural.
4. If doing team-color kit variants, set these up as **Spine skins** on the
   one skeleton rather than building separate rigs per team.
5. Author animations matching the game's existing player states so they map
   1:1 in code: `idle`, `run`, `sprint`, `shoot-windup`, `shoot-release`,
   `tackle`, `stagger`, `celebrate`.
6. Export via *Export Data* → choose JSON or binary skeleton format, and
   *Pack* to generate the texture atlas.

**3. Hand back for integration:**
- The exported skeleton file (`.json` or `.skel`).
- The exported atlas file (`.atlas`) and its packed PNG sheet(s).
- The exact list of animation names used, so they map cleanly to game states.
- The skin names, if team-color variants were built as skins.
- The pack's license file, for the repo's own license bookkeeping.

Suggested drop location: `soccer/src/assets/player/` — flag if a different
path is preferred before the loader code is wired up.

## Open decisions

- ~~2D Spine upgrade vs. full 3D migration~~ — **decided: 2D.** 3D is too
  ambitious for a first pass at this; the 3D section above stays as reference
  for a possible later revisit, not an active plan.
- **Tier 1 vs Tier 0** (2D path only) — Tier 1 was chosen, but it commits to a
  real rigging session in the Spine Editor. Worth reconfirming before buying/
  downloading anything, since Tier 0 removes that step entirely at the cost of
  a more generic character.
- **Single-file vs. asset-folder distribution** — adding real art assets (2D
  or 3D) ends the "everything in one `soccer.bundle.js`" property. Still fully
  offline, but worth deciding deliberately rather than by accident.
