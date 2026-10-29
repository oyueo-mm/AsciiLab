import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, PanelRightClose, PanelRightOpen } from 'lucide-react'

export function useSettingsPanel() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('asciilab:settings-open') !== 'false'
    } catch {
      return true
    }
  })
  return {
    open,
    toggle: () =>
      setOpen((previous) => {
        try {
          localStorage.setItem('asciilab:settings-open', String(!previous))
        } catch {
          /* optional UI preference */
        }
        return !previous
      }),
  }
}
export function SettingsPanelToggle({
  open,
  toggle,
}: {
  open: boolean
  toggle: () => void
}) {
  const Icon = open ? PanelRightClose : PanelRightOpen
  return (
    <button
      className="button secondary small settings-toggle"
      aria-label={open ? '변환 설정 접기' : '변환 설정 펼치기'}
      aria-expanded={open}
      aria-controls="studio-settings"
      onClick={toggle}
    >
      <Icon size={16} />
      <span>변환 설정</span>
    </button>
  )
}
export function SettingsPanel({
  open,
  children,
}: {
  open: boolean
  children: ReactNode
}) {
  return (
    <div
      id="studio-settings"
      className="settings-rail"
      aria-hidden={!open}
      inert={!open}
    >
      {children}
    </div>
  )
}
export function SettingsGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <section className="control-section">
      <h3>
        <button
          className="settings-group-toggle"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {title}
          <ChevronDown size={14} className={open ? '' : 'is-closed'} />
        </button>
      </h3>
      <div hidden={!open}>{children}</div>
    </section>
  )
}
