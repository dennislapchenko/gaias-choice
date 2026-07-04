import { Link } from 'react-router-dom'
import { guides, products, site } from '../lib/content'
import { withBase } from '../lib/asset'
import ProductCard from '../components/ProductCard'
import GuideCard from '../components/GuideCard'

export default function Home() {
  const featuredProducts = products.slice(0, 3)
  const latestGuides = guides.slice(0, 2)

  return (
    <>
      <section className={`hero ${site.heroImage ? 'hero-split' : ''}`}>
        <div className="hero-text">
          <p className="eyebrow">Natural · Plastic-free · Fragrance-free</p>
          <h1>{site.tagline}</h1>
          <p className="lead">{site.description}</p>
          <div className="hero-actions">
            <Link to="/reviews" className="btn btn-primary">
              Browse reviews
            </Link>
            <Link to="/guides" className="btn btn-ghost">
              Read the guides
            </Link>
          </div>
        </div>
        {site.heroImage && (
          <div className="hero-media">
            <img src={withBase(site.heroImage)} alt="" />
          </div>
        )}
      </section>

      <section className="mission-band">
        <p>{site.mission}</p>
      </section>

      <section className="values">
        {site.values.map((v) => (
          <div key={v.title} className="value">
            <h3>{v.title}</h3>
            <p className="muted">{v.text}</p>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Featured reviews</h2>
          <Link to="/reviews" className="link-more">
            All reviews →
          </Link>
        </div>
        <div className="grid grid-3">
          {featuredProducts.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Latest guides</h2>
          <Link to="/guides" className="link-more">
            All guides →
          </Link>
        </div>
        <div className="grid grid-2">
          {latestGuides.map((g) => (
            <GuideCard key={g.slug} guide={g} />
          ))}
        </div>
      </section>
    </>
  )
}
