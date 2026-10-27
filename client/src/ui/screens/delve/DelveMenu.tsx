import { ephemeral } from '../../../game/session.ts'
import { navigate } from '../../router.ts'
import { Btn, Modal } from '../../kit/kit.tsx'

/** The delve's small menu: the map, Settings, and leaving the game (a real delve is saved after every step). */
export function DelveMenu({ onClose, onMap }: { onClose: () => void; onMap: () => void }) {
  return (
    <Modal title="Menu" onClose={onClose} testid="dv-menusheet">
      <div class="dv-menu">
        <Btn testid="dv-menu-map" onClick={onMap}>
          Map
        </Btn>
        <Btn testid="dv-menu-settings" onClick={() => navigate('settings')}>
          Settings
        </Btn>
        <Btn testid="dv-menu-leave" onClick={() => navigate('title')}>
          {ephemeral.value ? 'Leave the game (this test delve is not saved)' : 'Leave the game (the delve is saved)'}
        </Btn>
        <Btn tone="quiet" testid="dv-menu-close" onClick={onClose}>
          Back to the delve
        </Btn>
      </div>
    </Modal>
  )
}
