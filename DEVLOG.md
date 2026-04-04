# DEVLOG.md — Vesper Development Log

Format: `YYYY-MMM-DD: Feature — one line description`

---

2026-Apr-04: Project pivot — scrapped JRPG concept, restructured for procedural world generator; scaffold, Camera (zoom/drag), Input (mouse), Game loop, all src/ stubs, docs rewritten
2026-Apr-04: Phase 2 complete — island mask (radial falloff + coast noise + fragmentation), per-material noise composition fields, weirdness field, all normalized; console verification logging
2026-Apr-04: Phase 3 complete — elevation emerges from hardness/density composition + fbm noise shaped by island mask; hydraulic particle erosion carves soft materials; sea level threshold floods low-lying land; weirdness blended with composition-derived weirdnessAffinity
2026-Apr-04: Phase 4 complete — terrain renders via ImageData (1px/cell, drawImage scaled); weighted material color blend; depth-shaded water; elevation brightness modulation; elevation/weirdness heatmap color modes
