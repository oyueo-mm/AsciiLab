import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  Film,
  Pause,
  Play,
  RotateCcw,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import Controls from '../components/ascii/Controls'
import {
  convertSource,
  DEFAULT_VIDEO_SETTINGS,
  drawFrame,
  exportPng,
} from '../utils/ascii'
import type { AsciiFrame, AsciiSettings } from '../utils/ascii'
import { copyFrame } from '../utils/clipboard'
import RegionEditor from '../components/ascii/RegionEditor'
import { DEFAULT_MASK } from '../utils/mask'
import {
  SettingsPanel,
  SettingsPanelToggle,
  useSettingsPanel,
} from '../components/ascii/SettingsPanel'
import PreviewViewport, {
  PreviewZoomControls,
  usePreviewZoom,
} from '../components/ascii/PreviewViewport'

function timeLabel(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  return `${Math.floor(safe / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(safe % 60)
    .toString()
    .padStart(2, '0')}`
}
export default function VideoStudioPage() {
  const [settings, setSettings] = useState<AsciiSettings>({
      ...DEFAULT_VIDEO_SETTINGS,
    }),
    [url, setUrl] = useState(''),
    [name, setName] = useState('')
  const [ready, setReady] = useState(false),
    [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(true),
    [current, setCurrent] = useState(0),
    [duration, setDuration] = useState(0),
    [message, setMessage] = useState(''),
    [picking, setPicking] = useState<HTMLCanvasElement | null>(null),
    [loadError, setLoadError] = useState(false),
    [dragging, setDragging] = useState(false)
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    input = useRef<HTMLInputElement>(null),
    sampler = useRef<HTMLCanvasElement | null>(null)
  const resumeAfterPick = useRef(false)
  const currentFrame = useRef<AsciiFrame | null>(null)
  const [copyFallback, setCopyFallback] = useState<string | null>(null)
  const panel = useSettingsPanel()
  const zoom = usePreviewZoom()
  const [previewSize, setPreviewSize] = useState({ width: 504, height: 280 })
  const lastSize = useRef(previewSize)
  const draw = useCallback(() => {
    const v = video.current,
      c = canvas.current
    if (!v || !c || v.readyState < 2 || !v.videoWidth) return
    sampler.current ||= document.createElement('canvas')
    const frame = convertSource(
      v,
      v.videoWidth,
      v.videoHeight,
      settings,
      sampler.current,
    )
    drawFrame(c, frame, settings)
    currentFrame.current = frame
    if (
      lastSize.current.width !== c.width ||
      lastSize.current.height !== c.height
    ) {
      lastSize.current = { width: c.width, height: c.height }
      setPreviewSize(lastSize.current)
    }
  }, [settings])
  useEffect(() => {
    if (ready) draw()
  }, [ready, draw])
  useEffect(() => {
    if (!ready || !playing) return
    let id = 0,
      last = 0
    const tick = (time: number) => {
      if (time - last >= 1000 / settings.fps && !document.hidden) {
        draw()
        last = time
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [ready, playing, settings.fps, draw])
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )
  const upload = (file?: File) => {
    if (!file) return
    if (
      !file.type.startsWith('video/') &&
      !/\.(mp4|webm|mov|m4v)$/i.test(file.name)
    ) {
      setMessage('MP4, WebM 등 브라우저에서 재생 가능한 영상을 선택해 주세요.')
      return
    }
    video.current?.pause()
    setPlaying(false)
    zoom.fit()
    setReady(false)
    currentFrame.current = null
    setCopyFallback(null)
    setCurrent(0)
    setDuration(0)
    setName(file.name)
    setMessage('')
    setLoadError(false)
    setSettings((previous) => ({ ...previous, mask: { ...DEFAULT_MASK } }))
    setUrl(URL.createObjectURL(file))
  }
  const toggle = async () => {
    if (!video.current || !ready) return
    if (playing) video.current.pause()
    else
      try {
        if (video.current.ended) video.current.currentTime = 0
        await video.current.play()
      } catch {
        setMessage(
          '영상을 재생할 수 없습니다. 다른 코덱의 MP4 또는 WebM을 사용해 주세요.',
        )
      }
  }
  const pickBackground = () => {
    const v = video.current
    if (!v || !ready) return
    resumeAfterPick.current = !v.paused
    v.pause()
    const snapshot = document.createElement('canvas'),
      scale = Math.min(1, 1920 / v.videoWidth)
    snapshot.width = Math.round(v.videoWidth * scale)
    snapshot.height = Math.round(v.videoHeight * scale)
    snapshot
      .getContext('2d')!
      .drawImage(v, 0, 0, snapshot.width, snapshot.height)
    setPicking(snapshot)
  }
  const closePicker = () => {
    setPicking(null)
    if (resumeAfterPick.current)
      void video.current
        ?.play()
        .catch(() => setMessage('재생 버튼을 눌러 영상을 이어서 재생하세요.'))
    resumeAfterPick.current = false
  }
  return (
    <div className="studio-page">
      <div className="page-heading">
        <h1>영상 변환</h1>
        <SettingsPanelToggle {...panel} />
      </div>
      <div className="studio-toolbar">
        <button
          className="button secondary small"
          disabled={!ready}
          onClick={async () => {
            if (!currentFrame.current) return
            const snapshot = currentFrame.current
            try {
              await copyFrame('text', snapshot, settings, canvas.current)
              setMessage('현재 프레임의 텍스트를 복사했습니다.')
            } catch {
              setCopyFallback(snapshot.text)
              setMessage(
                '클립보드 권한을 확인하거나 아래 텍스트를 직접 선택해 복사하세요.',
              )
            }
          }}
        >
          프레임 텍스트 복사
        </button>
        <div className="toolbar-group">
          <button
            className="button primary small"
            onClick={() => input.current?.click()}
          >
            <Upload size={15} /> 영상 업로드
          </button>
          <input
            className="visually-hidden"
            ref={input}
            aria-label="영상 파일 선택"
            type="file"
            accept="video/*"
            onChange={(e) => {
              upload(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button
            className="icon-button"
            aria-label="영상 설정 초기화"
            title="영상 설정 초기화"
            onClick={() => setSettings({ ...DEFAULT_VIDEO_SETTINGS })}
          >
            <RotateCcw size={16} />
          </button>
        </div>
        <button
          className="button secondary small"
          disabled={!ready}
          onClick={() =>
            canvas.current &&
            exportPng(
              canvas.current,
              `${name.replace(/\.[^.]+$/, '')}-frame-${Math.floor(current * 1000)}`,
            )
          }
        >
          <Camera size={15} /> 프레임 PNG 저장
        </button>
      </div>
      {copyFallback !== null && (
        <div className="text-viewport video-text">
          <button
            className="button secondary small"
            onClick={() => setCopyFallback(null)}
          >
            텍스트 닫기
          </button>
          <pre tabIndex={0} aria-label="현재 프레임 텍스트">
            {copyFallback}
          </pre>
        </div>
      )}
      <div
        className={`editor-layout workspace-layout ${panel.open ? '' : 'settings-collapsed'}`}
      >
        <div className="editor-main">
          <div className="preview-header">
            <span>{name || '영상'}</span>
            <PreviewZoomControls zoom={zoom} disabled={!ready} />
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
          </div>
          <div
            className={`preview-stage video-stage ${dragging ? 'is-dragging' : ''} ${settings.transparentBackground ? 'checkerboard' : ''}`}
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
            <video
              ref={video}
              className="source-video"
              src={url || undefined}
              muted={muted}
              playsInline
              preload="auto"
              onLoadedMetadata={() => {
                const d = video.current?.duration || 0
                setDuration(Number.isFinite(d) ? d : 0)
              }}
              onLoadedData={() => {
                setReady(true)
                draw()
              }}
              onTimeUpdate={() => setCurrent(video.current?.currentTime || 0)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onSeeked={draw}
              onError={() => {
                setReady(false)
                setPlaying(false)
                setLoadError(true)
                setMessage(
                  '이 영상의 형식 또는 코덱을 재생할 수 없습니다. H.264 MP4나 VP8/VP9 WebM을 시도해 주세요.',
                )
              }}
            />
            <PreviewViewport
              zoom={zoom}
              width={previewSize.width}
              height={previewSize.height}
              active={ready}
            >
              <canvas
                ref={canvas}
                className={`ascii-canvas ${!ready ? 'hidden-preview' : ''}`}
                aria-label="실시간 ASCII 영상 프리뷰"
                role="img"
              />
            </PreviewViewport>
            {!ready && (
              <button
                className="video-empty"
                onClick={() => input.current?.click()}
              >
                <span className="upload-symbol">
                  <Film size={34} strokeWidth={1} />
                </span>
                <span>
                  {loadError
                    ? '다른 영상 선택'
                    : url
                      ? '불러오는 중…'
                      : '영상 선택'}
                </span>
              </button>
            )}
            {dragging && (
              <div className="drop-overlay">
                <Upload size={32} />
                영상을 놓아주세요
              </div>
            )}
          </div>
          <div className="timeline">
            <button
              className="play-button"
              aria-label={playing ? '영상 일시정지' : '영상 재생'}
              title={playing ? '영상 일시정지' : '영상 재생'}
              disabled={!ready}
              onClick={toggle}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <span className="time-label">{timeLabel(current)}</span>
            <input
              aria-label="영상 타임라인"
              type="range"
              min={0}
              max={duration || 1}
              step={0.01}
              value={current}
              disabled={!ready || !duration}
              onChange={(e) => {
                const time = Number(e.target.value)
                if (video.current) video.current.currentTime = time
                setCurrent(time)
              }}
            />
            <span className="time-label duration">{timeLabel(duration)}</span>
            <button
              className="icon-button"
              aria-label={muted ? '음소거 해제' : '음소거'}
              title={muted ? '음소거 해제' : '음소거'}
              onClick={() => setMuted(!muted)}
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
          </div>
        </div>
        <SettingsPanel open={panel.open}>
          <Controls
            settings={settings}
            onChange={setSettings}
            video
            onPickColor={pickBackground}
            disabled={!ready}
          />
        </SettingsPanel>
      </div>
      {picking && (
        <RegionEditor
          source={picking}
          width={picking.width}
          height={picking.height}
          mode="color"
          feather={settings.mask.feather}
          onCancel={closePicker}
          onPick={(keyColor) => {
            setSettings((previous) => ({
              ...previous,
              mask: { ...previous.mask, mode: 'color', keyColor },
            }))
            closePicker()
          }}
          onApply={() => {}}
        />
      )}
      {message && (
        <div className="toast" role="alert">
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
