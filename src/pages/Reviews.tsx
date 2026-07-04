import { useMemo, useState } from 'react'
import { products } from '../lib/content'
import ProductCard from '../components/ProductCard'

export default function Reviews() {
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(products.map((p) => p.category))).sort()],
    [],
  )
  const [active, setActive] = useState('All')

  const visible = active === 'All' ? products : products.filter((p) => p.category === active)

  return (
    <>
      <header className="page-head">
        <h1>Reviews</h1>
        <p className="lead">
          Every item here has ridden with us for real miles — tested for materials, safety, and
          how it holds up to life on the road with a baby.
        </p>
      </header>

      <div className="filters" role="tablist" aria-label="Filter by category">
        {categories.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={active === c}
            className={`chip ${active === c ? 'chip-active' : ''}`}
            onClick={() => setActive(c)}
          >
            {c}
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
