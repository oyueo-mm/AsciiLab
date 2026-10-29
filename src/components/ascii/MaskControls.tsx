import { Lasso, Pipette, RotateCcw } from 'lucide-react'
import { DEFAULT_MASK } from '../../utils/mask'
import type { MaskSettings } from '../../utils/mask'
import { SettingsGroup } from './SettingsPanel'
type Props = {
  mask: MaskSettings
  onChange: (mask: MaskSettings) => void
  video?: boolean
  onPick?: () => void
  onSelect?: () => void
  onAuto?: () => void
  disabled?: boolean
}
export default function MaskControls({
  mask,
  onChange,
  video,
  onPick,
  onSelect,
  onAuto,
  disabled,
}: Props) {
  return (
    <SettingsGroup title="변환 영역">
      <label className="control">
        변환 대상
        <select
          aria-label="변환 대상"
          value={mask.mode}
          onChange={(e) => {
            const mode = e.target.value as MaskSettings['mode']
            if (mode === 'auto') onAuto?.()
            else if (mode === 'lasso' && !mask.region) onSelect?.()
            else onChange({ ...mask, mode })
          }}
        >
          <option value="none">전체 {video ? '영상 프레임' : '이미지'}</option>
          <option value="color">배경색 제거</option>
          {!video && <option value="lasso">직접 영역 선택</option>}
          {!video && <option value="auto">자동 피사체 선택</option>}
        </select>
      </label>
      {mask.mode === 'color' && (
        <>
          <div className="mask-color-row">
            <label>
              제거할 색
              <input
                type="color"
                aria-label="제거할 배경색"
                value={mask.keyColor}
                onChange={(e) =>
                  onChange({ ...mask, keyColor: e.target.value })
                }
              />
            </label>
            <button
              className="button secondary small"
              title="원본에서 배경색 선택"
              aria-label="배경색 스포이트"
              disabled={disabled}
              onClick={onPick}
            >
              <Pipette size={15} /> 스포이트
            </button>
          </div>
          <label className="control">
            <span>
              색상 유사도 허용치
              <span className="control-value">{mask.tolerance}%</span>
            </span>
            <input
              aria-label="색상 유사도 허용치"
              type="range"
              min={0}
              max={100}
              value={mask.tolerance}
              onChange={(e) =>
                onChange({ ...mask, tolerance: Number(e.target.value) })
              }
            />
          </label>
        </>
      )}
      {mask.mode === 'lasso' && (
        <button
          className="button secondary small region-reselect"
          onClick={onSelect}
        >
          <Lasso size={15} /> 영역 다시 선택
        </button>
      )}
      {mask.mode === 'auto' && (
        <button
          className="button secondary small region-reselect"
          onClick={onAuto}
        >
          선택 영역 보정
        </button>
      )}
      {mask.mode !== 'none' && (
        <>
          <label className="control">
            <span>
              경계 부드럽게<span className="control-value">{mask.feather}</span>
            </span>
            <input
              aria-label="경계 부드럽게"
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={mask.feather}
              onChange={(e) =>
                onChange({ ...mask, feather: Number(e.target.value) })
              }
            />
          </label>
          <button
            className="mask-reset"
            onClick={() => onChange({ ...DEFAULT_MASK })}
          >
            <RotateCcw size={12} /> 배경 제거 초기화
          </button>
        </>
      )}
    </SettingsGroup>
  )
}
