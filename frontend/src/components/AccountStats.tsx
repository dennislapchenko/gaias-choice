import { useEffect, useState } from 'react'
import { apiGet, type PathHits, type StatsRange, type StatsResponse } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useSession } from '../lib/session'

const RANGES: StatsRange[] = ['today', '7d', '30d']

// The campfire's Статистика view: frontend + API hit tables for a picked
// window, straight from GET /api/stats. The toggle that opens this is
// admin-only and the endpoint itself is admin-scoped, so anyone else just
// sees the unavailable line.
export default function AccountStats() {
  const { t } = useI18n()
  const { token } = useSession()
  const [range, setRange] = useState<StatsRange>('7d')
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!token) return
    let alive = true
    setFailed(false)
    apiGet<StatsResponse>(`/stats?range=${range}`, { token })
      .then((res) => alive && setStats(res))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [token, range])

  return (
    <div className="account-stats">
      <div className="stats-ranges" role="group" aria-label={t('account.stats.rangeAriaLabel')}>
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            className={`chip${range === r ? ' chip-active' : ''}`}
            aria-pressed={range === r}
            onClick={() => setRange(r)}
          >
            {t(`account.stats.${r}`)}
          </button>
        ))}
      </div>

      {failed ? (
        <p className="muted">{t('account.stats.error')}</p>
      ) : stats ? (
        <>
          <Section label={t('account.stats.frontend')} rows={stats.pages} />
          <Section label={t('account.stats.api')} rows={stats.api} />
        </>
      ) : null}
    </div>
  )
}

function Section({ label, rows }: { label: string; rows: PathHits[] }) {
  const { t } = useI18n()
  return (
    <details className="stats-section" open>
      <summary>{label}</summary>
      {rows.length === 0 ? (
        <p className="muted stats-empty">{t('account.stats.empty')}</p>
      ) : (
        <table className="stats-table">
          <thead>
            <tr>
              <th>{t('account.stats.path')}</th>
              <th>{t('account.stats.hits')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.path}>
                <td>{r.path}</td>
                <td>{r.hits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  )
}
