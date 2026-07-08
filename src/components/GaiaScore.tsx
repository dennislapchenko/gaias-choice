/** Mean of a review's per-criterion scores, rounded — the compact card figure. */
export function scoreAverage(scores: number[]): number {
  if (!scores?.length) return 0
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

/**
 * The Gaia Score breakdown: each rating criterion (from site.yaml) as a vertical
 * fill bar, laid out as one row split into N columns. The fill height tracks the
 * score/5, so a 3/5 bar is 60% full. Criteria and scores align by index; a
 * missing score renders as an empty bar.
 */
export default function GaiaScore({
  title,
  criteria,
  scores,
}: {
  title?: string
  criteria: string[]
  scores: number[]
}) {
  if (!scores?.length || !criteria?.length) return null
  return (
    <div className="gaia-score">
      {title && <span className="gaia-score-title">{title}</span>}
      <ul className="gaia-score-bars">
        {criteria.map((label, i) => {
          const value = scores[i] ?? 0
          const pct = Math.max(0, Math.min(100, (value / 5) * 100))
          return (
            <li key={label} className="gaia-bar" title={`${label}: ${value}/5`}>
              <span className="gaia-bar-crit">{label}</span>
              <span className="gaia-bar-track" aria-hidden="true">
                <span className="gaia-bar-fill" style={{ height: `${pct}%` }} />
                <span className="gaia-bar-value">{value}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
