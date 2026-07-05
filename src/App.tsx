import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Reviews from './pages/Reviews'
import ReviewDetail from './pages/ReviewDetail'
import Guides from './pages/Guides'
import GuideDetail from './pages/GuideDetail'
import MarkdownPage from './pages/MarkdownPage'
import Support from './pages/Support'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/reviews/:slug" element={<ReviewDetail />} />
        <Route path="/guides" element={<Guides />} />
        <Route path="/guides/:slug" element={<GuideDetail />} />
        <Route path="/about" element={<MarkdownPage slug="about" />} />
        <Route path="/contact" element={<MarkdownPage slug="contact" />} />
        <Route path="/roadmap" element={<MarkdownPage slug="roadmap" />} />
        <Route path="/disclosure" element={<MarkdownPage slug="disclosure" />} />
        <Route path="/privacy" element={<MarkdownPage slug="privacy" />} />
        <Route path="/support" element={<Support />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
