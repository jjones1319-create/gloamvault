import type { JSX } from 'preact'

/**
 * Small line icons for the map and the room panel (our own drawings, 24 × 24, stroked in currentColor): one per
 * room kind, plus the key, the hunter's paw, a lock, the map and the menu.
 */
const PATHS: Readonly<Record<string, JSX.Element>> = {
  fight: (
    <>
      <path d="M5 4l10 10M4 5l1-1M19 4L9 14M20 5l-1-1" />
      <path d="M7 15l2 2M17 15l-2 2M6 18l-2 2M18 18l2 2" />
    </>
  ),
  elite: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z" />,
  boss: <path d="M3 17l2-9 4.5 4L12 5l2.5 7L19 8l2 9zM4 20h16" />,
  rest: (
    <>
      <path d="M12 3c2 3 4 5 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-2-1-4 0-7z" />
      <path d="M4 20l16-3M4 17l16 3" />
    </>
  ),
  merchant: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v11" />
    </>
  ),
  treasure: (
    <>
      <path d="M3 10h18v9H3zM3 10l2-4h14l2 4" />
      <path d="M11 12h2v3h-2z" />
    </>
  ),
  curio: (
    <>
      <path d="M12 3l8 9-8 9-8-9z" />
      <path d="M12 9v4M12 16v.5" />
    </>
  ),
  trapGauntlet: (
    <>
      <path d="M12 3l10 17H2z" />
      <path d="M12 9v5M12 17v.5" />
    </>
  ),
  secret: <path d="M12 2v6M12 16v6M2 12h6M16 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M6 18l3-3" />,
  stairs: <path d="M3 6h5v4h4v4h4v4h5M17 3v6M14.5 6.5L17 9l2.5-2.5" />,
  entry: (
    <>
      <path d="M5 21V10a7 7 0 0 1 14 0v11" />
      <path d="M3 21h18" />
    </>
  ),
  keyRoom: (
    <>
      <circle cx="7.5" cy="12" r="3.5" />
      <path d="M11 12h10M17 12v3M20 12v2" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="12" r="3.5" />
      <path d="M11 12h10M17 12v3M20 12v2" />
    </>
  ),
  unknown: <path d="M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.2-1.5 2.4M12 17.5v.5" />,
  paw: (
    <>
      <ellipse cx="12" cy="15.5" rx="4" ry="3.5" />
      <circle cx="6" cy="10" r="1.6" />
      <circle cx="9.5" cy="6.5" r="1.6" />
      <circle cx="14.5" cy="6.5" r="1.6" />
      <circle cx="18" cy="10" r="1.6" />
    </>
  ),
  lock: (
    <>
      <path d="M6 11h12v9H6z" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  skull: (
    <>
      <path d="M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4.2 3 5.3V19h8v-3.7c1.8-1.1 3-2.9 3-5.3a7 7 0 0 0-7-7z" />
      <circle cx="9.3" cy="10.5" r="1.3" />
      <circle cx="14.7" cy="10.5" r="1.3" />
      <path d="M10.5 19v2M13.5 19v2" />
    </>
  ),
  map: <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
}

export function Icon({ name, size = 18, class: cls = '' }: { name: string; size?: number; class?: string }) {
  return (
    <svg class={`dv-icon ${cls}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {PATHS[name] ?? PATHS.unknown}
    </svg>
  )
}
