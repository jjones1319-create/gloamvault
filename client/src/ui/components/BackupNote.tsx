import { useEffect } from 'preact/hooks'
import { backupDue, lastBackupWords, remindLater } from '../../game/backup.ts'
import { act, content, ephemeral, notePlayDay, profile } from '../../game/session.ts'
import { Btn } from '../kit/kit.tsx'
import { canShareFiles, downloadSave, shareSave } from '../screens/town/save-controls.tsx'
import './backupNote.css'

/**
 * The backup reminder (10 §6: "a reminder every ~7 days of play"; Phase 8, pass B), among the town hub's notices. Opening
 * the hub counts the day (once a day, the client's clock); after `onboarding.backupReminderPlayDays` days of play since
 * the last backup a gentle note offers Download save and, where the phone can, Share save. "Not now" puts it away for
 * as many days again. Never during a delve (the hub only) and never for a demo session.
 */
export function BackupNote() {
  useEffect(() => notePlayDay(), [])
  const c = content.value
  const p = profile.value
  if (!c || !p || ephemeral.value) return null
  const every = c.tuning.onboarding?.backupReminderPlayDays.value ?? 7
  if (!backupDue(p, every)) return null
  return (
    <div class="tw-notice backup-note" role="status" data-testid="backup-note">
      <div class="tw-notice__text">
        <b>Keep a copy of your save</b>
        <span class="tw-notice__line">{lastBackupWords(p, new Date())} A copy in Downloads, or sent to yourself, keeps your heroes safe if the phone ever clears the browser’s storage.</span>
      </div>
      <div class="backup-note__actions">
        <Btn tone="primary" testid="backup-download" onClick={() => void downloadSave()}>
          Download save
        </Btn>
        {canShareFiles() && (
          <Btn testid="backup-share" onClick={() => void shareSave()}>
            Share save
          </Btn>
        )}
        <Btn tone="quiet" testid="backup-later" onClick={() => act((_c, q) => remindLater(q))}>
          Not now
        </Btn>
      </div>
    </div>
  )
}
