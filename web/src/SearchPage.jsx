import { useEffect, useRef, useState } from 'react'

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

// --- Verse search page ---

const SKELETON_RESULT_COUNT = 6

// Searches verses in a chosen translation and opens the matching chapter when a result is clicked.
function SearchPage({ onSelectResult }) {
  const [translations, setTranslations] = useState([])
  const [translationId, setTranslationId] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const controllerRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()

    // Loads the translation list so the user can choose which one to search.
    async function loadTranslations() {
      try {
        const data = await fetchJson('/translations/', controller.signal)

        setTranslations(data.translations)
        setTranslationId(String(data.translations[0]?.id ?? ''))
      } catch (error) {
        if (error.name !== 'AbortError') {
          setErrorMessage(error.message)
        }
      }
    }

    loadTranslations()

    return () => controller.abort()
  }, [])

  // Sends the search request and stores the matching verses, ignoring any older request still in flight.
  async function searchVerses(event) {
    event.preventDefault()

    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2 || !translationId) {
      return
    }

    // Abort the previous request so a slow earlier search can't overwrite newer results.
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setIsSearching(true)
    setErrorMessage('')

    try {
      const params = new URLSearchParams({ q: trimmedQuery, t_id: translationId })
      const data = await fetchJson(`/verses/search?${params}`, controller.signal)

      setResults(data.verses)
    } catch (error) {
      if (error.name !== 'AbortError') {
        setErrorMessage(error.message)
      }
    } finally {
      if (controllerRef.current === controller) {
        setIsSearching(false)
      }
    }
  }

  // Switches the searched translation and clears results that belong to the previous one.
  function changeTranslation(event) {
    setTranslationId(event.target.value)
    setResults(null)
  }

  return (
    <section className="reader reader-wide" aria-labelledby="search-title">
      <div className="reader-intro">
        <h1 id="search-title">Search</h1>
      </div>

      <div className="verse-search" aria-busy={isSearching}>
        <form className="verse-search-form" onSubmit={searchVerses}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search verses"
            aria-label="Search verses"
            minLength={2}
            maxLength={100}
            required
          />
          <select
            value={translationId}
            onChange={changeTranslation}
            aria-label="Translation"
            disabled={translations.length === 0}
          >
            {translations.map((translation) => (
              <option key={translation.id} value={translation.id}>
                {translation.abbreviation}
              </option>
            ))}
          </select>
          <button className="highlight-save-button" type="submit" disabled={isSearching}>
            {isSearching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {errorMessage && (
          <p className="reading-status error-message" role="alert">{errorMessage}</p>
        )}

        {isSearching && (
          <ul className="verse-search-results" aria-hidden="true">
            {Array.from({ length: SKELETON_RESULT_COUNT }, (_, index) => (
              <li key={index} className="verse-search-skeleton">
                <span className="skeleton-line skeleton-title" />
                <span className="skeleton-line" />
                <span className="skeleton-line skeleton-short" />
              </li>
            ))}
          </ul>
        )}

        {!isSearching && results && results.length === 0 && (
          <p className="reading-status">No verses found.</p>
        )}

        {!isSearching && results && results.length > 0 && (
          <ul className="verse-search-results">
            {results.map((verse) => (
              <li key={verse.id}>
                <button
                  type="button"
                  onClick={() => onSelectResult({
                    bookId: verse.bookId,
                    chapterNum: verse.chapterNum,
                    translationId: Number(translationId),
                  })}
                >
                  <strong>{`${verse.book} ${verse.chapterNum}:${verse.verseNum}`}</strong>
                  <span>{verse.content}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default SearchPage
