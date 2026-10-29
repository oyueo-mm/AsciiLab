import { SlidersHorizontal } from 'lucide-react'
import { CHARSETS, DENSITY_PRESETS } from '../../utils/ascii'
import type { AsciiSettings } from '../../utils/ascii'
import MaskControls from './MaskControls'
import { SettingsGroup } from './SettingsPanel'
type Props = {
  settings: AsciiSettings
  onChange: (settings: AsciiSettings) => void
  video?: boolean
  onPickColor?: () => void
  onSelectRegion?: () => void
  onAutoSelect?: () => void
  disabled?: boolean
}
export default function Controls({
  settings: s,
  onChange,
  video,
  onPickColor,
  onSelectRegion,
  onAutoSelect,
  disabled,
}: Props) {
  const set = <K extends keyof AsciiSettings>(
    key: K,
    value: AsciiSettings[K],
  ) => onChange({ ...s, [key]: value })
  const slider = (
    key:
      'columns' | 'brightness' | 'contrast' | 'fontSize' | 'lineHeight' | 'fps',
    label: string,
    min: number,
    max: number,
    step = 1,
    suffix = '',
  ) => (
    <label className="control" key={key}>
      <span>
        {label}
        <span className="control-value">
          {s[key]}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={s[key]}
        onChange={(e) => set(key, Number(e.target.value))}
      />
    </label>
  )
  return (
    <aside className="settings-panel">
      <div className="panel-heading">
        <SlidersHorizontal size={15} />
        <h2>변환 설정</h2>
      </div>
      <MaskControls
        mask={s.mask}
        onChange={(mask) => set('mask', mask)}
        video={video}
        onPick={onPickColor}
        onSelect={onSelectRegion}
        onAuto={onAutoSelect}
        disabled={disabled}
      />
      <SettingsGroup title="해상도">
        <label className="control">
          밀도 프리셋
          <select
            aria-label="밀도 프리셋"
            value={
              DENSITY_PRESETS.some((preset) => preset.columns === s.columns)
                ? s.columns
                : 'custom'
            }
            onChange={(event) => {
              if (event.target.value !== 'custom')
                set('columns', +event.target.value)
            }}
          >
            {DENSITY_PRESETS.map((preset) => (
              <option value={preset.columns} key={preset.columns}>
                {preset.label} · {preset.columns}열
              </option>
            ))}
            <option value="custom" disabled>
              사용자 지정
            </option>
          </select>
        </label>
        {slider(
          'columns',
          '문자 밀도 · 가로 문자 수',
          40,
          video ? 200 : 260,
          2,
        )}
        {video && slider('fps', '프리뷰 FPS', 5, 30, 1, ' fps')}
      </SettingsGroup>
      <SettingsGroup title="문자">
        <label className="control">
          문자 세트
          <select
            aria-label="문자 세트"
            value={s.charset}
            onChange={(e) =>
              set('charset', e.target.value as AsciiSettings['charset'])
            }
          >
            {[...Object.keys(CHARSETS), 'Custom'].map((key) => (
              <option key={key}>{key}</option>
            ))}
          </select>
        </label>
        {s.charset === 'Custom' ? (
          <label className="control">
            사용자 문자 · 진한 순서
            <input
              aria-label="사용자 문자"
              type="text"
              maxLength={80}
              value={s.custom}
              onChange={(e) => set('custom', e.target.value)}
              placeholder="@#*:. "
            />
          </label>
        ) : (
          <div className="charset-sample">{CHARSETS[s.charset]}</div>
        )}
        {slider('fontSize', '글자 크기', 8, 24, 1, ' px')}
        {slider('lineHeight', '줄 간격 · 비율 보정', 0.8, 1.6, 0.05)}
      </SettingsGroup>
      <SettingsGroup title="톤과 색상">
        {slider('brightness', '밝기', -100, 100)}
        {slider('contrast', '대비', 0.2, 2.5, 0.05)}
        <label className="switch-row">
          <span>명암 반전</span>
          <input
            type="checkbox"
            role="switch"
            checked={s.invert}
            onChange={(e) => set('invert', e.target.checked)}
          />
          <i />
        </label>
        <label className="control">
          색상 모드
          <select
            value={s.color}
            onChange={(e) =>
              set('color', e.target.value as AsciiSettings['color'])
            }
          >
            <option value="white">흑백</option>
            <option value="mint">민트</option>
            <option value="original">원본 색상</option>
          </select>
        </label>
        <label className="color-row">
          배경색
          <span>
            <code>{s.background}</code>
            <input
              aria-label="배경색"
              type="color"
              value={s.background}
              onChange={(e) => set('background', e.target.value)}
            />
          </span>
        </label>
      </SettingsGroup>
    </aside>
  )
}
