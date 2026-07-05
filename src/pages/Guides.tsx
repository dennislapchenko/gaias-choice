import { guides } from '../lib/content'
import GuideCard from '../components/GuideCard'

export default function Guides() {
  return (
    <>
      <header className="page-head">
        <h1>Guides & checklists</h1>
        <p className="lead">
          Right now: our founder guides — the honest playbook we're following to build this
          site, in public. Reader-facing guides will replace them as we earn the experience.
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
