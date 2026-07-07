import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  apiPut,
  type AdminUserSummary,
  type AdminUserUpdate,
  type MeResponse,
  type Member,
  type Role,
} from '../lib/api'
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

const ROLES: Role[] = ['admin', 'editor', 'viewer']

// The account page's field-edit panel. Two modes, one component:
//   - self (no `target`): edit your own profile — name, avatar, email,
//     password — PUT /users/me. Role shown read-only.
//   - admin target (`target` set): an admin editing another camper — name,
//     avatar, role (editable), optional password reset — PUT /users/{id}.
//     Never touches the target's email. Mount with key={target.id} so the
//     initial state re-seeds per picked user. Shows a close (×) that calls
//     `onClose`, and reports the fresh row via `onSaved`.
// `open` just adds the CSS hook the mobile breakpoint needs (see
// .account-fields in styles.css); on desktop the rail is always visible. Save
// is always rendered but faded + disabled until a field actually differs.
export default function AccountFields({
  open,
  target,
  onClose,
  onSaved,
}: {
  open: boolean
  target?: Member
  onClose?: () => void
  onSaved?: (u: AdminUserSummary) => void
}) {
  const { t } = useI18n()
  const { me, token, updateMe } = useSession()
  const [name, setName] = useState(target?.displayName ?? me?.displayName ?? '')
  const [email, setEmail] = useState(me?.email ?? '') // self mode only
  const [avatarUrl, setAvatarUrl] = useState(target?.avatarUrl ?? me?.avatarUrl ?? '')
  const [role, setRole] = useState<Role>(target?.role ?? me?.role ?? 'viewer') // target mode only
  const [password, setPassword] = useState('')
  const [baseline, setBaseline] = useState({
    name: target?.displayName ?? me?.displayName ?? '',
    email: me?.email ?? '',
    avatarUrl: target?.avatarUrl ?? me?.avatarUrl ?? '',
    role: target?.role ?? me?.role ?? ('viewer' as Role),
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
    avatarUrl !== baseline.avatarUrl ||
    password !== '' ||
    (target ? role !== baseline.role : email !== baseline.email)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(false)
    try {
      if (target) {
        const body: AdminUserUpdate = { displayName: name, avatarUrl, role }
        if (password) body.password = password
        const updated = await apiPut<AdminUserSummary>(`/users/${target.id}`, body, {
          token: token ?? undefined,
        })
        onSaved?.(updated)
        onClose?.()
      } else {
        const updated = await apiPut<MeResponse>(
          '/users/me',
          { displayName: name, email, avatarUrl, ...(password ? { password } : {}) },
          { token: token ?? undefined },
        )
        updateMe(updated)
        setBaseline({ ...baseline, name, email, avatarUrl })
        setPassword('')
      }
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  // A stored data: URI is an opaque wall of base64 — never show it raw. The
  // preview thumb already proves it's set; the chip clears it (back to a URL
  // field / re-upload).
  const isData = avatarUrl.startsWith('data:')

  return (
    <section
      className={`account-fields${target ? ' account-fields-target' : ''}${open ? ' is-open' : ''}`}
      aria-label={target ? t('account.editUser', { name: target.displayName }) : t('account.fields.title')}
    >
      <div className="side-label-row">
        <p className="side-label">
          {target ? t('account.editUser', { name: target.displayName }) : t('account.fields.title')}
        </p>
        {target && (
          <button
            type="button"
            className="rail-close"
            aria-label={t('account.fields.close')}
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>
      <form onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">{t('account.fields.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          <span className="field-label">{t('account.fields.avatar')}</span>
          <div className="field-split">
            {avatarUrl && <img className="avatar-preview" src={withBase(avatarUrl)} alt="" />}
            {isData ? (
              <button
                type="button"
                className="avatar-datauri"
                title={t('account.fields.uploaded')}
                onClick={() => setAvatarUrl('')}
              >
                {t('account.fields.uploaded')}
              </button>
            ) : (
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder={t('account.fields.avatarPlaceholder')}
              />
            )}
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              {t('account.fields.upload')}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          </div>
        </div>
        <label className="field">
          <span className="field-label">{t('account.fields.role')}</span>
          {target ? (
            <select className="field-select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : (
            <input value={me.role} disabled />
          )}
        </label>
        {!target && (
          <label className="field">
            <span className="field-label">{t('account.fields.email')}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        )}
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
        <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
          {t('account.fields.save')}
        </button>
      </form>
    </section>
  )
}
