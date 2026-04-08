---
name: arch-audit
description: Audit the architecture and code quality of the current vanilla JS browser app. Triggers on requests like "audit my code", "review the architecture", "what should I refactor", "how's the structure of this project", "code quality review", or "analyze my codebase".
user_invocable: true
slash_command: arch-audit
---

Perform a structured architecture and code quality audit of the current project. The project is a vanilla JS browser app — no framework assumptions. Handle ES modules, classic scripts, and mixed setups.

## Instructions

Read code directly. Do not guess or summarize from filenames alone. Sample broadly, but read entry points and high-fan-in modules in full.

**Step 1 — Parallel exploration.** Launch 3 Explore agents in parallel to cover the codebase efficiently:

- **Agent A — Entry points & module inventory:** Find all HTML files and their script tags. Identify every JS module, how it's loaded (ESM import, script tag, dynamic import), and the module system in use. Read `index.html` and the main JS entry point in full.

- **Agent B — Dependency graph & coupling:** Trace the import graph. Identify high-fan-in modules (imported by many), high-fan-out modules (import many), any circular dependencies, orphaned modules, and places where unrelated concerns are mixed (e.g., rendering logic in pure data modules, DOM access in business logic).

- **Agent C — Extensibility, patterns & maintainability:** Look for hardcoded switches/conditionals that gate on type or kind (where polymorphism or a registry would help). Identify patterns in use (observer, factory, strategy, registry, etc.). Flag long functions, deeply nested code, duplicated logic, unclear naming, and dead code.

**Step 2 — Read critical files.** Before writing the report, read any file flagged by more than one agent or identified as a central coordination point.

**Step 3 — Produce the report.** Output a single markdown report with exactly these sections:

---

## Summary
3–5 sentences on overall health: what's working, what isn't, and the single highest-leverage improvement.

## Strengths
Bullet list. Cite files. Only list genuine strengths — don't manufacture them.

## Findings

Group findings under the phase headings below. Label each finding with a severity tag: **[critical]**, **[important]**, **[minor]**, or **[nit]**. Cite specific files and line ranges for each finding. If a phase has no findings, write "Nothing significant found."

### Phase 1 — Inventory
Module system consistency, entry point clarity, loading strategy.

### Phase 2 — Dependency & Coupling
Import graph issues, circular deps, god modules, tight cross-layer coupling.

### Phase 3 — Modularity & Boundaries
Responsibility separation, leaked business logic, global mutation, unrelated concerns in one module.

### Phase 4 — Extensibility
Shotgun-edit surfaces, hardcoded type switches, conditionals that should be registries or strategies.

### Phase 5 — Patterns & Idioms
Patterns in use, places where a pattern would meaningfully reduce complexity (only when it removes real pain).

### Phase 6 — Maintainability
Long functions, nesting, naming, duplication, dead code, inconsistent error handling.

### Phase 7 — Browser-Specific Concerns
Event listener lifecycle and cleanup, DOM reference leaks, main-thread blocking, imperative mutation mixed with state, modern platform feature opportunities.

## Top 5 Recommended Changes
Ordered by leverage — biggest improvement for least effort first. Each recommendation must be:
- Concrete and actionable (not "consider refactoring X" — say exactly what to do)
- Tied to specific files or functions
- Achievable without introducing a framework, build system change, or TypeScript migration (unless the user has explicitly asked for those)

---

## Behavior rules

- **Evidence over opinion.** If you flag something, point at the code.
- **No framework suggestions** unless the user explicitly asks.
- **No test suggestions** — that's a separate concern.
- **No TypeScript migration suggestions** unless explicitly asked.
- **Honest assessment.** If the codebase is in good shape, say so. Don't manufacture findings.
- **Vanilla JS on its own terms.** Don't grade against what a React or TypeScript app would look like.
