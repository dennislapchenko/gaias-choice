import { Link, useParams } from 'react-router-dom'
import { getProduct } from '../lib/content'
import { withBase } from '../lib/asset'
import Markdown from '../components/Markdown'
import Rating from '../components/Rating'
import NotFound from './NotFound'

export default function ReviewDetail() {
  const { slug } = useParams()
  const product = slug ? getProduct(slug) : undefined
  if (!product) return <NotFound />

  return (
    <article className="detail">
      <Link to="/reviews" className="back-link">
        ← All reviews
      </Link>
      <span className="tag">{product.category}</span>
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
            Check current price →
          </a>
        </p>
      )}
    </article>
  )
}
