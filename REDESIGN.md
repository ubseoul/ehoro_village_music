# ehorovillage.com redesign (October 2026): not live yet

**v3 (Oct 5, latest):** monochrome, Notion-inspired. White paper and black ink with a full dark mode toggle, a live "/" slash-command demo in the hero, a cursor spotlight on a dotted grid, scroll reveals, count-up proof numbers, a tool marquee and Notion-style toggles. The front page now covers everything: the work (for recruiters), three services (AI workflow automation from $100, dashboards and data cleanup from $50, custom AI assistants from $150), resources launching this fall (AI literacy lessons, spreadsheet templates), the product lab, and Ade. Files: `site.css`, `site.js` (new), all pages regenerated. Motion respects reduced-motion settings; content stays visible without JavaScript.


Branch `redesign-2026-10`, local only. Nothing has been pushed. The live site is unchanged until Ube says go.

## What changed
- New `index.html`, `work.html`, `services.html` (new), `about.html`, `site.css` (new), `llms.txt`, `sitemap.xml`.
- Untouched: `village.html` (Lo-Fi Spirits app), `members.html`, `sprites/`, `styles.css`, `ehoro-font.ttf`, `index.backup.html`, `CNAME`.

## Why
- **Truth.** The old pages described Ehoro Village as a company founded in 2019 with about 80–100 people, 10,000+ learners and a Head of Product. A recruiter or background check that looks at the site and doesn't find that company can end an offer at the last step, which is where offers have been slipping. The new site says what's true: an AI programs and learning practice in the New York metro area, led by Ade since 2024, with real, documented work.
- **Recruiters:** name, title, proof numbers, case studies with problem / what was done / result, credentials, LinkedIn, all in the first two scrolls.
- **Buyers:** the services page is the storefront for the money kitchen (AI in an Afternoon workshops, AI Visibility checks), with email buttons that prefill what we need.
- **AI search:** schema.org data and an honest `llms.txt`, so ChatGPT and others describe Ehoro Village correctly. That's the AI Visibility service, practiced at home.

## Before going live, Ube checks
1. `hello@ehorovillage.com` really reaches you (every button uses it).
2. Every sentence on Work and About is something you'd say out loud in an interview.

## Go live (one minute)
```bash
git checkout main && git merge redesign-2026-10 && git push origin main
```
Or tell Claude "deploy the site". To undo: `git revert` the merge commit and push.
