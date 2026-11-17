/**
 * Small inline loading spinner. Size in pixels, color defaults to
 * LinkedIn blue but can be overridden with a className.
 */
function Spinner({ size = 20, className = '' }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  )
}

export default Spinner
