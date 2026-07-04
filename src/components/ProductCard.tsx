import { Link } from 'react-router-dom'
import type { Product } from '../lib/types'
import { withBase } from '../lib/asset'
import Rating from './Rating'

export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="card">
      <Link to={`/reviews/${product.slug}`} className="card-media">
        {product.image ? (
          <img src={withBase(product.image)} alt={product.title} loading="lazy" />
        ) : (
          <div className="card-media placeholder" aria-hidden="true">
            🌿
          </div>
        )}
      </Link>
      <div className="card-body">
        <span className="tag">{product.category}</span>
        <h3>
          <Link to={`/reviews/${product.slug}`}>{product.title}</Link>
        </h3>
        <div className="card-meta">
          <Rating value={product.rating} />
          {product.price && <span className="price">{product.price}</span>}
        </div>
        <p className="muted">{product.excerpt}</p>
      </div>
    </article>
  )
}
