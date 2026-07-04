import { guides } from '../lib/content'
import GuideCard from '../components/GuideCard'

export default function Guides() {
  return (
    <>
      <header className="page-head">
        <h1>Guides & checklists</h1>
        <p className="lead">
          Practical, printable roundups for packing light, natural, and safe when the whole home
          fits on four wheels.
        </p>
      </header>
      <div className="grid grid-2">
        {guides.map((g) => (
          <GuideCard key={g.slug} guide={g} />
        ))}
      </div>
    </>
  )
}
