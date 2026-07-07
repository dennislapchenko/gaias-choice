import Rating from './Rating'

/** Mean of a review's per-criterion scores, rounded — the compact card figure. */
export function scoreAverage(scores: number[]): number {
  if (!scores?.length) return 0
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

/**
 * The Gaia Score breakdown: each rating criterion (from site.yaml) with its own
 * star row. Replaces the single star rating on a review's detail page. Criteria
 * and scores align by index; a missing score renders as empty stars.
 */
export default function GaiaScore({
  title,
  criteria,
  scores,
}: {
  title: string
  criteria: string[]
  scores: number[]
}) {
  if (!scores?.length || !criteria?.length) return null
  return (
    <div className="gaia-score">
      <span className="gaia-score-title">{title}</span>
      <ul className="gaia-score-list">
        {criteria.map((label, i) => (
          <li key={label}>
            <span className="gaia-score-crit">{label}</span>
            <Rating value={scores[i] ?? 0} />
          </li>
        ))}
      </ul>
    </div>
  )
}
