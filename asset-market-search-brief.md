# Soccer Character Asset — Market Search Brief

Self-contained instructions for finding purchasable character asset candidates
for the Soccer tab's player art. Written to be handed to another agent/session
with no other context.

## Goal

Find **5-8 real, purchasable candidate character asset packs** matching the
game's current flat/vector "low-poly" 2D visual style. Do not narrow to one
pick — return a shortlist for a human to choose from. Do not purchase or
download anything.

## Context (so judgment calls make sense without asking)

- The game is an offline browser soccer arcade game (Phaser 3 + TypeScript),
  currently rendered with flat-colored procedural polygon shapes — no sprites
  or rigged characters exist yet.
- Target style: **flat/vector, simple shapes, bright flat colors** — similar
  register to Kenney.nl's "Toon Characters" pack. Explicitly **not** pixel
  art, and **not** painterly/high-detail fantasy illustration, even if a
  result is labeled "low-poly" (that term on some marketplaces, e.g. itch.io,
  means 3D low-polygon-count models — irrelevant here, this project is 2D).
- Preference order for what counts as a good candidate:
  1. **Tier 0 — pre-rigged Spine character.** Needs a runtime-exportable
     skeleton (JSON or binary `.skel`) plus an atlas, compatible with the
     official `@esotericsoftware/spine-phaser-v3` runtime. A pack that only
     ships a `.spine` editor project file (not yet exported) still counts —
     note this distinction when found, since it changes what's usable
     immediately vs. after opening it in the Spine Editor.
  2. **Frame-based sprite pack** with a full pose/animation set (idle, run,
     kick, etc.) as a fallback if no good rigged option exists.
  3. **Raw vector source art**, not rigged at all — lowest priority, only
     useful later if commissioning custom rigging.
- **Commercial use is required.** This may eventually be a published game, so
  explicitly check and record whether each candidate's license permits
  commercial use and redistribution as part of a compiled/shipped game.
- Paid content is fine, no price ceiling — just record the price of each
  candidate found.
- Literal "soccer"/"football" search terms were already tried directly and
  came up nearly empty on both itch.io and CraftPix.net — don't rely on them
  alone; the working strategy is generic "sports/athlete" character packs
  that can be reskinned (jersey recolor + a ball prop) rather than an
  exact soccer-themed pack.

## Where to search

1. **itch.io** — use the tag-filtered browse URL, not free-text search:
   `https://itch.io/game-assets/tag-spine` (then adjust/add tags, or sort by
   price). Free-text search on itch.io mostly surfaces finished games, not
   asset packs — avoid it as a primary method.
2. **CraftPix.net** — dedicated 2D game-asset marketplace, use its on-site
   search.
3. **GameDevMarket.net** — similar niche 2D/3D asset marketplace.
4. **Unity Asset Store** (assetstore.unity.com) — has 2D/cartoon character
   packs. Note that Unity-format assets can sometimes be extracted and reused
   outside Unity, but license terms vary — flag this explicitly per candidate
   rather than assume it's fine.
5. **Envato Elements / GraphicRiver** — for vector *source* art (not rigged).
   Only relevant for the "raw vector source art" fallback category above —
   mark these clearly as "not pre-rigged" when found.

## Search terms to try

- `sports character pack`
- `athlete character sprite`
- `runner character` / `runner sprite pack`
- `spine sports character` / `spine athlete rig` (use as itch.io tag
  combinations where possible, not free text)
- `cartoon character animation pack`
- `flat vector athlete illustration` (Envato/Freepik/Vecteezy — source art
  only, not rigged)
- Also try `soccer player sprite` and `football player character` once per
  marketplace — cheap to check even though expected to underperform.

## For each candidate found, record

- Name and **direct URL**
- Marketplace
- Price
- Art style confirmation — describe the thumbnail/preview enough that style
  can be judged without re-opening the link (flat/vector/simple-shape vs.
  anything else)
- Rig format: pre-rigged Spine (exported skeleton+atlas, or `.spine` project
  only) vs. frame-based sprite sheet vs. non-rigged vector source
- Included animation/pose set (idle/run/kick/tackle/celebrate — note whatever
  subset actually exists)
- License terms: commercial use allowed? redistribution allowed as part of a
  shipped game? attribution required?
- One-line note on how well it'd adapt to a soccer player (e.g. does it wear
  simple clothing that recolors easily as a jersey?)

## Output format

A markdown table or list with the fields above, for 5-8 shortlisted
candidates, ranked roughly by fit (style match + rig format + license
clarity), not just by price.

## Explicitly out of scope

- Do not purchase or download anything.
- Do not evaluate 3D/low-poly-3D-model assets — this project is staying 2D.
- Do not include pixel art results, even if labeled "retro" or "8-bit."
