import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation, Link } from 'react-router-dom'
import {
  ArrowUpRight,
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
  { to: '/', label: 'Home', number: '01', Icon: Home },
  { to: '/image', label: 'Image', number: '02', Icon: Image },
  { to: '/video', label: 'Video', number: '03', Icon: Video },
  { to: '/gallery', label: 'Gallery', number: '04', Icon: Grid2X2 },
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
  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <a className="skip-link" href="#main">
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
        className={`sidebar ${mobile ? 'mobile-open' : ''}`}
        aria-label="주 메뉴"
      >
        <Link to="/" className="brand" aria-label="AsciiLab 홈">
          <Braces size={28} />
          <span>
            ASCII<span className="brand-light">LAB</span>
            <sup>®</sup>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="메뉴 닫기"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <div className="nav-caption">YOUR CREATIVE WORKSPACE</div>
        <nav>
          {navigation.map(({ to, label, number, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} title={label}>
              <Icon size={18} />
              <span>{label}</span>
              <small>{number}</small>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="status-dot" /> LOCAL. PRIVATE. YOURS.
            <p>
              당신의 파일은
              <br />
              브라우저 안에 머뭅니다.
            </p>
          </div>
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            <span>접기</span>
          </button>
          <span className="version">ASCII LAB / V.1.0</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="메뉴 열기"
            onClick={() => setMobile(true)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            WORKSPACE <span>/</span>{' '}
            <strong>
              {navigation.find((n) => n.to === location.pathname)?.label ||
                '404'}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="browser-badge">
              <i className="status-dot" /> BROWSER-BASED STUDIO
            </span>
            <a
              href="https://github.com/oyueo-mm/AsciiLab"
              target="_blank"
              rel="noreferrer"
            >
              GitHub <ArrowUpRight size={13} />
            </a>
          </div>
        </header>
        <main id="main">
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
