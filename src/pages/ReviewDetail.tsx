import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProduct, getProductFile } from '../lib/content'
import { PageHead } from '../lib/head'
import { useI18n } from '../lib/i18n'
import { withBase } from '../lib/asset'
import { useContentEditor } from '../lib/contentEditor'
import { useEditMode } from '../lib/editMode'
import type { PostState } from '../lib/types'
import Markdown from '../components/Markdown'
import Rating from '../components/Rating'
import EditButton from '../components/EditButton'
import NotFound from './NotFound'

export default function ReviewDetail() {
  const { slug } = useParams()
  const { locale, t } = useI18n()
  const product = slug ? getProduct(locale, slug) : undefined
  const editor = useContentEditor()
  const { active: editModeOn } = useEditMode()
  // Local override so flipping state feels immediate (optimistic UI) — the
  // static content.ts data itself only catches up once the save's git commit
  // deploys, ~2 min later (see contentEditor.tsx).
  const [state, setState] = useState(product?.state)
  useEffect(() => setState(product?.state), [product])
  if (!product) return <NotFound />

  return (
    <article className="detail">
      <PageHead title={product.title} description={product.excerpt} />
      <Link to="/reviews" className="back-link">
        {t('reviewDetail.backLink')}
      </Link>
      <span className="tag">{product.category}</span>
      {state === 'upcoming' && (
        <span className="tag">
          {t('detail.wip')}
          {editModeOn && (
            <EditButton
              className="wip-edit"
              ariaLabel={t('editor.stateAria')}
              onClick={() =>
                editor.openField({
                  title: t('editor.stateTitle'),
                  ref: { file: getProductFile(locale, slug!), path: ['state'] },
                  onSaved: (v) => setState(v as PostState),
                })
              }
            />
          )}
        </span>
      )}
      <h1>{product.title}</h1>
      <div className="detail-meta">
        <Rating value={product.rating} />
        {product.price && <span className="price">{product.price}</span>}
        <span className="muted">{product.date}</span>
      </div>

      {product.image && (
        <img className="detail-image" src={withBase(product.image)} alt={product.title} />
      )}

      <Markdown html={product.html} />

      {product.affiliateUrl && (
        <p className="cta-row">
          <a
            className="btn btn-primary"
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
          >
            {t('reviewDetail.checkPrice')}
          </a>
        </p>
      )}
    </article>
  )
}
