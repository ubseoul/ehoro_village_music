# ehorovillage.com redesign (October 2026): not live yet

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
