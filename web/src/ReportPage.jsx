import { useEffect, useState } from 'react'

// --- Request helper ---

// Fetches JSON from the API and throws a readable error when the response is not ok.
async function fetchJson(path, signal) {
  const response = await fetch(`/api${path}`, { signal })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed (${response.status}).`)
  }

  return data
}

// --- Highlight report page ---

// Shows how many highlights and verses the signed-in user has per book and color.
function ReportPage({ account, onRequestLogin }) {
  const [rows, setRows] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const userId = account?.id

  useEffect(() => {
    if (userId === undefined) {
      return undefined
    }

    const controller = new AbortController()

    // Loads the report rows for the signed-in user.
    async function loadReport() {
      setRows(null)
      setErrorMessage('')

      try {
        const data = await fetchJson(`/highlights/user/${userId}/report`, controller.signal)

        setRows(data.report)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setErrorMessage(error.message)
        }
      }
    }

    loadReport()

    return () => controller.abort()
  }, [userId])

  return (
    <section className="reader reader-wide" aria-labelledby="report-title">
      <div className="reader-intro">
        <h1 id="report-title">Highlight report</h1>
      </div>

      {!account && (
        <p className="reading-status">
          <button className="highlight-save-button" type="button" onClick={onRequestLogin}>
            Log in
          </button>{' '}
          to see your highlight report.
        </p>
      )}

      {errorMessage && (
        <p className="reading-status error-message" role="alert">{errorMessage}</p>
      )}

      {account && !errorMessage && rows === null && (
        <p className="reading-status" role="status">Loading report…</p>
      )}

      {account && rows && rows.length === 0 && (
        <p className="reading-status">You have no highlights yet.</p>
      )}

      {account && rows && rows.length > 0 && (
        <div className="table-wrapper" role="region" aria-labelledby="report-caption" tabIndex={0}>
          <table className="report-table">
            <caption id="report-caption">Highlights and verses by book and color</caption>
            <thead>
              <tr>
                <th scope="col">Book</th>
                <th scope="col">Color</th>
                <th scope="col">Highlights</th>
                <th scope="col">Verses</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.book}-${row.color}`}>
                  <th scope="row">{row.book}</th>
                  <td>
                    <span
                      className="report-color"
                      style={{ backgroundColor: row.color.startsWith('#') ? row.color : `#${row.color}` }}
                    >
                      {row.color}
                    </span>
                  </td>
                  <td>{row.highlight_count}</td>
                  <td>{row.verse_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default ReportPage
