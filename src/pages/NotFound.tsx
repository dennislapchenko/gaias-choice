import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="detail center">
      <h1>Not found</h1>
      <p className="muted">This trail doesn't lead anywhere yet.</p>
      <Link to="/" className="btn btn-primary">
        Back home
      </Link>
    </div>
  )
}
