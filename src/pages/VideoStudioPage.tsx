import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  Check,
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
  DEFAULT_SETTINGS,
  drawFrame,
  exportPng,
} from '../utils/ascii'
import type { AsciiSettings } from '../utils/ascii'

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
      ...DEFAULT_SETTINGS,
      columns: 100,
    }),
    [url, setUrl] = useState(''),
    [name, setName] = useState('')
  const [ready, setReady] = useState(false),
    [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(true),
    [current, setCurrent] = useState(0),
    [duration, setDuration] = useState(0),
    [message, setMessage] = useState(''),
    [dimensions, setDimensions] = useState({ columns: 0, rows: 0 }),
    [dragging, setDragging] = useState(false)
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    input = useRef<HTMLInputElement>(null),
    sampler = useRef<HTMLCanvasElement | null>(null)
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
    setDimensions((previous) =>
      previous.columns === frame.columns && previous.rows === frame.rows
        ? previous
        : { columns: frame.columns, rows: frame.rows },
    )
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
    setReady(false)
    setCurrent(0)
    setDuration(0)
    setName(file.name)
    setMessage('')
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
  return (
    <div className="studio-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MOVING IMAGE → ASCII</span>
          <h1>
            Video Studio<span>.</span>
          </h1>
          <p>매 프레임이 문자가 되는 순간. 움직임을 새롭게 그려보세요.</p>
        </div>
        <span className="page-index">STUDIO / 02</span>
      </div>
      <div className="studio-toolbar">
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
            onClick={() => setSettings({ ...DEFAULT_SETTINGS, columns: 100 })}
          >
            <RotateCcw size={16} />
          </button>
        </div>
        <span className="toolbar-label">REAL-TIME ASCII PREVIEW</span>
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
      <div className="editor-layout">
        <div className="editor-main">
          <div className="preview-header">
            <span>
              <i className={`status-dot ${!ready ? 'inactive' : ''}`} />
              {name || '아직 선택된 영상이 없습니다'}
            </span>
            <span>
              {ready
                ? `${video.current?.videoWidth} × ${video.current?.videoHeight} PX`
                : 'MP4 / WEBM / MOV'}
            </span>
          </div>
          <div
            className={`preview-stage video-stage ${dragging ? 'is-dragging' : ''}`}
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
                setMessage(
                  '이 영상의 형식 또는 코덱을 재생할 수 없습니다. H.264 MP4나 VP8/VP9 WebM을 시도해 주세요.',
                )
              }}
            />
            <canvas
              ref={canvas}
              className={`ascii-canvas ${!ready ? 'hidden-preview' : ''}`}
              aria-label="실시간 ASCII 영상 프리뷰"
              role="img"
            />
            {!ready && (
              <button
                className="video-empty"
                onClick={() => input.current?.click()}
              >
                <span className="upload-symbol">
                  <Film size={34} strokeWidth={1} />
                </span>
                <h2>
                  {url ? '영상을 불러오는 중' : '움직임을 문자로 옮겨보세요'}
                </h2>
                <p>영상을 끌어놓거나 클릭해서 선택하세요.</p>
                <span>MP4, WEBM 등 브라우저 지원 형식 · 서버 업로드 없음</span>
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
              onClick={() => setMuted(!muted)}
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
          </div>
          <div className="preview-status">
            <span>
              {ready
                ? `${dimensions.columns} COL × ${dimensions.rows} ROW / ${settings.fps} FPS LIMIT`
                : 'WAITING FOR YOUR FOOTAGE'}
            </span>
            <span>
              <Check size={12} />{' '}
              {playing ? '재생 중' : ready ? '일시정지' : '로컬 프리뷰'}
            </span>
          </div>
          <div className="video-note">
            <Film size={18} />
            <div>
              <strong>빠르게 실험하고, 원하는 순간을 저장하세요.</strong>
              <p>
                프리뷰는 설정한 FPS로 변환됩니다. 긴 영상도 전체 변환을 기다릴
                필요가 없습니다.
                <br />
                현재 프레임은 PNG로 저장할 수 있으며, 영상 전체 내보내기는
                지원하지 않습니다.
              </p>
            </div>
          </div>
        </div>
        <details className="mobile-settings" open>
          <summary>변환 설정 열기 / 닫기</summary>
          <Controls settings={settings} onChange={setSettings} video />
        </details>
      </div>
      {message && (
        <div className="toast" role="alert">
          {message}
          <button aria-label="알림 닫기" onClick={() => setMessage('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
