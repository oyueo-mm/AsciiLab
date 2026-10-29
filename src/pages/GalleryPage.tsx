import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Grid2X2, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { deleteArtwork, listArtworks } from '../utils/storage'
import type { Artwork } from '../utils/storage'

function GalleryCard({
  art,
  onDelete,
}: {
  art: Artwork
  onDelete: (id: string) => void
}) {
  const [url, setUrl] = useState(''),
    [confirm, setConfirm] = useState(false)
  useEffect(() => {
    const objectUrl = URL.createObjectURL(art.thumbnail)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [art.thumbnail])
  return (
    <article className="gallery-card">
      <Link to={`/image?id=${art.id}`} className="gallery-image">
        <img src={url} alt={`${art.name} ASCII 작품`} />
        <span>
          스튜디오에서 열기 <ArrowUpRight size={16} />
        </span>
      </Link>
      <div className="gallery-card-info">
        <div>
          <Link to={`/image?id=${art.id}`}>
            <h2>{art.name}</h2>
          </Link>
          <p>
            {new Date(art.created).toLocaleDateString('ko-KR')}
            <span>·</span>
            {art.settings.columns} COL<span>·</span>
            {art.settings.charset}
          </p>
        </div>
        <button
          className="icon-button delete-button"
          aria-label={`${art.name} 삭제`}
          onClick={() => setConfirm(!confirm)}
        >
          <Trash2 size={15} />
        </button>
      </div>
      {confirm && (
        <div className="delete-confirm">
          <p>이 작품을 갤러리에서 삭제할까요?</p>
          <button
            className="button secondary small"
            onClick={() => setConfirm(false)}
          >
            취소
          </button>
          <button
            className="button danger small"
            onClick={() => onDelete(art.id)}
          >
            삭제
          </button>
        </div>
      )}
    </article>
  )
}
export default function GalleryPage() {
  const [artworks, setArtworks] = useState<Artwork[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    listArtworks()
      .then((items) => {
        if (active) setArtworks(items.sort((a, b) => b.created - a.created))
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  const remove = async (id: string) => {
    try {
      await deleteArtwork(id)
      setArtworks((items) => items.filter((a) => a.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <div className="gallery-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR LOCAL COLLECTION</span>
          <h1>
            Gallery<span>.</span>
          </h1>
          <p>문자로 남긴 순간들. 당신의 실험을 이어가세요.</p>
        </div>
        <Link to="/image" className="button primary small">
          <Plus size={16} /> 새 작품 만들기
        </Link>
      </div>
      <div className="gallery-toolbar">
        <span>
          <Grid2X2 size={15} /> 저장된 작품{' '}
          <b>{artworks.length.toString().padStart(2, '0')}</b>
        </span>
        <span>
          <i className="status-dot" /> THIS BROWSER ONLY
        </span>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {loading ? (
        <div className="empty-state">컬렉션을 불러오는 중…</div>
      ) : artworks.length ? (
        <div className="gallery-grid">
          {artworks.map((art) => (
            <GalleryCard key={art.id} art={art} onDelete={remove} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div
            className="empty-ascii"
            aria-hidden="true"
          >{`+ - - - - - - - +\n|               |\n|    @ # + :    |\n|    : + # @    |\n|               |\n+ - - - - - - - +`}</div>
          <h2>첫 번째 실험을 기다리고 있어요.</h2>
          <p>
            Image Studio에서 작품을 만들고 ‘갤러리에 저장’을 눌러보세요.
            <br />
            원본과 설정을 함께 보관해 언제든 다시 편집할 수 있습니다.
          </p>
          <Link className="button primary" to="/image">
            이미지로 시작하기 <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <p className="gallery-storage-note">
        작품은 이 기기의 브라우저 저장소에 보관됩니다. 브라우저 데이터를 지우면
        삭제되므로, 소중한 작품은 파일로도 내보내 주세요.
      </p>
    </div>
  )
}
