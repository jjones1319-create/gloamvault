import { useEffect, useState } from 'preact/hooks'
import { content, delve, delveVersion } from '../../game/session.ts'
import { NO_INSETS } from '../../scene/room/fit.ts'
import { settings } from '../store/settings.ts'
import { RoomStage } from '../components/RoomStage.tsx'
import { stageReady } from '../components/StageView.tsx'
import { Btn } from '../kit/kit.tsx'
import { buzz } from '../lib/haptics.ts'
import { navigate } from '../router.ts'
import { CurioModal } from './delve/CurioModal.tsx'
import { DelveMenu } from './delve/DelveMenu.tsx'
import { FightHud, fightFinale } from './delve/FightHud.tsx'
import { DelveHeader } from './delve/Header.tsx'
import { fightInsets, roomInsets } from './delve/insets.ts'
import { Icon } from './delve/icons.tsx'
import { MapModal, Minimap } from './delve/Minimap.tsx'
import { OverCard } from './delve/OverCard.tsx'
import { PartyStrip } from './delve/PartyStrip.tsx'
import { ResultCard } from './delve/ResultCard.tsx'
import { ItemsSheet, PetsSheet, RoomPanel } from './delve/RoomPanel.tsx'
import './delve.css'

/**
 * A delve (03 §3–§4, §12): the room in 3D under an overlay laid out for the landscape phone (892 × 412) — where the
 * party is, the light and the floor clock top-left; the floor map and the room's actions on the right; the party
 * bottom-left — with the middle of the room left clear. In a fight the fight HUD owns the screen. Curios, results
 * and the end of the delve come up over the same stage.
 */

type Sheet = 'map' | 'menu' | 'items' | 'pets' | null

export function DelveScreen() {
  void delveVersion.value
  const d = delve.value
  const c = content.value
  const [sheet, setSheet] = useState<Sheet>(null)
  if (!d || !c) return <NoDelve />
  const phase = d.phase.kind
  const fightShown = phase === 'fight' || fightFinale.value
  const insets = fightShown ? fightInsets(settings.value.textSize) : phase === 'over' ? NO_INSETS : roomInsets(settings.value.textSize)
  const close = () => setSheet(null)
  return (
    <main class="screen dv" data-screen="delve" data-phase={fightShown ? 'fight' : phase}>
      <RoomStage insets={insets} />
      {fightShown ? (
        <FightHud />
      ) : (
        <div class="dv-hud">
          <DelveHeader />
          <div class="dv-tools">
            <button
              class="btn btn--icon dv-tool"
              data-testid="dv-map"
              aria-label="The floor map"
              title="The floor map"
              onClick={() => {
                buzz()
                setSheet('map')
              }}
            >
              <Icon name="map" size={22} />
            </button>
            <button
              class="btn btn--icon dv-tool"
              data-testid="dv-menu"
              aria-label="Menu"
              title="Menu"
              onClick={() => {
                buzz()
                setSheet('menu')
              }}
            >
              <Icon name="menu" size={22} />
            </button>
          </div>
          {phase !== 'over' && (
            <aside class="dv-side">
              {phase === 'result' ? (
                <ResultCard />
              ) : (
                <>
                  <Minimap />
                  <RoomPanel onItems={() => setSheet('items')} onPets={() => setSheet('pets')} />
                </>
              )}
            </aside>
          )}
          <PartyStrip />
          {phase === 'curio' && <CurioModal />}
          {phase === 'over' && <OverCard />}
          {sheet === 'map' && <MapModal onClose={close} />}
          {sheet === 'menu' && <DelveMenu onClose={close} onMap={() => setSheet('map')} />}
          {sheet === 'items' && phase === 'room' && <ItemsSheet onClose={close} />}
          {sheet === 'pets' && phase === 'room' && <PetsSheet onClose={close} />}
        </div>
      )}
    </main>
  )
}

/**
 * No delve in progress: a stale link, or the moment between "Back to Emberfall" settling the delve and the town
 * screen arriving — so the words wait a beat and that moment shows only the dark background.
 */
function NoDelve() {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    stageReady.value = true
    const t = setTimeout(() => setShown(true), 400)
    return () => clearTimeout(t)
  }, [])
  return (
    <main class="screen screen--panel dv-none" data-screen="delve">
      {shown && (
        <>
          <p class="dv-none__text">The party is not in a dungeon.</p>
          <Btn tone="primary" testid="dv-none-town" onClick={() => navigate('town')}>
            To Emberfall
          </Btn>
        </>
      )}
    </main>
  )
}
