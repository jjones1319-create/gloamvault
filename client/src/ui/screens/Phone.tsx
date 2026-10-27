import { TopBar } from '../components/TopBar.tsx'
import { isStandalone } from '../lib/platform.ts'
import { PHASE } from './Title.tsx'

/** The "Try this on your phone" card: install steps and the current phase's checklist (CLAUDE.md: end of every phase). */
export function PhoneScreen() {
  const installed = isStandalone()
  return (
    <main class="screen screen--panel" data-screen="phone">
      <TopBar title="Try this on your phone" />
      <div class="panel panel--columns">
        <section class="group">
          <h2 class="group__title">{installed ? 'Installed ✓' : 'Install it (once)'}</h2>
          {installed ? (
            <p class="prose">You are running from the home-screen icon. Updates arrive as a toast on the title screen: tap Restart.</p>
          ) : (
            <ol class="steps">
              <li>Open this link in Chrome on your phone.</li>
              <li>
                Tap the <b>⋮</b> menu at the top right.
              </li>
              <li>
                Tap <b>Add to Home screen</b>, then <b>Install</b>.
              </li>
              <li>Open Gloamvault from its icon. It runs full-screen, sideways, and works offline.</li>
            </ol>
          )}
        </section>
        <section class="group">
          <h2 class="group__title">Phase {PHASE} checklist</h2>
          <ol class="steps">
            <li>
              The title shows <b>v{__APP_VERSION__}</b>, the torches flicker, and the phone is sideways.
            </li>
            <li>Settings → turn on the performance overlay. You should read about 60 fps on the title screen.</li>
            <li>Switch Frame rate to Battery 30 and watch the number drop to about 30. Switch back.</li>
            <li>Turn on Large text and check this page is still readable without scrolling sideways.</li>
            <li>Turn Wi-Fi off and reopen the app: it still opens (offline).</li>
            <li>Turn your phone upright in a Chrome tab: a "turn your phone sideways" hint appears.</li>
          </ol>
        </section>
      </div>
    </main>
  )
}
