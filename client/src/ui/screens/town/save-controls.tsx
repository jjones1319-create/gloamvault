import { useRef, useState } from 'preact/hooks'
import { content, exportCurrentSave, importSaveText, noteBackup, toast } from '../../../game/session.ts'
import { Btn } from '../../kit/kit.tsx'
import { saveFileName } from './text.ts'

/**
 * The save by hand (10 §6): download the whole profile as a JSON file, or load one back. Used by the Lantern Inn and
 * Settings → Save. The game saves itself after every action; these are for moving phones or keeping a copy.
 */

/** Hands the browser the save as `gloamvault-save-<date>.json` (Android Chrome puts it in Downloads). */
export function downloadSave(): boolean {
  const text = exportCurrentSave()
  if (!text) {
    toast('There is no save to download yet.', 'bad')
    return false
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = saveFileName(new Date())
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast('Backup downloaded: look in Downloads.', 'good')
    // Phase 8 (pass B): the backup reminder's count starts again (10 §6).
    noteBackup()
    return true
  } catch {
    toast('The download did not start.', 'bad')
    return false
  }
}

/**
 * The save as a file to share (Phase 8, pass B; 10 §6 "Share save…"): the phone's share sheet sends it to a chat, a mail
 * or a drive. Android Chrome shares only some file types and JSON is not one of them, so the shared copy is plain text
 * named `.txt` (Import reads it all the same); where files cannot be shared, it downloads instead.
 */
export async function shareSave(): Promise<boolean> {
  const text = exportCurrentSave()
  if (!text) {
    toast('There is no save to share yet.', 'bad')
    return false
  }
  const file = new File([text], saveFileName(new Date()).replace(/\.json$/, '.txt'), { type: 'text/plain' })
  if (!canShareFiles(file)) return downloadSave()
  try {
    await navigator.share({ files: [file], title: 'Gloamvault save' })
    toast('Save shared.', 'good')
    noteBackup()
    return true
  } catch (e) {
    // Closing the share sheet is not a failure; anything else falls back to the download.
    if (e instanceof DOMException && e.name === 'AbortError') return false
    return downloadSave()
  }
}

/** Whether this browser can share a file (the Web Share API with files). */
export function canShareFiles(file: File = new File(['{}'], 'gloamvault-save.txt', { type: 'text/plain' })): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export function DownloadSaveButton({ label = 'Download a backup', disabled = false }: { label?: string; disabled?: boolean }) {
  return (
    <Btn testid="save-download" disabled={disabled} onClick={() => void downloadSave()}>
      {label}
    </Btn>
  )
}

/**
 * A button that opens the phone's file picker; the chosen file replaces the save (the current one is backed up
 * first by the session). No `accept` filter: some Android pickers grey out .json files when one is set.
 */
export function ImportSaveButton({ label = 'Import a save', onLoaded }: { label?: string; onLoaded?: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <Btn testid="save-import" disabled={busy || content.value === null} onClick={() => input.current?.click()}>
        {busy ? 'Reading…' : label}
      </Btn>
      <input
        ref={input}
        type="file"
        class="tw-file"
        data-testid="save-import-file"
        aria-label="Choose a save file"
        onChange={(e) => {
          const el = e.currentTarget
          const file = el.files?.[0]
          el.value = ''
          if (!file) return
          setBusy(true)
          file
            .text()
            .then((text) => importSaveText(text))
            .then((ok) => {
              if (ok) onLoaded?.()
            })
            .catch(() => toast('That file could not be read.', 'bad'))
            .finally(() => setBusy(false))
        }}
      />
    </>
  )
}
