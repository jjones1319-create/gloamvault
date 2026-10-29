import { useState } from 'preact/hooks'
import { lowerDeathRule, lowerRulesFor } from '../../../../sim/src/town.ts'
import type { DeathRule } from '../../../../sim/src/types/enums.ts'
import { act, eraseSave, ephemeral, profile, toast } from '../../game/session.ts'
import { HelpGroup } from '../components/HelpGroup.tsx'
import { SoundGroup } from '../../audio/SoundSettings.tsx'
import { Choice, Toggle } from '../components/Toggle.tsx'
import { TopBar } from '../components/TopBar.tsx'
import { Btn, Modal } from '../kit/kit.tsx'
import { buzz } from '../lib/haptics.ts'
import { enterFullscreenLandscape, exitFullscreen, installPromptAvailable, isFullscreen, isStandalone, promptInstall } from '../lib/platform.ts'
import { resetSettings, settings, updateSettings } from '../store/settings.ts'
import { checkForUpdate, lastCheck, needRefresh } from '../store/updates.ts'
import { navigate } from '../router.ts'
import { DownloadSaveButton, ImportSaveButton } from './town/save-controls.tsx'
import { deathRuleLine, deathRuleName } from './town/text.ts'

const CHECK_TEXT = {
  checking: 'Checking…',
  upToDate: 'You have the latest build.',
  updateFound: 'Update found: restart from its note on the title or in town, between delves.',
  failed: 'Could not check (offline, or not installed).',
} as const

export function SettingsScreen() {
  const s = settings.value
  return (
    <main class="screen screen--panel" data-screen="settings">
      <TopBar title="Settings" />
      <div class="panel">
        <section class="group">
          <h2 class="group__title">Display</h2>
          <Toggle
            label="Performance overlay"
            hint="fps, frame time, draw calls, triangles, memory in the corner"
            on={s.perfOverlay}
            onChange={(on) => updateSettings({ perfOverlay: on })}
            testId="toggle-perf"
          />
          <Choice
            label="Frame rate"
            hint="Smooth aims for 60 fps; Battery caps at 30 and runs cooler"
            value={s.frameMode}
            options={[
              { value: 'smooth', label: 'Smooth 60' },
              { value: 'battery', label: 'Battery 30' },
            ]}
            onChange={(frameMode) => updateSettings({ frameMode })}
          />
          <Choice
            label="Text size"
            hint="All the words in the game: 100, 115 or 130%"
            value={s.textSize}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Large' },
              { value: 'largest', label: 'Largest' },
            ]}
            onChange={(textSize) => updateSettings({ textSize })}
          />
          <Choice
            label="Colours"
            hint="Colour-blind safe: friend and foe, good and bad, health and grades in colours you can tell apart"
            value={s.palette}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'redGreen', label: 'Red–green safe' },
              { value: 'blueYellow', label: 'Blue–yellow safe' },
            ]}
            onChange={(palette) => updateSettings({ palette })}
          />
          <Toggle
            label="Reduce motion"
            hint="No camera glides, sway, flicker or effects; numbers and cards appear without moving"
            on={s.reduceMotion}
            onChange={(on) => updateSettings({ reduceMotion: on })}
            testId="toggle-reduce-motion"
          />
          <Toggle label="Haptics" hint="A short buzz on taps" on={s.haptics} onChange={(on) => updateSettings({ haptics: on })} />
        </section>

        <SoundGroup />

        <section class="group">
          <h2 class="group__title">Phone</h2>
          <div class="row">
            <span class="toggle__text">
              <span class="toggle__label">Full screen, landscape</span>
              <span class="toggle__hint">{isStandalone() ? 'Installed: already full screen.' : isFullscreen.value ? 'On.' : 'Hides the browser bars.'}</span>
            </span>
            {!isStandalone() && (
              <button
                class="btn"
                onClick={() => {
                  buzz()
                  void (isFullscreen.value ? exitFullscreen() : enterFullscreenLandscape())
                }}
              >
                {isFullscreen.value ? 'Exit' : 'Go full screen'}
              </button>
            )}
          </div>
          {!isStandalone() && (
            <div class="row">
              <span class="toggle__text">
                <span class="toggle__label">Install the app</span>
                <span class="toggle__hint">{installPromptAvailable.value ? 'Chrome can install it now.' : 'Chrome menu ⋮ → Add to Home screen.'}</span>
              </span>
              {installPromptAvailable.value && (
                <button
                  class="btn btn--primary"
                  onClick={() => {
                    buzz()
                    void promptInstall()
                  }}
                >
                  Install
                </button>
              )}
            </div>
          )}
          <div class="row">
            <span class="toggle__text">
              <span class="toggle__label">Updates</span>
              <span class="toggle__hint" data-testid="update-status">
                {needRefresh.value ? CHECK_TEXT.updateFound : lastCheck.value ? CHECK_TEXT[lastCheck.value] : 'Checked when you open the game.'}
              </span>
            </span>
            <button
              class="btn"
              onClick={() => {
                buzz()
                void checkForUpdate()
              }}
            >
              Check now
            </button>
          </div>
        </section>

        <SaveGroup />

        <HelpGroup />

        <section class="group">
          <h2 class="group__title">About</h2>
          <div class="row">
            <span class="toggle__text">
              <span class="toggle__label">Gloamvault v{__APP_VERSION__}</span>
              <span class="toggle__hint">An original game. No accounts, no ads, no purchases. Everything is saved on this phone.</span>
            </span>
            <button
              class="btn"
              onClick={() => {
                buzz()
                resetSettings()
              }}
            >
              Reset settings
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

/**
 * Settings → Save (10 §6, D-088): the save's death rule (Mortal may be lowered to Sheltered, never raised), the backup
 * file both ways, and erasing the save behind a confirm (a backup is kept).
 */
function SaveGroup() {
  const p = profile.value
  const [asking, setAsking] = useState(false)
  const [lowering, setLowering] = useState<DeathRule | null>(null)
  const has = p !== null && p.heroes.length > 0
  return (
    <section class="group" data-testid="settings-save">
      <h2 class="group__title">Save</h2>
      {p && (
        <div class="row" data-testid="save-death-rule">
          <span class="toggle__text">
            <span class="toggle__label">Death rule: {deathRuleName(p.deathRule)}</span>
            <span class="toggle__hint">
              {ruleHint(p.deathRule)}
              {p.activeDelve && p.deathRule !== 'sheltered' ? ' Finish the delve to lower it: the rule changes only in town.' : ''}
            </span>
          </span>
          {lowerRulesFor(p.deathRule).map((r) => (
            <Btn key={r} testid={r === 'sheltered' ? 'save-lower-rule' : `save-lower-${r}`} disabled={p.activeDelve !== null} onClick={() => setLowering(r)}>
              Lower to {deathRuleName(r)}
            </Btn>
          ))}
        </div>
      )}
      <div class="row">
        <span class="toggle__text">
          <span class="toggle__label">Download a backup</span>
          <span class="toggle__hint">
            {!has ? 'No save on this phone yet.' : ephemeral.value ? 'This is a demo: nothing here is saved.' : `${p.heroes.map((h) => h.name).join(', ')} · saved automatically after everything you do`}
          </span>
        </span>
        <DownloadSaveButton label="Download" disabled={!has} />
      </div>
      <div class="row">
        <span class="toggle__text">
          <span class="toggle__label">Import a save</span>
          <span class="toggle__hint">Load a backup file. The save on this phone is kept as a backup first.</span>
        </span>
        <ImportSaveButton label="Import" />
      </div>
      <div class="row">
        <span class="toggle__text">
          <span class="toggle__label">Erase this save</span>
          <span class="toggle__hint">Start over on this phone. A backup is kept.</span>
        </span>
        <Btn tone="danger" testid="save-erase" disabled={p === null} onClick={() => setAsking(true)}>
          Erase
        </Btn>
      </div>
      {lowering && p && (
        <Modal
          title={`Lower to ${deathRuleName(lowering)}?`}
          testid="save-lower-modal"
          onClose={() => setLowering(null)}
          actions={
            <>
              <Btn onClick={() => setLowering(null)}>Keep {deathRuleName(p.deathRule)}</Btn>
              <Btn
                tone="danger"
                testid="save-lower-confirm"
                onClick={() => {
                  const to = lowering
                  setLowering(null)
                  act((_c, pp) => lowerDeathRule(pp, to), `This save is ${deathRuleName(to)} now`)
                }}
              >
                Lower to {deathRuleName(lowering)}
              </Btn>
            </>
          }
        >
          <p class="prose">{ruleHint(lowering)}</p>
          <p class="prose">This cannot be undone: a rule can be lowered again, never raised.</p>
        </Modal>
      )}
      {asking && (
        <Modal
          title="Erase this save?"
          testid="save-erase-modal"
          onClose={() => setAsking(false)}
          actions={
            <>
              <Btn onClick={() => setAsking(false)}>Keep it</Btn>
              <Btn
                tone="danger"
                testid="save-erase-confirm"
                onClick={() => {
                  setAsking(false)
                  void eraseSave().then(() => {
                    toast('The save is erased. A backup is kept.', 'info')
                    navigate('title')
                  })
                }}
              >
                Erase
              </Btn>
            </>
          }
        >
          <p class="prose">Your heroes, gold and gear on this phone will be gone. A backup is kept.</p>
        </Modal>
      )}
    </section>
  )
}

/** The rule's line without its name: "A hero who dies in the tower stays dead…". */
function ruleHint(rule: DeathRule): string {
  const line = deathRuleLine(rule).replace(/^[A-Za-z]+: /, '')
  return line[0]!.toUpperCase() + line.slice(1)
}
