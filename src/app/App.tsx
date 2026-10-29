import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation, Link } from 'react-router-dom'
import {
  Braces,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Home,
  Image,
  Menu,
  Video,
  X,
} from 'lucide-react'
import HomePage from '../pages/HomePage'
import ImageStudioPage from '../pages/ImageStudioPage'
import VideoStudioPage from '../pages/VideoStudioPage'
import GalleryPage from '../pages/GalleryPage'

const navigation = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/image', label: 'Image', Icon: Image },
  { to: '/video', label: 'Video', Icon: Video },
  { to: '/gallery', label: 'Gallery', Icon: Grid2X2 },
]
export default function App() {
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false)
  const location = useLocation()
  useEffect(() => {
    setMobile(false)
    window.scrollTo(0, 0)
    document.title = `AsciiLab — ${navigation.find((n) => n.to === location.pathname)?.label || 'Studio'}`
  }, [location.pathname])
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobile(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])
  const collapseLabel = collapsed ? '사이드바 펼치기' : '사이드바 접기'
  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        본문으로 이동
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="메뉴 닫기"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        id="sidebar"
        className={`sidebar ${mobile ? 'mobile-open' : ''}`}
        aria-label="주 메뉴"
      >
        <Link to="/" className="brand" aria-label="AsciiLab 홈">
          <Braces size={28} />
          <span>
            ASCII<span className="brand-light">LAB</span>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          title="메뉴 닫기"
          aria-label="메뉴 닫기"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <nav>
          {navigation.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={label}
              aria-label={label}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          className="collapse-button icon-button"
          onClick={() => setCollapsed(!collapsed)}
          title={collapseLabel}
          aria-label={collapseLabel}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </aside>
      <div className="main-shell">
        <header className="mobile-bar">
          <button
            className="icon-button"
            aria-label="메뉴 열기"
            title="메뉴 열기"
            aria-expanded={mobile}
            aria-controls="sidebar"
            onClick={() => setMobile(true)}
          >
            <Menu size={21} />
          </button>
        </header>
        <main id="main" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/image" element={<ImageStudioPage />} />
            <Route path="/video" element={<VideoStudioPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>페이지를 찾을 수 없습니다.</h1>
                  <Link to="/">홈으로 돌아가기 →</Link>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}
