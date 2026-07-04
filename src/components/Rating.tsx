export default function Rating({ value }: { value: number }) {
  const full = Math.round(value)
  return (
    <span className="rating" aria-label={`${value} out of 5`} title={`${value} / 5`}>
      {'★'.repeat(full)}
      <span className="rating-empty">{'★'.repeat(5 - full)}</span>
    </span>
  )
}
