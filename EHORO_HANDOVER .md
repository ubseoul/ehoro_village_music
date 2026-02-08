# EHORO VILLAGE — Technical Handover Manifesto

**Date:** February 8, 2026
**Author:** Claude (Anthropic) — Lead Architect, Sprints 1–3.5
**Recipient:** Next AI assistant continuing development
**Owner:** Super Ube LLC (ubseoul)

---

## 1. PRODUCT OVERVIEW

Ehoro Village is a lo-fi music streaming web app with a spirit collection game layer. Users listen to lo-fi streams, passively earn eggs and ingredients, hatch spirits, evolve them through a cultivation system, and grow their village rank. It is designed as a **companion app**, not a game demanding attention — it rewards presence, not attention. The 40 minutes of "nothing to do" while streaming is intentional; the user is studying or working, and the village grows quietly beside them.

**Stack:** Single HTML file (~68KB) + 10 PNG sprite files + Supabase backend (PostgreSQL + Auth + RPC)
**Hosting:** GitHub Pages at `ubseoul.github.io/ehoro_village_music/`
**Auth:** Supabase email/password + guest mode
**Target:** 17–20 year old college students, first 100 users

---

## 2. THE `S` OBJECT — SINGLE SOURCE OF TRUTH

All client-side state lives in a single global object `S`. Every render function reads from `S`. Every RPC callback writes to `S` then calls `updateAllUI()`.

```javascript
let S = {
  // Auth
  user: null,              // Supabase auth user object (or null)
  isGuest: true,           // true if not authenticated
  authMode: 'login',       // 'login' or 'signup' (toggle on auth screen)

  // Profile (from profiles table)
  profile: null,           // { id, username, total_eggs, total_listen_seconds, 
                           //   onboarding_done, newbie_gift_claimed, starter_claimed,
                           //   first_egg_claimed, last_seen, ... }

  // Game data (from respective tables)
  spirits: [],             // Array of { id, user_id, spirit_type, name, evo_stage, xp }
  traits: {},              // Map: spirit_id -> [{ trait_name, trait_type }]
  emblems: {               // Ingredient counts (from emblems table)
    cafe_bean: 0,
    wild_essence: 0,
    focus_shard: 0
  },
  hatchery: [],            // Array of { id, user_id, slot_number, unlocked, egg_id, 
                           //   started_at, hatch_duration_minutes }
  pendingEggs: [],         // Eggs with status='pending' (not yet placed in hatchery)
  pillRecipes: [],         // From pill_recipes table

  // Streaming state
  playing: false,          // Is the lo-fi stream active?
  sessionId: null,         // UUID of current listen session
  eggT: 0,                // Seconds elapsed toward next egg drop

  // Timers (in seconds)
  EGG_SEC: 3600,           // Normal egg drop interval (60 min)
  FIRST_EGG_SEC: 900,      // First egg for new accounts (15 min)
  GUEST_EGG_SEC: 30,       // Guest demo egg (30 sec)

  // Interval handles
  ticker: null,            // Main game tick (500ms) — egg progress, ingredient drops
  hatchTicker: null,       // Hatchery refresh (5000ms)
  cultTicker: null,        // Active cultivation tick (1200000ms = 20 min)

  // UI state
  theme: 'dark',           // 'dark' or 'light'
  obStep: 0,               // Onboarding step (0-2)
  settingsOpen: false,
  selectedSpirit: null,    // Currently expanded spirit detail
  guestEggGiven: false     // Has guest received their demo egg?
};
```

### Data flow pattern
1. User action → call Supabase RPC
2. RPC returns → `await loadUserData()` (re-fetches ALL tables)
3. `updateAllUI()` re-renders spirits, items, village tabs
4. Exception: `doConvert` optimistically updates `S.emblems` locally for instant UI feedback

### Why `loadUserData` re-fetches everything
Because RPCs use `SECURITY DEFINER` and modify multiple tables atomically. Rather than track which local fields changed, we pull fresh state. This is fine at our scale (<100 users, ~10-15 calls/hour per user).

---

## 3. DATABASE SCHEMA (Actual, as deployed)

**CRITICAL:** The schema has mixed provenance — Sprint 1 created tables with different column names/constraints than later sprints expected. Several `ALTER TABLE` and `DROP CONSTRAINT` patches were applied. Always verify against the live DB before assuming column names.

### profiles
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | References auth.users(id) |
| username | TEXT | Was UNIQUE with format check, constraints now dropped |
| created_at | TIMESTAMPTZ | |
| total_eggs | INT | Lifetime egg count |
| total_listen_seconds | INT | Lifetime listen time |
| last_egg_drop_at | TIMESTAMPTZ | Sprint 1 rate limiting (may be unused now) |
| newbie_gift_claimed | BOOLEAN | Welcome gift (15 each ingredient) |
| onboarding_done | BOOLEAN | Has seen onboarding slides |
| last_seen | TIMESTAMPTZ | For passive cultivation calc |
| first_egg_claimed | BOOLEAN | Tracks if first egg timer (15 min) has been used |
| starter_claimed | BOOLEAN | Has claimed starter spirit |

### spirits
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | References auth.users(id) — was profiles(id), changed |
| spirit_type | TEXT | 'timi', 'bayo', 'mowang' — old check constraint dropped |
| name | TEXT | Display name |
| evo_stage | INT | 0=Seedling, 1=Awakened, 2=Ascended |
| xp | INT | 100 XP per level. Level = floor(xp/100)+1 |
| created_at | TIMESTAMPTZ | |

**Note:** Sprint 1 had `unique(user_id, spirit_type)` — this was dropped to allow duplicate spirit types.

### spirit_traits
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| spirit_id | UUID FK | References spirits(id) |
| trait_name | TEXT | e.g. 'Curious', 'Focused', 'Swift' |
| trait_type | TEXT | 'neutral' or 'positive' |
| created_at | TIMESTAMPTZ | |

### eggs
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | References auth.users(id) |
| rarity | TEXT | 'mundane','adept','refined','illustrious','sovereign','celestial','transcendent' — old check dropped |
| playlist | TEXT | 'cafe' (always, since single stream) — old check dropped |
| hatched_at | TIMESTAMPTZ | Set when hatched |
| status | TEXT | 'pending', 'incubating', 'hatched' |
| incubation_minutes | INT | Sprint 1 column, may not be actively used |

**CRITICAL:** This table does NOT have a `created_at` column. Any query ordering by created_at will return 400.

### hatchery
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| egg_id | UUID FK nullable | References eggs(id) |
| slot_number | INT | 1-5 |
| unlocked | BOOLEAN | Slots 1-2 start unlocked |
| started_at | TIMESTAMPTZ | When egg was placed |
| hatch_duration_minutes | INT | Minutes until hatchable |

### emblems
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| emblem_type | TEXT | 'cafe_bean', 'wild_essence', 'focus_shard' |
| quantity | INT | Current count |
| | | UNIQUE(user_id, emblem_type) |

### sessions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| playlist | TEXT | |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | |
| duration_seconds | INT | |

### pill_recipes (seed data, read-only)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| pill_name | TEXT | 'Cultivation Pill', 'Greater Cultivation Pill', 'Village Cultivation Pill' |
| pill_type | TEXT | 'growth', 'clarity', 'harmony' |
| description | TEXT | |
| effect_type | TEXT | 'xp_flat' or 'xp_all' |
| effect_value | INT | 50, 100, or 25 |
| cost_cafe_bean | INT | |
| cost_wild_essence | INT | |
| cost_focus_shard | INT | |

### analytics_events
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| event_type | TEXT | 'signup', 'hatch', 'evolution', 'craft_pill', 'stream_start', etc. |
| event_data | JSONB | |
| created_at | TIMESTAMPTZ | |

### trait_effects (seed data, not actively queried by frontend yet)
Stores effect definitions for traits. Future use for trait-based bonuses.

---

## 4. RPC DOCUMENTATION

All RPCs use `SECURITY DEFINER` and call `auth.uid()` internally. Frontend calls them via `sb.rpc('function_name', { params })`.

| RPC | Params | Returns | Notes |
|-----|--------|---------|-------|
| `claim_starter_spirit` | none | `{success, spirit_type, spirit_name, trait, spirit_id}` | Creates random spirit + neutral trait. Sets `starter_claimed=true`. Idempotent. |
| `claim_newbie_gift` | none | `{success, cafe_bean:15, wild_essence:15, focus_shard:15}` | Grants 15 of each ingredient. Sets `newbie_gift_claimed=true`. Idempotent. |
| `claim_egg_drop` | `p_playlist: TEXT` | `{rarity, egg_id, total_eggs, emblem_granted, auto_placed}` | Creates egg, grants 1 random ingredient, auto-places in empty hatchery slot if available. |
| `place_egg_in_slot` | `p_egg_id: UUID, p_slot_id: UUID` | `{success}` | Moves pending egg into hatchery slot, sets status to incubating. |
| `hatch_egg` | `p_slot_id: UUID` | `{success, rarity, spirit_type, spirit_name, evo_stage, trait}` | Creates spirit from egg, clears slot. Checks hatch time elapsed. |
| `evolve_spirit` | `p_spirit_id: UUID` | `{success, new_stage, trait_gained}` | **Level gate:** Requires 200 XP for stage 0→1, 400 XP for stage 1→2. Costs 5 (stage 0) or 12 (stage 1) of each ingredient. Grants positive trait. |
| `craft_pill` | `p_recipe_id: UUID, p_spirit_id: UUID (nullable)` | `{success, pill_name, xp_gained, new_xp, leveled_up, new_level}` | Deducts ingredient costs, applies XP. If `xp_all`, applies to all spirits (p_spirit_id can be null). |
| `convert_ingredient` | `p_from: TEXT, p_to: TEXT, p_amount: INT` | `{success}` | 3:1 conversion ratio. |
| `start_session` | `p_playlist: TEXT` | UUID (session ID) | Creates listen session row. |
| `end_session` | `p_session_id: UUID` | VOID | Calculates duration, updates profile total_listen_seconds. |
| `claim_passive_cultivation` | none | `{xp_granted, hours_away}` | Grants 1 XP per hour away (max 24). Updates last_seen. Used for welcome-back screen. |
| `tick_active_cultivation` | none | `{success, xp_granted:1, spirits: count}` | Grants 1 XP to all spirits. Called every 20 min while streaming. |
| `unlock_hatchery_slot` | `p_slot_number: INT` | `{success, slot}` | Requires prestige threshold: slot 3=50, slot 4=150, slot 5=400. |
| `log_event` | `p_event: TEXT, p_data: JSONB` | VOID | Analytics insert. |

---

## 5. KEY CONSTANTS & GAME BALANCE

```
Spirit types:       timi, bayo, mowang (3 types, 3 stages each = 9 sprites)
Evolution stages:   Seedling (0) → Awakened (1) → Ascended (2)
Evolution costs:    Stage 0→1: 5 each ingredient + Lv.3 (200 XP)
                    Stage 1→2: 12 each ingredient + Lv.5 (400 XP)
XP per level:       100 XP (Level = floor(xp/100) + 1)

Egg drop timing:    First egg: 15 min, subsequent: 60 min
Ingredient drops:   ~1 per 5.5 min while streaming (random type)
Passive XP:         1 per hour away (max 24 XP/day)
Active XP:          1 per 20 min while streaming

Pill costs/effects:
  Cultivation Pill:         4☕ 2🌿 2⚡ → 50 XP to one spirit
  Greater Cultivation Pill: 6☕ 6🌿 6⚡ → 100 XP to one spirit
  Village Cultivation Pill: 3☕ 3🌿 8⚡ → 25 XP to ALL spirits

Hatch times by rarity:
  mundane:5m, adept:10m, refined:20m, illustrious:30m, 
  sovereign:45m, celestial:60m, transcendent:90m

Ingredient conversion: 3:1 (any type to any other)

Welcome gift: 15 of each ingredient (enough for 1 evolution + 2 pills)
Starter spirit: 1 random spirit with random neutral trait

Hatchery slots: 5 total, 2 unlocked at start
  Slot 3: 50 prestige, Slot 4: 150, Slot 5: 400

Prestige formula:
  +10 per spirit × (evo_stage + 1)
  +5 per spirit level
  +2 per lifetime egg
  +3 per hour listened

Village ranks: Ember(0), Stone(50), Bronze(150), Silver(400), 
              Gold(800), Emerald(1500), Celestial(3000)
```

---

## 6. SPRITE FILES

All in `/sprites/` relative to index.html:

| File | Content |
|------|---------|
| timi_1.png | Fox spirit, Seedling stage (orange, small) |
| timi_2.png | Fox spirit, Awakened (ice blue) |
| timi_3.png | Fox spirit, Ascended (nine-tail ice) |
| bayo_1.png | Panda spirit, Seedling |
| bayo_2.png | Panda spirit, Awakened (bubbles) |
| bayo_3.png | Panda spirit, Ascended (butterfly wings) |
| mowang_1.png | Slime spirit, Seedling (blob) |
| mowang_2.png | Slime spirit, Awakened (mech legs) |
| mowang_3.png | Slime spirit, Ascended (full mech, sunglasses) |
| favicon.png | Stylized 'E' logo |

All PNGs are 1024×1024 (except favicon at 1080×1080). Total: ~209KB.

The `SPIRIT_DATA` constant maps type keys to `{name, bio, img[3]}`. The `TYPE_MAP` handles legacy type names (`fox_lavender→timi`, `panda→bayo`, `fox_fire→timi`).

---

## 7. CURRENT BUGS & CRITICAL DEBT

### 7a. Starter Flow Bug — RESOLVED
The 3-screen "Summoning..." flow was removed entirely. Spirit + gift are now
created in the signup trigger. The `claim_starter_spirit` and `claim_newbie_gift`
RPCs still exist in the database but are no longer called by the frontend.

### 7b. Background Tab Throttling
When the browser tab is backgrounded, `setInterval` is throttled to 1000ms minimum (some browsers throttle to 60s). This means:
- The egg timer (`S.eggT`) counts slower than real time when backgrounded
- Ingredient drops happen less frequently
- This is mostly acceptable for a passive companion app but can cause the egg timer to show inaccurate remaining time

**Fix approach:** On tab re-focus (`visibilitychange` event), recalculate elapsed time from a stored `Date.now()` reference rather than relying on interval count.

### 7c. `sendBeacon` on Page Close
The `beforeunload` handler uses `navigator.sendBeacon` to call `end_session`, but it sends the request without the Supabase auth header (Bearer token). This means:
- The `auth.uid()` call inside `end_session` returns NULL
- The session never gets its `ended_at` set
- `total_listen_seconds` doesn't update on page close

**Fix approach:** Either include the auth token in the Beacon headers (possible but tricky), or accept approximate listen time tracking and reconcile on next login using `last_seen` timestamps.

### 7d. Eggs Table Schema Mismatch
The eggs table was created in Sprint 1 with columns (`playlist`, `hatched_at`, `incubation_minutes`) that don't match what later code expected (`created_at`, `status`). The `status` column was added via ALTER. The `created_at` column was NEVER added. Any query that orders by `created_at` on the eggs table will return a 400 error. This was fixed in the frontend but could bite again if someone re-adds it.

### 7e. Materials Not Deducting After Craft/Evolve
This was caused by the eggs `created_at` bug — the 400 error in `loadUserData` caused the parallel Promise.all to partially fail, meaning emblems sometimes didn't refresh. With the `created_at` reference removed, `loadUserData` should now complete. Verify after deploying the latest index.html.

### 7f. Existing User Data
There are likely orphaned rows in the database from Sprint 1 (old spirit types like 'fox_lavender', 'panda', 'fox_fire' that the frontend maps via `TYPE_MAP`). The `bossman` account and any other early test accounts may have inconsistent data. Consider a data cleanup pass or just delete test accounts.

---

## 8. FEATURE AUDIT — What's Real vs Placeholder

### FULLY FUNCTIONAL ✅
- Email/password auth (signup, login, logout)
- Guest mode with demo egg
- Lo-fi stream (YouTube embed, Lofi Girl)
- Egg drops on timer (15 min first, 60 min subsequent)
- Egg placement in hatchery slots
- Egg hatching with animation (shake → crack → particles → reveal)
- Spirit collection with real artwork (3 types × 3 stages)
- Spirit detail view with XP bar, traits, bio
- Evolution with level gate (Lv.3, Lv.5) + ingredient cost + particle animation
- Trait system (neutral on hatch, positive on evolve)
- Pill crafting (3 recipes with ingredient costs)
- Ingredient conversion (3:1 ratio)
- Passive cultivation (XP while away, max 24h)
- Active cultivation (1 XP per 20 min while streaming)
- Hatchery slot unlocking (prestige-gated)
- Village rank system with prestige calculation
- Welcome-back screen with offline XP summary
- Starter spirit claim flow (3-screen sequence)
- Welcome gift (15 of each ingredient)
- Onboarding slides (3 steps)
- Dark/light theme toggle
- Privacy policy (Super Ube LLC)
- Analytics event logging
- Rank colors (Ember through Celestial)

### PLACEHOLDER / NEEDS WORK ⚠️
- **Trait effects:** Traits display on spirit cards but their effects (XP boost, hatch speed, etc.) are NOT calculated anywhere. The `trait_effects` table exists with values but no game logic reads from it.
- **Rarity system beyond egg color:** Egg rarity determines hatch time but does NOT affect which spirit you get or spirit quality. All hatches give random timi/bayo/mowang regardless of egg rarity.
- **Egg rarity display in hatchery:** Shows rarity color but the pending egg data is often empty because the auto-place system moves eggs to 'incubating' immediately.
- **`autoPlaceEggs` function:** Defined but never called. Was intended as a safety net to auto-place pending eggs into empty slots on login.
- **Toast message for gift** still says "+6 of each ingredient" (should be +15).
- **Guest banner:** Shows when guest gets demo egg but `enterGuest()` doesn't properly hide it on initial load in all cases.
- **Evolution level requirement display:** The evolve button shows "Requires Lv.3" when underleveled, but the evolve cost text could be clearer.

### NOT YET BUILT 🔲
- **3 additional spirit types** (owner wants 6 total for launch)
- **Custom lo-fi stream** (currently using Lofi Girl's YouTube stream)
- **Background audio** when phone screen is locked (not possible with YouTube embed)
- **Social features** (none planned for MVP)
- **Monetization** (cosmetics-only model decided, not implemented)
- **Spirit sacrifice / cultivation pot** (discussed, deprioritized — companion not game)
- **Foraging / meditation idle mechanics** (rejected — works against companion soul)

---

## 9. NEW USER FLOW (Current Implementation)

```
1. User signs up → handle_new_user trigger fires
   → Creates: profile (starter_claimed=true, newbie_gift_claimed=true)
   → Creates: 3 emblem rows with 15 each (gift baked in)
   → Creates: 5 hatchery slots (2 unlocked)
   → Creates: 1 random spirit (timi/bayo/mowang) with random neutral trait
   → Everything happens atomically in the trigger. No frontend RPCs needed.

2. User logs in for first time → enterApp() runs
   → Detects onboarding_done === false
   → Shows onboarding slides (3 screens: Listen, Collect, Grow)
   → On finish: sets onboarding_done = true, shows welcome toast

3. User is in app with: 1 spirit, 15 each ingredient, empty hatchery
   → Can immediately craft pills to level up
   → Evolution requires Lv.3 (200 XP) — gives them a goal
   → First egg drops at 15 minutes

NOTE: The previous version had a 3-screen "Summoning..." flow using 
claim_starter_spirit and claim_newbie_gift RPCs. This was removed because
loadUserData failures caused starter_claimed to read as false, showing the
summoning screen to returning users. The trigger approach is bulletproof —
if the trigger fails, signup fails, so data is always consistent.
```

---

## 10. CSS ARCHITECTURE

Single `<style>` block, ~26KB. Uses CSS custom properties for theming:

```css
[data-theme="dark"]  { --bg:#050505; --t1:#f5f5f5; ... }
[data-theme="light"] { --bg:#f0ede8; --t1:#1a1816; ... }
```

Key design system tokens:
- `--glass`: Glassmorphic panel background (rgba with opacity)
- `--glass-border`: Subtle white/black border
- `--blur`: `blur(20px)` for backdrop-filter
- `--radius`: 14px (cards), `--radius-sm`: 10px (smaller elements)
- `--positive`: Green for growth/success
- `--negative`: Red for errors
- `--special`: Purple for special items

**Fonts:** Outfit (body), Fraunces (headings, italic serif), JetBrains Mono (numbers)

**Mobile breakpoint:** 768px switches to stacked layout (video on top, sidebar below). 420px further reduces video height.

### ⚠️ CONSTRAINT: Do NOT refactor the CSS structure. The glassmorphic design with layered transparency is carefully tuned. Changing opacity values, backdrop-filter usage, or z-index stacking will break the visual feel. Add new styles at the end.

---

## 11. CONSTRAINTS FOR CONTINUATION

1. **Vanilla JS only.** No frameworks, no build tools, no npm. The entire app is one HTML file. Keep it that way.
2. **Do not refactor CSS.** Add new styles, don't reorganize existing ones. The glassmorphic layering is fragile.
3. **Ehoro visual consistency.** Dark theme is primary. Light theme is warm parchment. Avoid saturated colors. Everything should feel like a cozy study room at night.
4. **Companion, not game.** Do not add mechanics that demand active attention (tapping, clicking games, timers that punish). The product rewards passive presence.
5. **Single file deployment.** index.html + sprites folder + Supabase. No server, no build step, no CDN beyond Google Fonts and Supabase JS.
6. **Test against actual DB schema.** ALWAYS check column names before writing SQL. The schema has been patched multiple times and column names may not match what you expect.
7. **RPC over direct mutations.** All game state changes go through SECURITY DEFINER RPCs. The frontend never INSERTs or UPDATEs tables directly (except profiles.onboarding_done which could be moved to an RPC).

---

## 12. DEPLOYMENT CHECKLIST

1. Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` on lines 1-2 of the `<script>` block
2. Run any new SQL migrations in Supabase SQL Editor (new tab, clean paste)
3. Commit index.html to the `ehoro_village_music` GitHub repo
4. GitHub Pages auto-deploys (usually 1-2 minutes)
5. Hard refresh or incognito to test (browser caches aggressively)
6. Delete test accounts from Supabase Auth dashboard between schema changes
7. Sprites folder rarely changes — only re-upload when adding new spirit art

---

## 13. WHAT THE OWNER WANTS NEXT

In priority order based on our last conversation:

1. **Fix the 406 starter flow bug** — New signups get stuck on "Summoning..." 
2. **Verify materials deduct properly** after craft/evolve (may be fixed with created_at removal)
3. **Add 3 more spirit types** for launch (6 total, owner will provide art)
4. **Custom lo-fi stream** to replace Lofi Girl (eliminates ads, gives brand control)
5. **Social media presence** — TikTok + Twitter/X for building in public
6. **User testing** with 3-5 people, zero explanation, watch behavior
7. **Trait effects implementation** — make traits actually affect gameplay

---

## 14. PERSONAL NOTES TO THE OWNER

You built something with real soul in 24 hours. The glassmorphic design, the spirit art, the cultivation metaphor — it all works together. Here's what I'd want you to remember:

**Ship before you're ready.** The product is 80% there. The remaining 20% is polish that real users will tell you about better than any AI can guess.

**The first 5 minutes matter most.** We rebuilt the new user flow three times because it kept breaking on schema mismatches. The current version (starter spirit → gift → onboarding) is the right sequence. Make sure it works flawlessly before anything else.

**Don't add systems, add depth.** You have enough mechanics. What you need is more content (spirits), better balance (ingredient economy), and emotional moments (animations, sounds). Resist the urge to build new features before the existing ones feel polished.

**The database schema debt is real.** The Sprint 1 tables with their old constraints caused every single deployment bug we hit. If you ever need to start fresh, the 007_NEW_USER_EXPERIENCE.sql + constraint drops give you a clean foundation. But honestly, for 100 users, what you have works.

**Your instincts are good.** When you said "this is a companion, not a game" — that was the most important design decision we made. Hold onto that.

Good luck with the launch. The spirits are waiting.

— Claude
