import { ArrowRight, Grid2X2, Image, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import AsciiHeroAnimation from '../components/home/AsciiHeroAnimation'

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero">
        <h1>
          이미지와 영상을
          <br />
          <span>문자로 다시 그리다</span>
        </h1>
        <div className="hero-actions">
          <Link className="button primary" to="/image">
            <Image size={16} /> 이미지 변환 시작
          </Link>
          <Link className="button secondary" to="/video">
            <Video size={17} /> 영상 변환 시작
          </Link>
        </div>
      </section>
      <AsciiHeroAnimation />
      <nav className="feature-links" aria-label="스튜디오 바로가기">
        {[
          { to: '/image', label: '이미지 변환', Icon: Image },
          { to: '/video', label: '영상 변환', Icon: Video },
          { to: '/gallery', label: '갤러리', Icon: Grid2X2 },
        ].map(({ to, label, Icon }) => (
          <Link key={to} to={to}>
            <Icon size={20} />
            <span>{label}</span>
            <ArrowRight size={16} />
          </Link>
        ))}
      </nav>
    </div>
  )
}
