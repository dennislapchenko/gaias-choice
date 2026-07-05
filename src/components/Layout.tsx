import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { site } from '../lib/content'
import ThemeSwitcher from './ThemeSwitcher'
import Sidebar from './Sidebar'

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()

  // Scroll to top on client-side navigation.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              🌿
            </span>
            <span className="brand-name">{site.name}</span>
          </Link>
          <div className="header-right">
            <nav className="site-nav" aria-label="Primary">
              {site.nav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="site-main">
        <div className="container layout-grid">
          <Sidebar />
          <div className="content">{children}</div>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <div className="brand-name">{site.name}</div>
            <p className="muted">{site.tagline}</p>
          </div>
          <div className="footer-links">
            {(site.footerNav ?? []).map((item) => (
              <Link key={item.path} to={item.path}>
                {item.label}
              </Link>
            ))}
            {site.social.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            ))}
            <a href={`mailto:${site.contactEmail}`}>Email</a>
          </div>
        </div>
        <div className="container disclosure muted">
          <p>
            Some links are affiliate links. If you buy through them we may earn a small
            commission at no extra cost to you. We only recommend gear we have actually
            used. <Link to="/disclosure">Full disclosure</Link>.
          </p>
          <p>© {new Date().getFullYear()} {site.name}.</p>
        </div>
      </footer>
    </div>
  )
}
