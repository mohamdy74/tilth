# Desktop PWA Update Parity — Short Design

## Intent

Make the installed desktop PWA receive and apply new releases as easily and reliably as the phone version. Keep one shared update pipeline and one shared codebase; do not create a native desktop application or a second release channel.

## Current state

- `src/lib/pwa.ts` already serves phone and desktop: service-worker registration, waiting-update detection, 30-minute/visibility checks, user-approved reload, manual Settings check, and stuck-cache recovery.
- `AppShell` shows the same update banner at desktop and mobile breakpoints and disables it during an active Focus session.
- Registration does not explicitly check for an update immediately after registration or when connectivity returns. Periodic update rejections are not handled. `applyUpdate` gives no result, so the banner is dismissed even if no waiting worker accepted the reload.

## Goals

- Check for a waiting/new worker immediately after registration and on the browser `online` event, retaining visibility and 30-minute checks.
- Handle offline update-check failures without unhandled rejections.
- Return a meaningful result from `applyUpdate`; dismiss the banner only after a waiting worker accepted `SKIP_WAITING`.
- Preserve user-approved reload and never reload automatically during an active Focus session, including the Settings action.
- Keep the existing banner, Settings layout, Arabic/English copy, offline data, and service-worker generation pipeline unchanged.

## Non-goals / anti-goals

- No Electron/Tauri/native installer, native auto-updater, new dependency, backend, or push service.
- No UI redesign, silent background reload, schema change, or change to development/preview behavior.
- Do not clear IndexedDB or weaken the existing cache-recovery safeguard.

## Approach

1. Harden `registerPwa`: immediate post-registration update, `online` listener, offline-safe checks, and listener cleanup.
2. Make `applyUpdate(): Promise<boolean>` post to the waiting worker and report whether the handoff started; retain one `controllerchange` reload. Return false for missing registration/waiting worker or API failure.
3. Update AppShell and Settings callers to honor that result and preserve the Focus-session guard.
4. Add focused unit tests with mocked service-worker registrations for immediate checks, online checks, offline rejection, cleanup, and accepted/missing waiting workers. Run the full suite, production build, and workerd probes; perform a desktop-viewport browser smoke of the unchanged update UI.

## Alternatives considered

- **Native desktop wrapper:** rejected as unnecessary infrastructure and a second update system for a capability the PWA already owns.
- **Force reload on a timer:** rejected because it can disrupt Focus and the user's work; updates remain user-approved.
- **Only restyle the banner:** rejected because it would not address the actual detection and handoff failure modes.
