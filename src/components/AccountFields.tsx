import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { apiPut, type MeResponse } from '../lib/api'
import { withBase } from '../lib/asset'
import { useI18n } from '../lib/i18n'
import { useSession } from '../lib/session'

// Downscale a picked image file to a small WebP `data:` URI, entirely in the
// browser — no upload endpoint, no blob store. The result is stored verbatim in
// avatar_url, so the avatar survives the source file going away (self-contained,
// not a remote reference). Capped at `max` px on the long edge to keep the data
// URI small enough for the users row / campfire payload (backend caps ~200 KB).
function downscale(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no 2d context'))
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/webp', 0.85))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// The account page's field-edit panel: a right-rail fixture on desktop
// (always visible), or revealed by the `.account-header` title-line toggle on
// mobile — `open` just adds the CSS hook that breakpoint needs (see
// .account-fields in styles.css); the component itself renders identically
// either way. Save only appears once a field actually differs from the
// last-saved values.
export default function AccountFields({ open }: { open: boolean }) {
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
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so re-picking the same file still fires onChange
    if (!file) return
    try {
      setAvatarUrl(await downscale(file, 256))
    } catch {
      setError(true)
    }
  }

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
    <section className={`account-fields${open ? ' is-open' : ''}`} aria-label={t('account.fields.title')}>
      <p className="side-label">{t('account.fields.title')}</p>
      <form onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">{t('account.fields.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          <span className="field-label">{t('account.fields.avatar')}</span>
          <div className="field-split">
            {avatarUrl && <img className="avatar-preview" src={withBase(avatarUrl)} alt="" />}
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder={t('account.fields.avatarPlaceholder')}
            />
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              {t('account.fields.upload')}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          </div>
        </div>
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
