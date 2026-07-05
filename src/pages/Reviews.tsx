import { useMemo, useState } from 'react'
import { getProducts } from '../lib/content'
import { useI18n } from '../lib/i18n'
import ProductCard from '../components/ProductCard'

const ALL = 'All'

export default function Reviews() {
  const { locale, t } = useI18n()
  const products = getProducts(locale)
  const categories = useMemo(
    () => [ALL, ...Array.from(new Set(products.map((p) => p.category))).sort()],
    [products],
  )
  const [active, setActive] = useState(ALL)

  const visible = active === ALL ? products : products.filter((p) => p.category === active)

  return (
    <>
      <header className="page-head">
        <h1>{t('reviews.title')}</h1>
        <p className="lead">{t('reviews.lead')}</p>
      </header>

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
    </>
  )
}
