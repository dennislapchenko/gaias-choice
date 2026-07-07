import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getProducts, getReviewTemplate, getUpcomingProducts } from '../lib/content'
import { usePageHead } from '../lib/head'
import { useI18n } from '../lib/i18n'
import ProductCard from '../components/ProductCard'
import Upcoming from '../components/Upcoming'

const ALL = 'All'

export default function Reviews() {
  const { locale, t } = useI18n()
  usePageHead(t('reviews.title'), t('reviews.lead'))
  const products = getProducts(locale) // active only; WIP posts feed the rail below
  const upcoming = getUpcomingProducts(locale)
  const categories = useMemo(
    () => [ALL, ...Array.from(new Set(products.map((p) => p.category))).sort()],
    [products],
  )

  // The active category lives in the URL (`?category=`) so a category tag on any
  // card — here or on the Home page — can link straight to a filtered view.
  const [params, setParams] = useSearchParams()
  const requested = params.get('category')
  const active = requested && categories.includes(requested) ? requested : ALL
  const setActive = (c: string) =>
    setParams(c === ALL ? {} : { category: c }, { replace: true })

  const visible = active === ALL ? products : products.filter((p) => p.category === active)

  return (
    <>
      <header className="page-head">
        <h1>{t('reviews.title')}</h1>
        <p className="lead">{t('reviews.lead')}</p>
      </header>

      <div className="reviews-layout">
        <div className="reviews-main">
          <div className="filters" role="tablist" aria-label={t('reviews.filterAriaLabel')}>
            {categories.map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={active === c}
                className={`chip ${active === c ? 'chip-active' : ''}`}
                onClick={() => setActive(c)}
              >
                {c === ALL ? t('reviews.allCategory') : c}
              </button>
            ))}
          </div>

          <div className="grid grid-3">
            {visible.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>

        <Upcoming
          title={t('reviews.upcomingTitle')}
          note={t('reviews.upcomingNote')}
          items={upcoming}
          contribute={{ value: getReviewTemplate(locale), label: t('reviews.templateBtn') }}
          draft={{ dir: 'products', detailBase: '/reviews' }}
        />
      </div>
    </>
  )
}
