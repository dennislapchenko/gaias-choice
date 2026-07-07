import { useState, type FormEvent } from 'react'
import { apiPut, type MeResponse } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useSession } from '../lib/session'

// The account page's field-edit panel, revealed by the cube toggle next to
// the page title (Account.tsx). Save only appears once a field actually
// differs from the last-saved values.
export default function AccountFields() {
  const { t } = useI18n()
  const { me, token, updateMe } = useSession()
  const [name, setName] = useState(me?.displayName ?? '')
  const [email, setEmail] = useState(me?.email ?? '')
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl ?? '')
  const [password, setPassword] = useState('')
  const [baseline, setBaseline] = useState({
    name: me?.displayName ?? '',
    email: me?.email ?? '',
    avatarUrl: me?.avatarUrl ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  if (!me) return null

  const dirty =
    name !== baseline.name ||
    email !== baseline.email ||
    avatarUrl !== baseline.avatarUrl ||
    password !== ''

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(false)
    try {
      const updated = await apiPut<MeResponse>(
        '/users/me',
        { displayName: name, email, avatarUrl, ...(password ? { password } : {}) },
        { token: token ?? undefined },
      )
      updateMe(updated)
      setBaseline({ name, email, avatarUrl })
      setPassword('')
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="account-fields" aria-label={t('account.fields.title')}>
      <p className="side-label">{t('account.fields.title')}</p>
      <form onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">{t('account.fields.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{t('account.fields.avatar')}</span>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder={t('account.fields.avatarPlaceholder')}
          />
        </label>
        <label className="field">
          <span className="field-label">{t('account.fields.role')}</span>
          <input value={me.role} disabled />
        </label>
        <label className="field">
          <span className="field-label">{t('account.fields.email')}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{t('account.fields.password')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('account.fields.passwordPlaceholder')}
          />
        </label>
        {error && <p className="field-error">{t('account.fields.saveError')}</p>}
        {dirty && (
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {t('account.fields.save')}
          </button>
        )}
      </form>
    </section>
  )
}
