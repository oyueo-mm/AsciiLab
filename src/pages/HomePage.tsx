import { ArrowDown, ArrowRight, ArrowUpRight, Image, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import AsciiHeroAnimation from '../components/home/AsciiHeroAnimation'

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-eyebrow">
          <span className="tiny-cross">+</span> A NEW WAY TO SEE{' '}
          <span className="eyebrow-line" /> ASCII ART STUDIO
        </div>
        <h1>
          이미지와 영상을
          <br />
          <span>문자로 다시 그리다</span>
          <span className="title-pixel">▪</span>
        </h1>
        <p className="hero-description">
          픽셀에서 문자로, 장면에서 작품으로.
          <br />
          이미지와 영상을 나만의 ASCII 아트로 만드는 웹 스튜디오.
        </p>
        <div className="hero-actions">
          <Link className="button primary" to="/image">
            <Image size={16} /> 이미지 변환 시작 <ArrowUpRight size={16} />
          </Link>
          <Link className="button secondary" to="/video">
            <Video size={17} /> 영상 변환 시작 <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="hero-footnote">
          NO INSTALLATION <span>·</span> NO UPLOAD TO SERVER <span>·</span> JUST
          CREATE
        </div>
      </section>
      <AsciiHeroAnimation />
      <section className="explore-section">
        <div className="section-intro">
          <span className="eyebrow">YOUR NEXT EXPERIMENT</span>
          <h2>같은 장면, 새로운 언어.</h2>
          <ArrowDown size={20} />
        </div>
        <div className="feature-links">
          <Link to="/image">
            <span className="feature-number">01 / STILL IMAGE</span>
            <div>
              <Image size={23} />
              <ArrowUpRight size={20} />
            </div>
            <h3>
              한 장의 이미지.
              <br />
              수천 개의 문자.
            </h3>
            <p>
              밀도, 명암, 색상을 조절하고
              <br />
              PNG, TXT, HTML로 간직하세요.
            </p>
            <span className="feature-cta">
              Image Studio <ArrowRight size={15} />
            </span>
          </Link>
          <Link to="/video">
            <span className="feature-number">02 / MOVING IMAGE</span>
            <div>
              <Video size={23} />
              <ArrowUpRight size={20} />
            </div>
            <h3>
              움직임을 담은
              <br />
              문자들의 시퀀스.
            </h3>
            <p>
              영상의 매 프레임을 실시간으로.
              <br />
              문자로 흐르는 새로운 장면을 만나세요.
            </p>
            <span className="feature-cta">
              Video Studio <ArrowRight size={15} />
            </span>
          </Link>
          <Link to="/gallery" className="gallery-feature">
            <span className="feature-number">03 / YOUR COLLECTION</span>
            <div
              className="mini-ascii"
              aria-hidden="true"
            >{`  . : + * + : .\n : + # @ # + :\n + # @ @ @ # +\n : + # @ # + :\n  . : + * + : .`}</div>
            <h3>
              당신의 실험을
              <br />
              모아두는 공간.
            </h3>
            <p>
              작품과 편집 설정을 브라우저에 저장하고
              <br />
              언제든 이어서 작업하세요.
            </p>
            <span className="feature-cta">
              Local Gallery <ArrowRight size={15} />
            </span>
          </Link>
        </div>
      </section>
      <footer className="footer">
        <span>© {new Date().getFullYear()} ASCII LAB</span>
        <span>MADE OF CHARACTERS. MADE FOR CREATORS.</span>
        <a
          href="https://github.com/oyueo-mm/AsciiLab"
          target="_blank"
          rel="noreferrer"
        >
          SOURCE CODE <ArrowUpRight size={12} />
        </a>
      </footer>
    </div>
  )
}
