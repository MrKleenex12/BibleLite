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

// Groups the flat API rows into one entry per verse, keeping the API's verse order.
function groupRowsByVerse(rows) {
  const versesByNumber = new Map()

  for (const row of rows) {
    if (!versesByNumber.has(row.verseNum)) {
      versesByNumber.set(row.verseNum, [])
    }
    versesByNumber.get(row.verseNum).push(row)
  }

  return [...versesByNumber.entries()]
}

// --- Compare translations page ---

// Shows two chosen translations of one chapter side by side, verse by verse.
function ComparePage() {
  const [books, setBooks] = useState([])
  const [bookId, setBookId] = useState('1')
  const [chapterNumber, setChapterNumber] = useState(1)
  const [verses, setVerses] = useState([])
  const [leftChoice, setLeftChoice] = useState('')
  const [rightChoice, setRightChoice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    // Loads the book list so the user can pick a book.
    async function loadBooks() {
      try {
        const data = await fetchJson('/books/', controller.signal)

        setBooks(data.books)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setErrorMessage(error.message)
        }
      }
    }

    loadBooks()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    // Loads all translations of the chosen chapter and groups them by verse.
    async function loadChapter() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const data = await fetchJson(
          `/translations/compare/book/${bookId}/chapter/${chapterNumber}`,
          controller.signal,
        )

        setVerses(groupRowsByVerse(data.rows))
      } catch (error) {
        if (error.name !== 'AbortError') {
          setVerses([])
          setErrorMessage(error.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadChapter()

    return () => controller.abort()
  }, [bookId, chapterNumber])

  // Switches book and returns to chapter 1 so the chapter number is never out of range.
  function changeBook(event) {
    setBookId(event.target.value)
    setChapterNumber(1)
  }

  const selectedBook = books.find((book) => String(book.id) === bookId)
  const lastChapter = selectedBook?.chapterCount ?? 1

  // The chapter response lists every translation that has this chapter, so no second request is needed.
  const abbreviations = [...new Set(verses.flatMap(([, rows]) => rows.map((row) => row.abbreviation)))]
  const leftAbbreviation = leftChoice || abbreviations[0]
  const rightAbbreviation = rightChoice || abbreviations[1] || abbreviations[0]

  return (
    <section className="reader reader-wide" aria-labelledby="compare-title">
      <div className="reader-intro">
        <h1 id="compare-title">Compare translations</h1>
      </div>

      <div className="verse-search compare-page" aria-busy={isLoading}>
        <div className="verse-search-form compare-toolbar">
          <select
            value={leftAbbreviation ?? ''}
            onChange={(event) => setLeftChoice(event.target.value)}
            aria-label="Left translation"
          >
            {abbreviations.map((abbreviation) => (
              <option key={abbreviation} value={abbreviation}>{abbreviation}</option>
            ))}
          </select>
          <div className="compare-passage">
            <select value={bookId} onChange={changeBook} aria-label="Book" disabled={books.length === 0}>
              {books.map((book) => (
                <option key={book.id} value={book.id}>{book.name}</option>
              ))}
            </select>
            <select
              value={chapterNumber}
              onChange={(event) => setChapterNumber(Number(event.target.value))}
              aria-label="Chapter"
            >
              {Array.from({ length: lastChapter }, (_, index) => index + 1).map((chapter) => (
                <option key={chapter} value={chapter}>{chapter}</option>
              ))}
            </select>
          </div>
          <select
            value={rightAbbreviation ?? ''}
            onChange={(event) => setRightChoice(event.target.value)}
            aria-label="Right translation"
          >
            {abbreviations.map((abbreviation) => (
              <option key={abbreviation} value={abbreviation}>{abbreviation}</option>
            ))}
          </select>
        </div>

        {errorMessage && (
          <p className="reading-status error-message" role="alert">{errorMessage}</p>
        )}

        {isLoading && <progress aria-label="Loading chapter" />}

        {!isLoading && verses.length > 0 && (
          <ul className="compare-verses">
            {verses.map(([verseNumber, rows]) => (
              <li key={verseNumber}>
                <strong>
                  <span className="visually-hidden">{`${selectedBook?.name ?? ''} ${chapterNumber}:`}</span>
                  {verseNumber}
                </strong>
                {[leftAbbreviation, rightAbbreviation].map((abbreviation, side) => (
                  <p key={side}>
                    <span>{abbreviation}</span>
                    {rows.find((row) => row.abbreviation === abbreviation)?.content ?? '—'}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default ComparePage
