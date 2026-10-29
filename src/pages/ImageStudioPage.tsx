import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Columns2,
  Download,
  FileImage,
  Image,
  Lasso,
  RotateCcw,
  Save,
  Upload,
  X,
} from 'lucide-react'
import Controls from '../components/ascii/Controls'
import { AsciiCanvas } from '../components/ascii/AsciiCanvas'
import {
  convertSource,
  DEFAULT_SETTINGS,
  downloadBlob,
  exportHtml,
  exportPng,
  normalizeSettings,
} from '../utils/ascii'
import type { AsciiSettings } from '../utils/ascii'
import { canvasBlob, getArtwork, saveArtwork } from '../utils/storage'
import { createSample } from '../utils/sample'
import { DEFAULT_MASK, maskImage } from '../utils/mask'
import { decodeRaster } from '../utils/image'
import RegionEditor from '../components/ascii/RegionEditor'

type Source = {
  image: HTMLImageElement | HTMLCanvasElement
  url: string
  width: number
  height: number
}
export default function ImageStudioPage() {
  const [params] = useSearchParams()
  const [source, setSource] = useState<Source>(() => {
    const image = createSample()
    return {
      image,
      url: image.toDataURL(),
      width: image.width,
      height: image.height,
    }
  })
  const [settings, setSettings] = useState<AsciiSettings>({
    ...DEFAULT_SETTINGS,
  })
  const [name, setName] = useState('Moon study'),
    [editor, setEditor] = useState<'color' | 'lasso' | null>(null),
    [view, setView] = useState('ascii'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [dragging, setDragging] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null),
    input = useRef<HTMLInputElement>(null),
    generation = useRef(0)
  const masked = useMemo(
    () => maskImage(source.image, source.width, source.height, settings.mask),
    [source, settings.mask],
  )
  const frame = useMemo(
    () =>
      convertSource(masked, source.width, source.height, settings, undefined, {
        maskApplied: true,
      }),
    [masked, source.width, source.height, settings],
  )
  const load = async (
    file: Blob,
    title: string,
    savedSettings?: AsciiSettings,
  ) => {
    const token = ++generation.current
    try {
      const safe = await decodeRaster(file)
      if (token !== generation.current) return
      setSource({
        image: safe,
        url: safe.toDataURL(),
        width: safe.width,
        height: safe.height,
      })
      setName(title)
      setView('ascii')
      setEditor(null)
      if (savedSettings) setSettings(normalizeSettings(savedSettings))
      else
        setSettings((previous) => ({ ...previous, mask: { ...DEFAULT_MASK } }))
    } catch (error) {
      if (token === generation.current)
        setMessage(
          error instanceof Error && error.message.startsWith('이미지가')
            ? error.message
            : '이미지를 읽을 수 없습니다. PNG, JPG, WebP 등 브라우저가 지원하는 파일을 선택해 주세요.',
        )
    }
  }
  useEffect(() => {
    let active = true
    const id = params.get('id')
    if (id)
      getArtwork(id)
        .then((art) => {
          if (!active) return
          if (art) void load(art.source, art.name, art.settings)
          else setMessage('저장된 작품을 찾을 수 없습니다.')
        })
        .catch((error) => {
          if (active) setMessage(error.message)
        })
    return () => {
      active = false
      generation.current++
    }
  }, [params])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 6000)
    return () => clearTimeout(timer)
  }, [message])
  function upload(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setMessage('PNG, JPG, WebP, GIF, AVIF 이미지를 선택해 주세요.')
      return
    }
    if (file.size > 30 * 1024 * 1024) {
      setMessage('30MB 이하 이미지를 선택해 주세요.')
      return
    }
    void load(file, file.name.replace(/\.[^.]+$/, ''))
  }
  async function save() {
    if (!canvas.current || busy) return
    setBusy(true)
    try {
      const original = document.createElement('canvas'),
        scale = Math.min(1, 1600 / Math.max(source.width, source.height))
      original.width = Math.round(source.width * scale)
      original.height = Math.round(source.height * scale)
      original
        .getContext('2d')!
        .drawImage(source.image, 0, 0, original.width, original.height)
      const thumb = document.createElement('canvas')
      thumb.width = 480
      thumb.height = Math.round(
        (480 * canvas.current.height) / canvas.current.width,
      )
      thumb
        .getContext('2d')!
        .drawImage(canvas.current, 0, 0, thumb.width, thumb.height)
      await saveArtwork({
        id: crypto.randomUUID(),
        name: name.trim() || 'Untitled',
        created: Date.now(),
        source: await canvasBlob(original),
        thumbnail: await canvasBlob(thumb),
        settings: { ...settings },
        text: frame.text,
      })
      setMessage(
        '갤러리에 저장했습니다. Gallery에서 이어서 편집할 수 있습니다.',
      )
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const filename = name.trim().replace(/[<>:"/\\|?*]/g, '-') || 'asciilab'
  return (
    <div className="studio-page">
      <div className="page-heading">
        <h1>이미지 변환</h1>
      </div>
      <div className="studio-toolbar">
        <div className="toolbar-group">
          <button
            className="button primary small"
            onClick={() => input.current?.click()}
          >
            <Upload size={15} /> 이미지 업로드
          </button>
          <input
            ref={input}
            className="visually-hidden"
            aria-label="이미지 파일 선택"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif"
            onChange={(e) => {
              upload(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button
            className="icon-button"
            title="설정 초기화"
            aria-label="설정 초기화"
            onClick={() => {
              setSettings({ ...DEFAULT_SETTINGS })
              setMessage('설정을 초기화했습니다.')
            }}
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="icon-button"
            title="영역 선택"
            aria-label="영역 선택"
            aria-pressed={settings.mask.mode === 'lasso'}
            onClick={() => setEditor('lasso')}
          >
            <Lasso size={17} />
          </button>
        </div>
        <div className="segmented" aria-label="미리보기 모드">
          {[
            { key: 'original', label: '원본', Icon: Image },
            { key: 'ascii', label: 'ASCII', Icon: FileImage },
            { key: 'compare', label: '비교', Icon: Columns2 },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              aria-pressed={view === key}
              className={view === key ? 'selected' : ''}
              onClick={() => setView(key)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <button
          className="button secondary small"
          onClick={save}
          disabled={busy}
        >
          <Save size={14} />
          {busy ? '저장 중…' : '갤러리에 저장'}
        </button>
      </div>
      <div className="editor-layout">
        <div className="editor-main">
          <div className="preview-header">
            <label>
              <input
                aria-label="작품 이름"
                title={`${source.width} × ${source.height}`}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          </div>
          <div
            className={`preview-stage ${view === 'compare' ? 'compare-view' : ''} ${dragging ? 'is-dragging' : ''} ${settings.transparentBackground ? 'checkerboard' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              upload(e.dataTransfer.files[0])
            }}
          >
            <div
              className={`preview-piece ${view === 'ascii' ? 'hidden-preview' : ''}`}
            >
              <img src={source.url} alt={`${name} 원본`} />
            </div>
            <div
              className={`preview-piece ${view === 'original' ? 'hidden-preview' : ''}`}
            >
              <AsciiCanvas ref={canvas} frame={frame} settings={settings} />
            </div>
            {dragging && (
              <div className="drop-overlay">
                <Upload size={32} />
                이미지를 놓아주세요
              </div>
            )}
          </div>
          <div className="export-panel">
            <div>
              <Download size={17} />
              <span>내보내기</span>
            </div>
            <div className="export-actions">
              <label className="transparency-option">
                <input
                  type="checkbox"
                  checked={settings.transparentBackground}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      transparentBackground: e.target.checked,
                    })
                  }
                />
                투명 배경
              </label>
              <div className="export-buttons">
                <button
                  onClick={() =>
                    canvas.current && exportPng(canvas.current, filename)
                  }
                >
                  PNG <Download size={13} />
                </button>
                <button
                  onClick={() =>
                    downloadBlob(
                      new Blob([frame.text], {
                        type: 'text/plain;charset=utf-8',
                      }),
                      `${filename}.txt`,
                    )
                  }
                >
                  TXT <Download size={13} />
                </button>
                <button onClick={() => exportHtml(frame, settings, filename)}>
                  HTML <Download size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
        <details className="mobile-settings" open>
          <summary>변환 설정 열기 / 닫기</summary>
          <Controls
            settings={settings}
            onChange={setSettings}
            onPickColor={() => setEditor('color')}
            onSelectRegion={() => setEditor('lasso')}
          />
        </details>
      </div>
      {editor && (
        <RegionEditor
          source={source.image}
          width={source.width}
          height={source.height}
          mode={editor}
          region={settings.mask.region}
          feather={settings.mask.feather}
          onCancel={() => setEditor(null)}
          onPick={(keyColor) => {
            setSettings((previous) => ({
              ...previous,
              mask: { ...previous.mask, mode: 'color', keyColor },
            }))
            setEditor(null)
            setView('ascii')
          }}
          onApply={(region, feather) => {
            setSettings((previous) => ({
              ...previous,
              mask: { ...previous.mask, mode: 'lasso', region, feather },
            }))
            setEditor(null)
            setView('ascii')
          }}
        />
      )}
      {message && (
        <div className="toast" role="status">
          {message}
          <button
            title="알림 닫기"
            aria-label="알림 닫기"
            onClick={() => setMessage('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
