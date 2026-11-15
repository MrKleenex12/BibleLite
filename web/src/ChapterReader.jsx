import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#ffe680' },
  { name: 'Green', value: '#bfe7c2' },
  { name: 'Blue', value: '#b8d9f5' },
  { name: 'Pink', value: '#f5bdd0' },
  { name: 'Orange', value: '#f7c89b' },
  { name: 'Purple', value: '#d9c6f3' },
  { name: 'Teal', value: '#a9e3d8' },
  { name: 'Coral', value: '#f5b7a7' },
]

function formatVerseNumbers(verses) {
  const verseNumbers = [...new Set(verses.map((verse) => verse.verseNum))]
    .sort((left, right) => left - right)

  if (verseNumbers.length === 0) {
    return ''
  }

  const ranges = []
  let start = verseNumbers[0]
  let end = start

  for (const verseNumber of verseNumbers.slice(1)) {
    if (verseNumber === end + 1) {
      end = verseNumber
      continue
    }

    ranges.push(start === end ? String(start) : `${start}–${end}`)
    start = verseNumber
    end = verseNumber
  }

  ranges.push(start === end ? String(start) : `${start}–${end}`)
  return ranges.join(', ')
}

async function getJson(path, signal) {
  const response = await fetch(`/api${path}`, { signal })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`)
  }

  return data
}

function ChapterReader({ account, headerSelectorTarget, onRequestLogin }) {
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
  const [verseSelection, setVerseSelection] = useState({ passageKey: '', ids: new Set() })
  const [savedHighlightState, setSavedHighlightState] = useState({ userId: null, colors: {} })
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].value)
  const [isSavingHighlight, setIsSavingHighlight] = useState(false)
  const [highlightNotice, setHighlightNotice] = useState('')
  const [highlightError, setHighlightError] = useState('')
  const [highlightErrorUserId, setHighlightErrorUserId] = useState(null)
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

  useEffect(() => {
    if (!account?.id) {
      return undefined
    }

    const controller = new AbortController()
    const userId = String(account.id)

    async function loadHighlights() {
      try {
        const data = await getJson(`/highlights/user/${userId}`, controller.signal)
        if (!data || !Array.isArray(data.highlights)) {
          throw new Error('The saved highlights response was not in the expected format.')
        }

        const colors = {}
        for (const highlight of data.highlights) {
          if (highlight.isActive && colors[highlight.verseId] === undefined) {
            colors[highlight.verseId] = highlight.color
          }
        }
        setSavedHighlightState({ userId, colors })
        setHighlightErrorUserId(userId)
        setHighlightError('')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setHighlightErrorUserId(userId)
          setHighlightError(error.message)
        }
      }
    }

    void loadHighlights()
    return () => controller.abort()
  }, [account?.id])

  const selectedBook = books.find((book) => String(book.id) === selectedBookId)
  const selectedTranslation = translations.find(
    (translation) => String(translation.id) === selectedTranslationId,
  )
  const lastChapter = selectedBook?.chapterCount ?? 1
  const referenceLabel = `${selectedBook?.name || 'Bible'} chapter ${chapterNumber}, ${selectedTranslation?.abbreviation || 'translation'}`
  const passageKey = `${selectedTranslationId}:${selectedBookId}:${chapterNumber}`
  const selectedVerseIds = verseSelection.passageKey === passageKey
    ? verseSelection.ids
    : new Set()
  const selectedVerses = verses.filter((verse) => selectedVerseIds.has(verse.id))
  const savedVerseColors = savedHighlightState.userId === String(account?.id)
    ? savedHighlightState.colors
    : {}
  const currentHighlightError = highlightErrorUserId === String(account?.id)
    ? highlightError
    : ''

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

  function clearVerseSelection() {
    setVerseSelection({ passageKey: '', ids: new Set() })
  }

  function changeBook(event) {
    setSelectedBookId(event.target.value)
    setChapterNumber(1)
    clearVerseSelection()
  }

  function changeChapter(event) {
    setChapterNumber(Number(event.target.value))
    clearVerseSelection()
  }

  function changeTranslation(event) {
    setSelectedTranslationId(event.target.value)
    clearVerseSelection()
  }

  function moveChapter(amount) {
    setChapterNumber((current) => Math.min(lastChapter, Math.max(1, current + amount)))
    clearVerseSelection()
  }

  function toggleVerseSelection(verseId) {
    setVerseSelection((current) => {
      const next = new Set(current.passageKey === passageKey ? current.ids : [])
      if (next.has(verseId)) {
        next.delete(verseId)
      } else {
        next.add(verseId)
      }
      return { passageKey, ids: next }
    })
    setHighlightNotice('')
    setHighlightError('')
  }

  async function saveHighlight(event) {
    event.preventDefault()
    if (!account?.id || selectedVerseIds.size === 0 || isSavingHighlight) {
      return
    }

    const userId = String(account.id)
    const verseIds = [...selectedVerseIds]
    setIsSavingHighlight(true)
    setHighlightNotice('')
    setHighlightError('')

    try {
      const response = await fetch(`/api/highlights/user/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: highlightColor, verseIds }),
      })

      let data
      try {
        data = await response.json()
      } catch {
        throw new Error('The server returned an invalid response.')
      }

      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status}).`)
      }
      if (!data?.highlightId) {
        throw new Error('The server did not confirm the saved highlight.')
      }

      setSavedHighlightState((current) => (
        current.userId === userId
          ? {
              ...current,
              colors: {
                ...current.colors,
                ...Object.fromEntries(verseIds.map((verseId) => [verseId, highlightColor])),
              },
            }
          : current
      ))
      setVerseSelection({ passageKey, ids: new Set() })
      setHighlightNotice(`Saved highlight for ${verseIds.length} ${verseIds.length === 1 ? 'verse' : 'verses'}.`)
    } catch (error) {
      setHighlightErrorUserId(userId)
      setHighlightError(error.message)
    } finally {
      setIsSavingHighlight(false)
    }
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
          onChange={changeChapter}
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
          onChange={changeTranslation}
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
            onChange={changeChapter}
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
            onChange={changeTranslation}
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

      <section
        className={`reader${selectedVerseIds.size > 0 ? ' reader-with-highlight-dock' : ''}`}
        aria-labelledby="chapter-title"
      >
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
                <button
                  className={`verse${savedVerseColors[verse.id] ? ' verse-highlighted' : ''}${selectedVerseIds.has(verse.id) ? ' verse-selected' : ''}`}
                  key={verse.id}
                  type="button"
                  aria-pressed={selectedVerseIds.has(verse.id)}
                  disabled={isSavingHighlight}
                  style={savedVerseColors[verse.id]
                    ? { '--verse-highlight-color': savedVerseColors[verse.id] }
                    : undefined}
                  onClick={() => toggleVerseSelection(verse.id)}
                >
                  <sup className="verse-number">
                    {verse.verseNum}
                  </sup>
                  <span>{verse.content}</span>
                </button>
              ))}
            </div>
          )}
        </article>

        {currentHighlightError && (
          <p className="highlight-feedback error-message" role="alert">
            Could not save or load highlights: {currentHighlightError}
          </p>
        )}
        {highlightNotice && (
          <p className="highlight-feedback" role="status" aria-live="polite">
            {highlightNotice}
          </p>
        )}
        {selectedVerseIds.size > 0 && (
          <form
            className="highlight-dock"
            aria-label="Highlight selected verses"
            aria-busy={isSavingHighlight}
            onSubmit={saveHighlight}
          >
            <div className="highlight-dock-heading">
              <p className="highlight-count">
                {selectedVerseIds.size} {selectedVerseIds.size === 1 ? 'verse' : 'verses'} selected
              </p>
              <button
                className="highlight-clear-button"
                type="button"
                onClick={() => setVerseSelection({ passageKey, ids: new Set() })}
                disabled={isSavingHighlight}
              >
                Clear
              </button>
            </div>
            <p className="highlight-selected-verses">
              {selectedBook?.name} {chapterNumber}:{formatVerseNumbers(selectedVerses)}
            </p>
            <fieldset className="highlight-colors">
              <legend>Highlight color</legend>
              <div className="highlight-color-options">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    className="highlight-color-option"
                    key={color.value}
                    type="button"
                    aria-label={`${color.name} highlight`}
                    aria-pressed={highlightColor === color.value}
                    onClick={() => setHighlightColor(color.value)}
                  >
                    <span
                      className="highlight-color-swatch"
                      style={{ backgroundColor: color.value }}
                    />
                    <span>{color.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="highlight-dock-actions">
              {account ? (
                <button className="highlight-save-button" type="submit" disabled={isSavingHighlight}>
                  {isSavingHighlight ? 'Saving…' : 'Save highlight'}
                </button>
              ) : (
                <button
                  className="highlight-save-button"
                  type="button"
                  onClick={onRequestLogin}
                >
                  Log in to save
                </button>
              )}
            </div>
          </form>
        )}

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
