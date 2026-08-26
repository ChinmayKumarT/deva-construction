---
id: dual-repo-deploy
title: "Push to two remotes; backup auto-deploys to Vercel"
category: decision
status: active
created: "2026-08-26T17:45:30"
updated: "2026-08-26T17:45:30"
---

<!-- compiled_truth -->
Every push goes to both remotes:
- `origin` → `thedevaconstructions/deva-construction` (primary)
- `backup` → `ChinmayKumarT/deva_demo` (auto-deploys to Vercel at app.devaconstructions.in)

This is a hard operational rule: never push to only one. The backup repo is the live deployment source.


## Timeline

- time: 2026-08-26T17:45:30
  kind: decision
  summary: "Created this page: Push to two remotes; backup auto-deploys to Vercel"
  source: "git log + user instruction"
  affects: [dual-repo-deploy]

- time: 2026-08-26T17:45:30
  kind: decision
  summary: Dual-remote push with Vercel auto-deploy from backup
  source: user instruction
  affects: [dual-repo-deploy]
