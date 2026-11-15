import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

async function getJson(path, signal) {
  const response = await fetch(`/api${path}`, { signal })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`)
  }

  return data
}

function ChapterReader({ headerSelectorTarget }) {
  const [books, setBooks] = useState([])
  const [translations, setTranslations] = useState([])
  const [selectedBookId, setSelectedBookId] = useState('')
  const [selectedTranslationId, setSelectedTranslationId] = useState('')
  const [chapterNumber, setChapterNumber] = useState(1)
  const [verses, setVerses] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isLoadingChapter, setIsLoadingChapter] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [optionsError, setOptionsError] = useState('')
  const [chapterError, setChapterError] = useState('')
  const pickerDialogRef = useRef(null)
  const pickerFirstSelectRef = useRef(null)
  const selectorId = useId()
  const pickerTitleId = useId()

  useEffect(() => {
    const controller = new AbortController()

    async function loadOptions() {
      try {
        const [bookData, translationData] = await Promise.all([
          getJson('/books/', controller.signal),
          getJson('/translations/', controller.signal),
        ])

        if (!Array.isArray(bookData.books) || !Array.isArray(translationData.translations)) {
          throw new Error('The reading options could not be loaded.')
        }
        if (bookData.books.length === 0 || translationData.translations.length === 0) {
          throw new Error('No books or translations are available yet.')
        }

        setBooks(bookData.books)
        setTranslations(translationData.translations)
        setSelectedBookId(String(bookData.books[0].id))
        setSelectedTranslationId(String(translationData.translations[0].id))
      } catch (error) {
        if (error.name !== 'AbortError') {
          setOptionsError(error.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingOptions(false)
        }
      }
    }

    loadOptions()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedBookId || !selectedTranslationId) {
      return undefined
    }

    const controller = new AbortController()

    async function loadChapter() {
      setIsLoadingChapter(true)
      setChapterError('')

      try {
        const data = await getJson(
          `/verses/translation/${selectedTranslationId}/book/${selectedBookId}/chapter/${chapterNumber}`,
          controller.signal,
        )

        if (!Array.isArray(data.verses)) {
          throw new Error('The chapter response was not in the expected format.')
        }

        setVerses(data.verses)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setVerses([])
          setChapterError(error.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingChapter(false)
        }
      }
    }

    loadChapter()
    return () => controller.abort()
  }, [selectedBookId, selectedTranslationId, chapterNumber])

  const selectedBook = books.find((book) => String(book.id) === selectedBookId)
  const selectedTranslation = translations.find(
    (translation) => String(translation.id) === selectedTranslationId,
  )
  const lastChapter = selectedBook?.chapterCount ?? 1
  const referenceLabel = `${selectedBook?.name || 'Bible'} chapter ${chapterNumber}, ${selectedTranslation?.abbreviation || 'translation'}`

  useEffect(() => {
    const dialog = pickerDialogRef.current
    if (!dialog) {
      return
    }

    if (isPickerOpen && !dialog.open) {
      dialog.showModal()
      pickerFirstSelectRef.current?.focus()
    } else if (!isPickerOpen && dialog.open) {
      dialog.close()
    }
  }, [isPickerOpen])

  function changeBook(event) {
    setSelectedBookId(event.target.value)
    setChapterNumber(1)
  }

  function moveChapter(amount) {
    setChapterNumber((current) => Math.min(lastChapter, Math.max(1, current + amount)))
  }

  function renderHeaderPill() {
    return (
      <div className="chapter-pill" role="group" aria-label="Reading selection">
        <label className="visually-hidden" htmlFor={`${selectorId}-header-book`}>Book</label>
        <select
          id={`${selectorId}-header-book`}
          className="pill-select book-select"
          value={selectedBookId}
          onChange={changeBook}
          disabled={isLoadingOptions || Boolean(optionsError)}
        >
          {books.map((book) => (
            <option key={book.id} value={book.id}>{book.name}</option>
          ))}
        </select>

        <label className="visually-hidden" htmlFor={`${selectorId}-header-chapter`}>Chapter</label>
        <select
          id={`${selectorId}-header-chapter`}
          className="pill-select chapter-select"
          value={chapterNumber}
          onChange={(event) => setChapterNumber(Number(event.target.value))}
          disabled={!selectedBook || Boolean(optionsError)}
        >
          {Array.from({ length: lastChapter }, (_, index) => index + 1).map((chapter) => (
            <option key={chapter} value={chapter}>{chapter}</option>
          ))}
        </select>

        <label className="visually-hidden" htmlFor={`${selectorId}-header-translation`}>
          Translation
        </label>
        <select
          id={`${selectorId}-header-translation`}
          className="pill-select translation-select"
          value={selectedTranslationId}
          onChange={(event) => setSelectedTranslationId(event.target.value)}
          disabled={isLoadingOptions || Boolean(optionsError)}
        >
          {translations.map((translation) => (
            <option key={translation.id} value={translation.id}>
              {translation.abbreviation}
            </option>
          ))}
        </select>
      </div>
    )
  }

  function renderPickerFields() {
    return (
      <div className="chapter-picker-fields">
        <label htmlFor={`${selectorId}-picker-book`}>
          Book
          <select
            id={`${selectorId}-picker-book`}
            ref={pickerFirstSelectRef}
            value={selectedBookId}
            onChange={changeBook}
            disabled={isLoadingOptions || Boolean(optionsError)}
          >
            {books.map((book) => (
              <option key={book.id} value={book.id}>{book.name}</option>
            ))}
          </select>
        </label>

        <label htmlFor={`${selectorId}-picker-chapter`}>
          Chapter
          <select
            id={`${selectorId}-picker-chapter`}
            value={chapterNumber}
            onChange={(event) => setChapterNumber(Number(event.target.value))}
            disabled={!selectedBook || Boolean(optionsError)}
          >
            {Array.from({ length: lastChapter }, (_, index) => index + 1).map((chapter) => (
              <option key={chapter} value={chapter}>{chapter}</option>
            ))}
          </select>
        </label>

        <label htmlFor={`${selectorId}-picker-translation`}>
          Translation
          <select
            id={`${selectorId}-picker-translation`}
            value={selectedTranslationId}
            onChange={(event) => setSelectedTranslationId(event.target.value)}
            disabled={isLoadingOptions || Boolean(optionsError)}
          >
            {translations.map((translation) => (
              <option key={translation.id} value={translation.id}>
                {translation.abbreviation}
              </option>
            ))}
          </select>
        </label>
      </div>
    )
  }

  return (
    <>
      {headerSelectorTarget && createPortal(
        <>
          <div className="header-selection-desktop">{renderHeaderPill()}</div>
          <button
            className="header-reference-button"
            type="button"
            aria-label={`Change reading selection: ${referenceLabel}`}
            aria-haspopup="dialog"
            aria-expanded={isPickerOpen}
            aria-controls={`${selectorId}-picker`}
            title={referenceLabel}
            disabled={isLoadingOptions || Boolean(optionsError)}
            onClick={() => setIsPickerOpen(true)}
          >
            <span className="reference-book">{selectedBook?.name || 'Bible'}</span>
            <span className="reference-chapter">{chapterNumber}</span>
            <span className="reference-translation">
              {selectedTranslation?.abbreviation || '…'}
            </span>
          </button>
        </>,
        headerSelectorTarget,
      )}

      <section className="reader" aria-labelledby="chapter-title">
        <div className="reader-intro">
          <h1 id="chapter-title">
            {selectedBook ? `${selectedBook.name} ${chapterNumber}` : 'A moment in the word'}
          </h1>
        </div>

        <div className="chapter-navigation" aria-label="Chapter navigation">
          <button
            className="step-button"
            type="button"
            aria-label="Previous chapter"
            disabled={isLoadingOptions || !selectedBook || chapterNumber <= 1}
            onClick={() => moveChapter(-1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14.5 5-7 7 7 7" />
            </svg>
          </button>

          <button
            className="step-button"
            type="button"
            aria-label="Next chapter"
            disabled={isLoadingOptions || !selectedBook || chapterNumber >= lastChapter}
            onClick={() => moveChapter(1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9.5 5 7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="reader-divider" aria-hidden="true">
          <span />
          <span className="divider-mark" />
          <span />
        </div>

        <article className="chapter-text" aria-label={`${selectedBook?.name || 'Bible'} chapter ${chapterNumber}`}>
          {isLoadingOptions && <p className="reading-status" aria-live="polite">Getting your reading ready…</p>}
          {optionsError && (
            <p className="reading-status error-message" role="alert">
              Could not load books and translations: {optionsError}
            </p>
          )}
          {isLoadingChapter && !isLoadingOptions && (
            <p className="reading-status" aria-live="polite">Loading chapter…</p>
          )}
          {chapterError && !isLoadingOptions && (
            <p className="reading-status error-message" role="alert">
              Could not load this chapter: {chapterError}
            </p>
          )}
          {!isLoadingOptions && !isLoadingChapter && !chapterError && verses.length > 0 && (
            <div className="verses" aria-busy={isLoadingChapter}>
              {verses.map((verse) => (
                <p className="verse" key={verse.id}>
                  <sup className="verse-number" aria-label={`Verse ${verse.verseNum}`}>
                    {verse.verseNum}
                  </sup>
                  {verse.content}
                </p>
              ))}
            </div>
          )}
        </article>

        <dialog
          className="chapter-picker-dialog"
          id={`${selectorId}-picker`}
          ref={pickerDialogRef}
          aria-labelledby={pickerTitleId}
          onClose={() => setIsPickerOpen(false)}
        >
          <div className="chapter-picker-card">
            <div className="chapter-picker-heading">
              <h2 id={pickerTitleId}>Choose a passage</h2>
              <button
                className="chapter-picker-close"
                type="button"
                onClick={() => setIsPickerOpen(false)}
              >
                Close
              </button>
            </div>
            {renderPickerFields()}
          </div>
        </dialog>
      </section>
    </>
  )
}

export default ChapterReader
