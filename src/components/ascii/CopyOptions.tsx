import type { CopyMode } from '../../utils/clipboard'

export default function CopyOptions({
  mode,
  onMode,
  columns,
  onColumns,
  showWidth,
  onCopy,
}: {
  mode: CopyMode
  onMode: (mode: CopyMode) => void
  columns: number
  onColumns: (columns: number) => void
  showWidth: boolean
  onCopy: () => void
}) {
  return (
    <div className="copy-options">
      <div className="copy-actions">
        <select
          aria-label="복사 형식"
          value={mode}
          onChange={(e) => onMode(e.target.value as CopyMode)}
        >
          <option value="image">이미지 복사 · 권장</option>
          <option value="html">서식 포함 복사</option>
          <option value="text">텍스트 복사</option>
        </select>
        <button onClick={onCopy}>복사</button>
      </div>
      {showWidth && (
        <label className="copy-width">
          복사용 가로 문자 수
          <select
            aria-label="복사용 가로 문자 수"
            value={columns}
            onChange={(e) => onColumns(+e.target.value)}
          >
            {[40, 60, 80, 100, 120].map((width) => (
              <option value={width} key={width}>
                {width}열
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
