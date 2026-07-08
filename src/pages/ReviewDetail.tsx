import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProduct, getProductFile, getSite } from '../lib/content'
import { PageHead } from '../lib/head'
import { useI18n } from '../lib/i18n'
import { withBase } from '../lib/asset'
import { useContentEditor } from '../lib/contentEditor'
import { useEditMode } from '../lib/editMode'
import Markdown from '../components/Markdown'
import GaiaScore from '../components/GaiaScore'
import EditButton from '../components/EditButton'
import StateToggle from '../components/StateToggle'
import DeleteButton from '../components/DeleteButton'
import NotFound from './NotFound'

export default function ReviewDetail() {
  const { slug } = useParams()
  const { locale, t } = useI18n()
  const product = slug ? getProduct(locale, slug) : undefined
  const site = getSite(locale)
  const editor = useContentEditor()
  const { active: editModeOn } = useEditMode()
  // Local override so flipping state feels immediate (optimistic UI) — the
  // static content.ts data itself only catches up once the save's git commit
  // deploys, ~2 min later (see contentEditor.tsx).
  const [state, setState] = useState(product?.state)
  useEffect(() => setState(product?.state), [product])
  if (!product) return <NotFound />

  return (
    <div className="review-layout">
      <PageHead title={product.title} description={product.excerpt} />
      <div className="detail-nav">
        <Link to="/reviews" className="back-link">
          {t('reviewDetail.backLink')}
        </Link>
        <div className="detail-nav-tags">
          <span className="tag">{product.category}</span>
          {state === 'upcoming' && <span className="tag">{t('detail.wip')}</span>}
        </div>
      </div>
      <div className="review-header">
        <div className="review-header-main">
          <h1>{product.title}</h1>
          <div className="detail-meta">
            <span className="muted">{product.date}</span>
            {product.translatedFrom && (
              <span className="muted translated-mark">
                {t(`detail.translatedFrom.${product.translatedFrom}`)}
              </span>
            )}
          </div>
        </div>
        {/* Edit tools ride the title's line on desktop, above it on mobile. */}
        {editModeOn && (
          <div className="detail-nav-tools">
            <StateToggle
              value={state}
              file={getProductFile(locale, slug!)}
              onChanged={(v) => setState(v)}
            />
            <EditButton
              className="detail-edit"
              ariaLabel={t('editor.contentAria')}
              label={t('editor.edit')}
              onClick={() =>
                editor.openFile({ title: t('editor.contentTitle'), path: getProductFile(locale, slug!) })
              }
            />
            <DeleteButton path={getProductFile(locale, slug!)} redirectTo="/reviews" />
          </div>
        )}
      </div>

      <article className="detail review-main">
        {product.image && (
          <img className="detail-image" src={withBase(product.image)} alt={product.title} />
        )}

        <Markdown html={product.html} />
      </article>

      {/* Right rail — facts + the buy action, each fact its own panel card
          (same head+body look as the left Sidebar/TOC). Grows as more get added. */}
      <aside className="review-aside">
        {product.price &&
          (product.boughtAt ? (
            // Two facts, one card split down the middle: price | where we got it.
            <section className="review-panel review-panel-split">
              <div className="review-panel-head">{t('reviewDetail.priceLabel')}</div>
              <div className="review-panel-head">{t('reviewDetail.boughtAtLabel')}</div>
              <div className="review-panel-body">
                <span className="price review-price">{product.price}</span>
              </div>
              <div className="review-panel-body">{product.boughtAt}</div>
            </section>
          ) : (
            <section className="review-panel">
              <div className="review-panel-head">{t('reviewDetail.priceLabel')}</div>
              <div className="review-panel-body">
                <span className="price review-price">{product.price}</span>
              </div>
            </section>
          ))}
        {site.ratingCriteria && (
          <section className="review-panel">
            <div className="review-panel-head">{site.ratingCriteria.title}</div>
            <div className="review-panel-body">
              <GaiaScore criteria={site.ratingCriteria.items} scores={product.scores} />
            </div>
          </section>
        )}
        {product.affiliateUrl && (
          <a
            className="btn btn-primary review-cta"
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
          >
            {t('reviewDetail.checkPrice')}
          </a>
        )}
      </aside>
    </div>
  )
}
