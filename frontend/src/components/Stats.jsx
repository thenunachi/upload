import './Stats.css'

function fmtSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function Stats({ stats }) {
  return (
    <div className="stats">
      <span className="stat">
        <strong>{stats.count}</strong> photo{stats.count !== 1 ? 's' : ''}
      </span>
      {stats.total_size > 0 && (
        <span className="stat stat-size">{fmtSize(stats.total_size)}</span>
      )}
    </div>
  )
}
