import { Fragment, useEffect, useState } from 'react'
import {
  formatSavedItemDate,
  formatVerseNumbers,
  groupAdjacentVerses,
  normalizeSavedItemTimestamp,
} from './verseUtils.js'

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

// --- Preview helpers ---

// Builds the lookup key shared by a report row and its highlighted verses.
function makeGroupKey(book, color) {
  return `${book}|${color}`
}

// Groups the user's highlighted verses by book and color, then by highlight, so each report row lists its own highlights together.
function groupVersesByBookAndColor(highlights) {
  const groups = {}

  for (const verse of highlights) {
    const key = makeGroupKey(verse.book, verse.color)

    groups[key] = groups[key] ?? new Map()

    const highlightVerses = groups[key].get(verse.highlightId) ?? []

    highlightVerses.push(verse)
    groups[key].set(verse.highlightId, highlightVerses)
  }

  return groups
}

// --- Highlight report page ---

// Shows how many highlights and verses the signed-in user has per book and color.
function ReportPage({ account, onRequestLogin }) {
  const [rows, setRows] = useState(null)
  const [versesByGroup, setVersesByGroup] = useState({})
  const [expandedGroups, setExpandedGroups] = useState(new Set())
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
        const [reportData, highlightData] = await Promise.all([
          fetchJson(`/highlights/user/${userId}/report`, controller.signal),
          fetchJson(`/highlights/user/${userId}`, controller.signal),
        ])

        setVersesByGroup(groupVersesByBookAndColor(highlightData.highlights))
        setExpandedGroups(new Set())
        setRows(reportData.report)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setErrorMessage(error.message)
        }
      }
    }

    loadReport()

    return () => controller.abort()
  }, [userId])

  // Opens or closes the verse preview under one report row.
  function togglePreview(groupKey) {
    setExpandedGroups((previous) => {
      const next = new Set(previous)

      if (!next.delete(groupKey)) {
        next.add(groupKey)
      }

      return next
    })
  }

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
              {rows.map((row) => {
                const groupKey = makeGroupKey(row.book, row.color)
                const isExpanded = expandedGroups.has(groupKey)
                const previewId = `report-preview-${row.userId ?? userId}-${row.book}-${row.color}`.replace(/\W/g, '-')
                const color = row.color.startsWith('#') ? row.color : `#${row.color}`

                return (
                  <Fragment key={groupKey}>
                    <tr className="report-row" onClick={() => togglePreview(groupKey)}>
                      <th scope="row">
                        <button
                          className="report-toggle"
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={previewId}
                        >
                          {row.book}
                        </button>
                      </th>
                      <td>
                        <span className="report-color" style={{ backgroundColor: color }}>
                          {row.color}
                        </span>
                      </td>
                      <td>{row.highlight_count}</td>
                      <td>{row.verse_count}</td>
                    </tr>
                    <tr className="report-preview-row" id={previewId} hidden={!isExpanded}>
                      <td colSpan={4}>
                        <ul className="report-preview">
                          {[...(versesByGroup[groupKey]?.entries() ?? [])].map(([highlightId, verses]) => (
                            <li key={highlightId}>
                              <p className="report-preview-meta">
                                <time dateTime={normalizeSavedItemTimestamp(verses[0].createdAt)}>
                                  {formatSavedItemDate(verses[0].createdAt)}
                                </time>
                                {` · ${verses.length} ${verses.length === 1 ? 'verse' : 'verses'}`}
                              </p>
                              {groupAdjacentVerses(verses).map((passage) => (
                                <p key={passage[0].verseId}>
                                  <strong>
                                    {`${passage[0].book} ${passage[0].chapterNum}:${formatVerseNumbers(passage)} (${passage[0].abbreviation})`}
                                  </strong>{' '}
                                  <span>
                                    {passage.map((verse) => (
                                      <Fragment key={verse.verseId}>
                                        <sup className="report-verse-number">{verse.verseNum}</sup>
                                        {verse.content}{' '}
                                      </Fragment>
                                    ))}
                                  </span>
                                </p>
                              ))}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default ReportPage
