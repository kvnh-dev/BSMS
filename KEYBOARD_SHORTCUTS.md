# BSMS Keyboard Shortcuts (Tally-inspired interaction model)

**Implementation status (2026-09-12):** F-key navigation (F4-F8) and the Ctrl+K command palette are implemented — see `apps/web/src/lib/use-global-shortcuts.ts` and `apps/web/src/components/command-palette.tsx`. F-keys navigate to the relevant list page with `?new=1`, which the page reads via `useAutoOpenFromQuery` (`apps/web/src/lib/use-auto-open.ts`) to auto-open its create dialog — a simplified v1 of "jump straight to the action" rather than opening the dialog in-place from any screen. **Not yet built:** Ctrl+A-to-save-any-form (would need a shared form-context to do generically and safely; skipped as higher-risk/lower-value for v1), the fuller command-palette entity search ("jump to any bike/customer/ticket by name"), and the visible key-badge discoverability affordance described below.

**Goal:** staff migrating from Tally should feel at home navigating BSMS almost entirely by keyboard, lowering the learning curve. **This is about interaction patterns, not visual style** — see the note at the bottom reconciling this with the "clean, modern, enterprise-grade" UX direction. Web app only; React Native mobile has no comparable keyboard-driven model (touch-first instead), so none of this applies there.

## Design principles, borrowed from what actually makes Tally fast (not its look)
1. **Every screen is fully operable without a mouse.** Lists navigate with arrow keys, Enter drills into a row, Esc backs out.
2. **A single, consistent "commit" key everywhere.** Tally trains users to hit **Ctrl+A ("Accept")** to save/submit whatever screen they're on — every form, every modal, same key, no exceptions. BSMS adopts this literally, since it's the single most-drilled muscle-memory habit a Tally user has.
3. **Esc always means "back out," consistently.** Closes a modal, cancels a form without saving, or steps up one level of navigation — never a surprise action.
4. **Global function keys jump straight to the highest-frequency actions**, from anywhere in the app, no navigation required first — mirroring how Tally's F4-F10 jump straight to voucher types.
5. **Alt+letter mnemonics for actions available on the current screen** (print, export, delete) — matches Tally's Alt+P/Alt+E pattern closely enough to transfer directly.
6. **Shortcuts are always visible, not memorized from a manual.** Tally's bottom-right button bar constantly shows "F5: Payment F6: Receipt..." — BSMS needs an equivalent persistent, discoverable hint affordance (see Implementation notes) so staff learn keys by osmosis instead of training.

## Global shortcuts (work from anywhere in the app)

| Key | Action |
|---|---|
| `F2` | Jump to global search |
| `F4` | New Service (intake) |
| `F5` | New Invoice |
| `F6` | New Customer / Bike (quick-add) |
| `F7` | New Inventory Item |
| `F8` | Attendance check-in / check-out |
| `F9` | New Estimate |
| `Ctrl+A` | Save / Accept the current form (works on every form/modal, no exceptions) |
| `Esc` | Cancel / back out one level |
| `Ctrl+K` | Command palette (search any bike/customer/ticket/invoice by typing — a modern addition beyond Tally, see below) |

## Contextual shortcuts (current screen only, Alt+letter mnemonics)

| Key | Action | Where |
|---|---|---|
| `Alt+P` | Print / export PDF | Invoice, Estimate detail |
| `Alt+E` | Export (Excel/CSV) | Reports, GST export |
| `Alt+D` | Delete (with confirm) | Any editable list row |
| `Alt+N` | Add new line item | Estimate/Invoice line-item entry |
| `Alt+S` | Search/filter within the current list | Any list page |

## List/table navigation

| Key | Action |
|---|---|
| `↑` / `↓` | Move selection between rows |
| `Enter` | Open the selected row |
| `Esc` | Clear selection / leave the list focus |
| `Tab` / `Shift+Tab` | Move between form fields (standard, not Tally-specific but preserved) |

## A deliberate modern addition: command palette (`Ctrl+K`)
Tally predates this pattern entirely, but it's now a standard "keyboard power user" affordance (Linear, Notion, VS Code, Slack) and fits naturally alongside Tally-style F-keys: type to jump straight to any bike, customer, ticket, or invoice, or to run any of the F-key actions above by name instead of memorizing the key. This gives staff two ways to be fast — memorized keys for daily repetitive actions, fuzzy search for everything else — without contradicting the Tally-familiarity goal.

## Implementation notes
- **Discoverability affordance**: a persistent, unobtrusive shortcut hint bar or an on-hover key-badge next to buttons (e.g. a small "F5" chip on the "New Invoice" button) — the modern equivalent of Tally's always-visible button bar, styled to match the clean/modern visual direction rather than copying Tally's boxy on-screen buttons.
- **Library**: a hotkey library (e.g. `react-hotkeys-hook`) scoped per-route so global keys don't fire while a text input has focus (typing "f" in a search box must not trigger `F`-adjacent shortcuts — standard input-focus guarding).
- **Browser/OS conflicts**: `Ctrl+A` normally means "select all text" in a browser context — since secondary devices may access BSMS over LAN via a plain browser (not just the Electron shell), every global shortcut needs `preventDefault()` scoped carefully (e.g. only override Ctrl+A when focus isn't inside a text-selection-relevant element) so it doesn't break normal text selection unexpectedly.
- **Electron-specific keys**: within the Electron shell specifically, app-level shortcuts (e.g. `Ctrl+K` for the command palette) could additionally be registered via Electron's `globalShortcut` for even-lower latency, though scoping within the renderer is sufficient and simpler — start there.
- **RBAC interacts with shortcuts**: a global key for an action the current persona can't perform (e.g. `F7` New Inventory Item for a Cashier) should either no-op silently or show a brief "not permitted" toast — never navigate to a page that then shows an access-denied wall.

## Reconciling with "clean, modern, enterprise-grade" UX
These are two independent axes and don't conflict: **Tally's interaction model** (function keys, Ctrl+A to accept, full keyboard operability, always-visible key hints) is what gets adopted here for speed and familiarity. **Tally's visual style** (dense DOS-era grids, heavy borders, blue/gray palette) is explicitly *not* being carried over — see `UX_DESIGN_PRINCIPLES.md` for the actual visual direction, which wraps this same keyboard-first interaction model in a modern component system (generous whitespace, clear type hierarchy, subtle elevation/motion) — closer to how Linear or Superhuman pair power-user keyboard speed with a genuinely modern look, rather than how Tally itself looks.

## Open items for you
- Are there specific Tally shortcuts your staff already have deep muscle memory for (beyond the general pattern above) that should be matched key-for-key rather than just pattern-matched? E.g. if everyone already reflexively hits a specific key for "new sale," worth locking that in exactly.
