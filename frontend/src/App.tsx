import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import StatusPill from './components/StatusPill'
import { ContentEditorProvider } from './lib/contentEditor'
import { EditModeProvider } from './lib/editMode'
import { SessionProvider } from './lib/session'
import Home from './pages/Home'
import Reviews from './pages/Reviews'
import ReviewDetail from './pages/ReviewDetail'
import Compass from './pages/Compass'
import Journal from './pages/Journal'
import EntryDetail from './pages/EntryDetail'
import MarkdownPage from './pages/MarkdownPage'
import Support from './pages/Support'
import NotFound from './pages/NotFound'

// Lazy: the signed-in "campfire" page (profile fields, member list) is not
// part of the reader path — it loads on first navigation to /account.
const Account = lazy(() => import('./pages/Account'))

export default function App() {
  return (
    <SessionProvider>
      <EditModeProvider>
        <ContentEditorProvider>
          <Layout>
            {/* One boundary for the lazy routes (just /account today). */}
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Home />} />
                {/* Magic-link landing: emailed links point here so sign-ins
                    count as /magic in analytics, not as /. Home is reused —
                    session.tsx consumes the #magic= hash on any path and
                    navigates to /account on success, same UX as before. */}
                <Route path="/magic" element={<Home />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/reviews/:slug" element={<ReviewDetail />} />
                <Route path="/journal" element={<Journal />} />
                <Route path="/journal/:slug" element={<EntryDetail kind="journal" />} />
                <Route path="/compass" element={<Compass />} />
                {/* Splat, not :slug — a Compass slug carries its epic folder
                    (`/compass/herbalism/02-…`), so it spans a path separator. */}
                <Route path="/compass/*" element={<EntryDetail kind="compass" />} />
                <Route path="/about" element={<MarkdownPage slug="about" />} />
                <Route path="/contact" element={<MarkdownPage slug="contact" />} />
                <Route path="/roadmap" element={<MarkdownPage slug="roadmap" />} />
                <Route path="/disclosure" element={<MarkdownPage slug="disclosure" />} />
                <Route path="/privacy" element={<MarkdownPage slug="privacy" />} />
                <Route path="/support" element={<Support />} />
                <Route path="/account" element={<Account />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Layout>
          <StatusPill />
        </ContentEditorProvider>
      </EditModeProvider>
    </SessionProvider>
  )
}
