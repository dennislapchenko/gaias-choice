import { Link } from 'react-router-dom'
import type { Product } from '../lib/types'
import { withBase } from '../lib/asset'
import Rating from './Rating'
import { scoreAverage } from './GaiaScore'

export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="card">
      <div className="card-media">
        {product.image ? (
          <img src={withBase(product.image)} alt={product.title} loading="lazy" />
        ) : (
          <div className="card-media placeholder" aria-hidden="true">
            🌿
          </div>
        )}
      </div>
      <div className="card-body">
        <Link
          to={`/reviews?category=${encodeURIComponent(product.category)}`}
          className="tag"
        >
          {product.category}
        </Link>
        <h3>
          <Link to={`/reviews/${product.slug}`} className="card-link">
            {product.title}
          </Link>
        </h3>
        <div className="card-meta">
          <Rating value={scoreAverage(product.scores)} />
          {product.price && <span className="price">{product.price}</span>}
        </div>
        <p className="muted">{product.excerpt}</p>
      </div>
    </article>
  )
}
