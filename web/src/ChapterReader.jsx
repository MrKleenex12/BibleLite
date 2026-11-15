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

function normalizeSavedItemTimestamp(timestamp) {
  if (typeof timestamp !== 'string') {
    return ''
  }

  const isoTimestamp = timestamp.replace(' ', 'T')
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(isoTimestamp)
    ? isoTimestamp
    : `${isoTimestamp}Z`
}

function formatSavedItemDate(timestamp) {
  const isoTimestamp = normalizeSavedItemTimestamp(timestamp)
  const date = new Date(isoTimestamp)

  if (!isoTimestamp || Number.isNaN(date.getTime())) {
    return timestamp || ''
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getHighlightColors(highlights) {
  const colors = {}
  for (const highlight of highlights) {
    if (highlight.isActive && colors[highlight.verseId] === undefined) {
      colors[highlight.verseId] = highlight.color
    }
  }
  return colors
}

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

function groupAdjacentVerses(verses) {
  const orderedVerses = [...verses].sort(
    (left, right) => left.bookId - right.bookId
      || left.chapterNum - right.chapterNum
      || left.translationId - right.translationId
      || left.verseNum - right.verseNum,
  )

  return orderedVerses.reduce((groups, verse) => {
    const lastGroup = groups[groups.length - 1]
    const previousVerse = lastGroup?.[lastGroup.length - 1]

    if (
      previousVerse
      && previousVerse.bookId === verse.bookId
      && previousVerse.chapterNum === verse.chapterNum
      && previousVerse.translationId === verse.translationId
      && previousVerse.verseNum + 1 === verse.verseNum
    ) {
      lastGroup.push(verse)
    } else {
      groups.push([verse])
    }

    return groups
  }, [])
}

async function getJson(path, signal) {
  const response = await fetch(`/api${path}`, { signal })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`)
  }

  return data
}

async function mutateJson(path, method, body) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data
  try {
    data = response.status === 204 ? {} : await response.json()
  } catch {
    throw new Error('The server returned an invalid response.')
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status}).`)
  }

  return data
}

async function postJson(path, body) {
  return mutateJson(path, 'POST', body)
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
  const [isAddingNoteVerse, setIsAddingNoteVerse] = useState(false)
  const [selectedPickerVerseNumber, setSelectedPickerVerseNumber] = useState('')
  const [optionsError, setOptionsError] = useState('')
  const [chapterError, setChapterError] = useState('')
  const [verseSelection, setVerseSelection] = useState({ passageKey: '', ids: new Set() })
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false)
  const [noteVerseEntries, setNoteVerseEntries] = useState([])
  const [noteContent, setNoteContent] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteNotice, setNoteNotice] = useState('')
  const [noteError, setNoteError] = useState('')
  const [savedHighlightState, setSavedHighlightState] = useState({ userId: null, colors: {} })
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].value)
  const [isSavingHighlight, setIsSavingHighlight] = useState(false)
  const [highlightNotice, setHighlightNotice] = useState('')
  const [highlightError, setHighlightError] = useState('')
  const [highlightErrorUserId, setHighlightErrorUserId] = useState(null)
  const pickerDialogRef = useRef(null)
  const savedItemsDialogRef = useRef(null)
  const pickerFirstSelectRef = useRef(null)
  const [savedItemsState, setSavedItemsState] = useState({
    userId: null,
    highlights: [],
    notes: [],
  })
  const [selectedSavedVerse, setSelectedSavedVerse] = useState(null)
  const [savedItemEditor, setSavedItemEditor] = useState(null)
  const [isSavingSavedItem, setIsSavingSavedItem] = useState(false)
  const [savedItemError, setSavedItemError] = useState('')
  const [savedItemNotice, setSavedItemNotice] = useState('')
  const selectorId = useId()
  const pickerTitleId = useId()
  const savedItemsTitleId = useId()
  const noteEditorId = useId()

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

        const chapterVerses = [...data.verses].sort((left, right) => left.verseNum - right.verseNum)
        setVerses(chapterVerses)
        setSelectedPickerVerseNumber(
          chapterVerses.length > 0 ? String(chapterVerses[0].verseNum) : '',
        )
      } catch (error) {
        if (error.name !== 'AbortError') {
          setVerses([])
          setSelectedPickerVerseNumber('')
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

    async function loadSavedItems() {
      try {
        const [highlightData, noteData] = await Promise.all([
          getJson(`/highlights/user/${userId}`, controller.signal),
          getJson(`/notes/user/${userId}`, controller.signal),
        ])
        if (!Array.isArray(highlightData?.highlights)) {
          throw new Error('The saved highlights response was not in the expected format.')
        }
        if (!Array.isArray(noteData?.notes)) {
          throw new Error('The saved notes response was not in the expected format.')
        }

        setSavedItemsState({
          userId,
          highlights: highlightData.highlights,
          notes: noteData.notes,
        })
        setSavedHighlightState({
          userId,
          colors: getHighlightColors(highlightData.highlights),
        })
        setHighlightErrorUserId(userId)
        setHighlightError('')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setHighlightErrorUserId(userId)
          setHighlightError(error.message)
        }
      }
    }

    void loadSavedItems()
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
  const currentSelectedVerseEntries = selectedVerses.map((verse) => ({
    ...verse,
    bookId: Number(selectedBookId),
    bookName: selectedBook?.name || 'Bible',
    chapterNum: chapterNumber,
    translationId: Number(selectedTranslationId),
    abbreviation: selectedTranslation?.abbreviation || '',
  }))
  const dockVerseEntries = isNoteEditorOpen ? noteVerseEntries : currentSelectedVerseEntries
  const noteVerseIds = noteVerseEntries.map((verse) => verse.id)
  const savedVerseColors = savedHighlightState.userId === String(account?.id)
    ? savedHighlightState.colors
    : {}
  const savedItems = savedItemsState.userId === String(account?.id)
    ? savedItemsState
    : { highlights: [], notes: [] }
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

  useEffect(() => {
    const dialog = savedItemsDialogRef.current
    if (!dialog) {
      return
    }

    if (selectedSavedVerse && !dialog.open) {
      dialog.showModal()
    } else if (!selectedSavedVerse && dialog.open) {
      dialog.close()
    }
  }, [selectedSavedVerse])

  function getSavedItemsForVerse(verseId) {
    const highlights = savedItems.highlights.filter((highlight) => highlight.verseId === verseId)
    const notes = savedItems.notes.filter((note) => (
        note.verses.some((noteVerse) => noteVerse.id === verseId)
      ))
    const items = [
      ...highlights.map((highlight) => ({ ...highlight, itemType: 'highlight' })),
      ...notes.map((note) => ({ ...note, itemType: 'note' })),
    ]

    return {
      highlights,
      notes,
      items: items.sort((left, right) => (
        new Date(normalizeSavedItemTimestamp(right.createdAt)).getTime()
        - new Date(normalizeSavedItemTimestamp(left.createdAt)).getTime()
      )),
    }
  }

  function startSavedItemEdit(item) {
    setSavedItemError('')
    setSavedItemNotice('')
    setSavedItemEditor({
      itemType: item.itemType,
      id: item.itemType === 'note' ? item.id : item.highlightId,
      value: item.itemType === 'note' ? item.content : item.color,
    })
  }

  async function saveSavedItemEdit(event) {
    event.preventDefault()
    if (!account?.id || !savedItemEditor || isSavingSavedItem) {
      return
    }

    const userId = String(account.id)
    const value = savedItemEditor.itemType === 'note'
      ? savedItemEditor.value.trim()
      : savedItemEditor.value
    if (!value) {
      setSavedItemError('Enter a note before saving.')
      return
    }

    setIsSavingSavedItem(true)
    setSavedItemError('')
    setSavedItemNotice('')
    try {
      if (savedItemEditor.itemType === 'note') {
        const data = await mutateJson(
          `/notes/user/${userId}/${savedItemEditor.id}`,
          'PATCH',
          { content: value },
        )
        if (!data?.noteId) {
          throw new Error('The server did not confirm the note update.')
        }

        setSavedItemsState({
          userId,
          highlights: savedItems.highlights,
          notes: savedItems.notes.map((note) => (
            note.id === savedItemEditor.id ? { ...note, content: value } : note
          )),
        })
      } else {
        const data = await mutateJson(
          `/highlights/user/${userId}/highlight/${savedItemEditor.id}`,
          'PATCH',
          { color: value },
        )
        if (!data?.highlightId || !data.color) {
          throw new Error('The server did not confirm the highlight update.')
        }

        const highlights = savedItems.highlights.map((highlight) => (
          highlight.highlightId === savedItemEditor.id
            ? { ...highlight, color: data.color }
            : highlight
        ))
        setSavedItemsState({ userId, highlights, notes: savedItems.notes })
        setSavedHighlightState({
          userId,
          colors: getHighlightColors(highlights),
        })
      }

      setSavedItemEditor(null)
      setSavedItemNotice('Saved changes.')
    } catch (error) {
      setSavedItemError(error.message)
    } finally {
      setIsSavingSavedItem(false)
    }
  }

  async function deleteSavedItem(item) {
    if (!account?.id || isSavingSavedItem) {
      return
    }

    const itemType = item.itemType
    const itemId = itemType === 'note' ? item.id : item.highlightId
    const label = itemType === 'note' ? 'note' : 'highlight'
    if (!window.confirm(`Delete this ${label} from all verses linked to it? This cannot be undone.`)) {
      return
    }

    const userId = String(account.id)
    setIsSavingSavedItem(true)
    setSavedItemError('')
    setSavedItemNotice('')
    try {
      const path = itemType === 'note'
        ? `/notes/user/${userId}/${itemId}`
        : `/highlights/user/${userId}/highlight/${itemId}`
      const data = await mutateJson(path, 'DELETE')
      if (itemType === 'note' ? !data?.noteId : !data?.highlightId) {
        throw new Error(`The server did not confirm the ${label} deletion.`)
      }

      if (itemType === 'note') {
        setSavedItemsState({
          userId,
          highlights: savedItems.highlights,
          notes: savedItems.notes.filter((note) => note.id !== itemId),
        })
      } else {
        const highlights = savedItems.highlights.filter(
          (highlight) => highlight.highlightId !== itemId,
        )
        setSavedItemsState({ userId, highlights, notes: savedItems.notes })
        setSavedHighlightState({
          userId,
          colors: getHighlightColors(highlights),
        })
      }

      setSavedItemEditor(null)
      setSavedItemNotice(`${label[0].toUpperCase()}${label.slice(1)} deleted from all linked verses.`)
    } catch (error) {
      setSavedItemError(error.message)
    } finally {
      setIsSavingSavedItem(false)
    }
  }

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

  function openPassagePicker(forAddingNoteVerse = false) {
    setIsAddingNoteVerse(forAddingNoteVerse)
    setIsPickerOpen(true)
  }

  function changePickerVerse(event) {
    setSelectedPickerVerseNumber(event.target.value)
  }

  function moveChapter(amount) {
    setChapterNumber((current) => Math.min(lastChapter, Math.max(1, current + amount)))
    clearVerseSelection()
  }

  function createNoteVerseEntry(verse) {
    return {
      id: verse.id,
      bookId: Number(selectedBookId),
      bookName: selectedBook?.name || 'Bible',
      chapterNum: chapterNumber,
      translationId: Number(selectedTranslationId),
      verseNum: verse.verseNum,
      content: verse.content,
      abbreviation: selectedTranslation?.abbreviation || '',
    }
  }

  function addSelectedNoteVerse() {
    const verse = verses.find(
      (entry) => String(entry.verseNum) === selectedPickerVerseNumber,
    )
    if (!verse) {
      setNoteError('Select a verse from the current passage.')
      return
    }

    const isDuplicate = noteVerseEntries.some((entry) => entry.id === verse.id)
    if (isDuplicate) {
      setNoteNotice('That verse is already in this note.')
    } else {
      setNoteVerseEntries((current) => [...current, createNoteVerseEntry(verse)])
      setNoteNotice('')
    }
    setNoteError('')
    setIsPickerOpen(false)
    setIsAddingNoteVerse(false)
  }

  function toggleVerseSelection(verse) {
    if (isNoteEditorOpen) {
      setNoteVerseEntries((current) => (
        current.some((entry) => entry.id === verse.id)
          ? current.filter((entry) => entry.id !== verse.id)
          : [...current, createNoteVerseEntry(verse)]
      ))
      setNoteError('')
      setNoteNotice('')
      return
    }

    setVerseSelection((current) => {
      const next = new Set(current.passageKey === passageKey ? current.ids : [])
      if (next.has(verse.id)) {
        next.delete(verse.id)
      } else {
        next.add(verse.id)
      }
      return { passageKey, ids: next }
    })
    setHighlightNotice('')
    setHighlightError('')
  }

  async function saveHighlight(event) {
    event.preventDefault()
    if (!account?.id || !highlightColor || selectedVerseIds.size === 0 || isSavingHighlight) {
      return
    }

    const userId = String(account.id)
    const verseIds = [...selectedVerseIds]
    setIsSavingHighlight(true)
    setHighlightNotice('')
    setHighlightError('')

    try {
      const data = await postJson(`/highlights/user/${userId}`, {
        color: highlightColor,
        verseIds,
      })
      if (!data?.highlightId) {
        throw new Error('The server did not confirm the saved highlight.')
      }

      setSavedHighlightState((current) => (
        {
          userId,
          colors: {
            ...(current.userId === userId ? current.colors : {}),
            ...Object.fromEntries(verseIds.map((verseId) => [verseId, highlightColor])),
          },
        }
      ))
      const savedHighlights = selectedVerses.map((verse) => ({
        highlightId: data.highlightId,
        color: highlightColor,
        createdAt: data.createdAt,
        isActive: 1,
        verseId: verse.id,
        abbreviation: selectedTranslation?.abbreviation,
        book: selectedBook?.name,
        chapterNum: verse.chapterNum,
        verseNum: verse.verseNum,
        content: verse.content,
      }))
      setSavedItemsState((current) => ({
        userId,
        highlights: [
          ...(current.userId === userId ? current.highlights : []),
          ...savedHighlights,
        ],
        notes: current.userId === userId ? current.notes : [],
      }))
      setVerseSelection({ passageKey, ids: new Set() })
      setHighlightNotice(`Saved highlight for ${verseIds.length} ${verseIds.length === 1 ? 'verse' : 'verses'}.`)
    } catch (error) {
      setHighlightErrorUserId(userId)
      setHighlightError(error.message)
    } finally {
      setIsSavingHighlight(false)
    }
  }

  function openNoteEditor() {
    setNoteVerseEntries(currentSelectedVerseEntries)
    setNoteContent('')
    setNoteError('')
    setNoteNotice('')
    setIsNoteEditorOpen(true)
  }

  async function saveNote(event) {
    event.preventDefault()
    if (!account?.id || noteVerseEntries.length === 0 || isSavingNote) {
      return
    }

    const content = noteContent.trim()
    if (!content) {
      setNoteError('Enter a note before saving.')
      return
    }

    const userId = String(account.id)
    const verseIds = [...new Set(noteVerseIds)]
    setIsSavingNote(true)
    setNoteNotice('')
    setNoteError('')

    try {
      const data = await postJson(`/notes/user/${userId}`, { content, verseIds })
      if (!data?.noteId) {
        throw new Error('The server did not confirm the saved note.')
      }

      let highlightSaveError = ''
      if (highlightColor) {
        try {
          const highlightData = await postJson(`/highlights/user/${userId}`, {
            color: highlightColor,
            verseIds,
          })
          if (!highlightData?.highlightId) {
            throw new Error('The server did not confirm the saved highlight.')
          }

          setSavedHighlightState((current) => ({
            userId,
            colors: {
              ...(current.userId === userId ? current.colors : {}),
              ...Object.fromEntries(verseIds.map((verseId) => [verseId, highlightColor])),
            },
          }))
          setSavedItemsState((current) => ({
            userId,
            highlights: [
              ...(current.userId === userId ? current.highlights : []),
              ...noteVerseEntries.map((verse) => ({
                highlightId: highlightData.highlightId,
                color: highlightColor,
                createdAt: highlightData.createdAt,
                isActive: 1,
                verseId: verse.id,
                abbreviation: verse.abbreviation,
                book: verse.bookName,
                chapterNum: verse.chapterNum,
                verseNum: verse.verseNum,
                content: verse.content,
              })),
            ],
            notes: current.userId === userId ? current.notes : [],
          }))
        } catch (error) {
          highlightSaveError = error.message
        }
      }

      setSavedItemsState((current) => ({
        userId,
        highlights: current.userId === userId ? current.highlights : [],
        notes: [
          ...(current.userId === userId ? current.notes : []),
          {
            id: data.noteId,
            content,
            createdAt: data.createdAt,
            verses: noteVerseEntries.map((verse) => ({
              id: verse.id,
              content: verse.content,
              chapterNum: verse.chapterNum,
              verseNum: verse.verseNum,
            })),
          },
        ],
      }))

      setIsNoteEditorOpen(false)
      setNoteVerseEntries([])
      setNoteContent('')
      if (highlightSaveError) {
        setNoteError(`Note saved, but the highlight could not be saved: ${highlightSaveError}`)
      } else if (highlightColor) {
        setVerseSelection({ passageKey, ids: new Set() })
        setNoteNotice('Saved note and highlighted its verses.')
      } else {
        setNoteNotice('Note saved.')
      }
    } catch (error) {
      setNoteError(error.message)
    } finally {
      setIsSavingNote(false)
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

        {isAddingNoteVerse && (
          <label htmlFor={`${selectorId}-picker-verse`}>
            Verse
            <select
              id={`${selectorId}-picker-verse`}
              value={selectedPickerVerseNumber}
              onChange={changePickerVerse}
              disabled={isLoadingChapter || verses.length === 0 || Boolean(chapterError)}
            >
              {verses.map((verse) => (
                <option key={verse.id} value={verse.verseNum}>{verse.verseNum}</option>
              ))}
            </select>
          </label>
        )}
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
            onClick={() => openPassagePicker()}
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
        className={`reader${selectedVerseIds.size > 0 || isNoteEditorOpen ? ' reader-with-highlight-dock' : ''}${isNoteEditorOpen ? ' reader-with-note-dock' : ''}`}
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
              {verses.map((verse) => {
                const verseSavedItems = getSavedItemsForVerse(verse.id)
                const savedItemCount = verseSavedItems.highlights.length + verseSavedItems.notes.length
                const isSelected = isNoteEditorOpen
                  ? noteVerseEntries.some((entry) => entry.id === verse.id)
                  : selectedVerseIds.has(verse.id)

                return (
                  <div
                    className={`verse-row${savedVerseColors[verse.id] ? ' verse-highlighted' : ''}${isSelected ? ' verse-selected' : ''}`}
                    key={verse.id}
                    style={savedVerseColors[verse.id]
                      ? { '--verse-highlight-color': savedVerseColors[verse.id] }
                      : undefined}
                  >
                    <button
                      className="verse"
                      type="button"
                      aria-pressed={isSelected}
                      disabled={isSavingHighlight || isSavingNote}
                      onClick={() => toggleVerseSelection(verse)}
                    >
                      <sup className="verse-number">{verse.verseNum}</sup>
                      {savedItemCount > 0 && (
                        <span className="verse-number-marker-space" aria-hidden="true" />
                      )}
                      <span>{verse.content}</span>
                    </button>
                    {savedItemCount > 0 && (
                      <button
                        className="verse-saved-items-trigger"
                        type="button"
                        aria-label={`View ${verseSavedItems.highlights.length} saved ${verseSavedItems.highlights.length === 1 ? 'highlight' : 'highlights'} and ${verseSavedItems.notes.length} ${verseSavedItems.notes.length === 1 ? 'note' : 'notes'} for ${selectedBook?.name} ${chapterNumber}:${verse.verseNum}`}
                        style={{
                          left: `calc(0.5rem + ${String(verse.verseNum).length * 0.38}em + 0.34rem)`,
                        }}
                        onClick={() => {
                          setSavedItemEditor(null)
                          setSavedItemError('')
                          setSavedItemNotice('')
                          setSelectedSavedVerse(verse)
                        }}
                      >
                        <span className="verse-saved-items-square" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </article>

        {currentHighlightError && (
          <p className="highlight-feedback error-message" role="alert">
            Could not save or load saved highlights and notes: {currentHighlightError}
          </p>
        )}
        {highlightNotice && (
          <p className="highlight-feedback" role="status" aria-live="polite">
            {highlightNotice}
          </p>
        )}
        {noteError && (
          <p className="highlight-feedback error-message" role="alert">
            {noteError}
          </p>
        )}
        {noteNotice && (
          <p className="highlight-feedback" role="status" aria-live="polite">
            {noteNotice}
          </p>
        )}
        {(selectedVerseIds.size > 0 || isNoteEditorOpen) && (
          <section
            className={`highlight-dock${isNoteEditorOpen ? ' highlight-dock-note' : ''}`}
            aria-labelledby={`${selectorId}-dock-title`}
            aria-busy={isSavingHighlight || isSavingNote}
          >
            <h2 className="visually-hidden" id={`${selectorId}-dock-title`}>
              {isNoteEditorOpen ? 'Note verses' : 'Selected verses'}
            </h2>
            {isNoteEditorOpen ? (
              <div className="highlight-dock-heading">
                <p className="highlight-count">Add a note</p>
              </div>
            ) : (
              <div className="highlight-selection-row">
                <p className="highlight-selected-reference">
                  {selectedBook?.name} {chapterNumber}:{formatVerseNumbers(selectedVerses)}
                  {selectedTranslation?.abbreviation && (
                    <span>{selectedTranslation.abbreviation}</span>
                  )}
                </p>
                <button
                  className="highlight-clear-button"
                  type="button"
                  onClick={() => setVerseSelection({ passageKey, ids: new Set() })}
                  disabled={isSavingHighlight || isSavingNote}
                >
                  Clear
                </button>
              </div>
            )}
            {isNoteEditorOpen ? (
              <div className="highlight-selected-verses">
                {dockVerseEntries.length > 0 ? (
                  <ul className="highlight-verse-list">
                    {groupAdjacentVerses(dockVerseEntries).map((verseGroup) => {
                      const firstVerse = verseGroup[0]
                      const verseGroupIds = new Set(verseGroup.map((verse) => verse.id))

                      return (
                        <li
                          key={verseGroup.map((verse) => verse.id).join('-')}
                          style={{ '--verse-highlight-color': highlightColor || '#f7f8f4' }}
                        >
                          <div className="note-verse-heading">
                            <p className="highlight-verse-reference">
                              {firstVerse.bookName} {firstVerse.chapterNum}:{formatVerseNumbers(verseGroup)}
                              {firstVerse.abbreviation && <span>{firstVerse.abbreviation}</span>}
                            </p>
                            <button
                              className="note-verse-remove"
                              type="button"
                              aria-label={`Remove ${firstVerse.bookName} ${firstVerse.chapterNum}:${formatVerseNumbers(verseGroup)}`}
                              disabled={isSavingNote}
                              onClick={() => {
                                setNoteVerseEntries((current) => (
                                  current.filter((entry) => !verseGroupIds.has(entry.id))
                                ))
                                setNoteError('')
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          <p className="highlight-verse-content">
                            {verseGroup.map((verse) => (
                              <span className="note-verse-text" key={verse.id}>
                                <sup>{verse.verseNum}</sup> {verse.content}
                              </span>
                            ))}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="note-empty-verses">
                    Select verses in the chapter to add them to this note.
                  </p>
                )}
              </div>
            ) : null}
            {isNoteEditorOpen && (
              <div className="note-add-verse">
                <button
                  className="note-add-verse-button"
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={isPickerOpen}
                  aria-controls={`${selectorId}-picker`}
                  aria-label="Add verse"
                  onClick={() => openPassagePicker(true)}
                  disabled={isSavingNote || isLoadingOptions || Boolean(optionsError)}
                >
                  <span aria-hidden="true">+</span>
                  Add verse
                </button>
              </div>
            )}
            {isNoteEditorOpen && (
              <form
                className="note-editor"
                id={noteEditorId}
                aria-label="Note editor"
                onSubmit={saveNote}
              >
                <textarea
                  id={`${noteEditorId}-content`}
                  name="content"
                  aria-label="Note"
                  value={noteContent}
                  onChange={(event) => {
                    const textarea = event.currentTarget
                    setNoteContent(textarea.value)
                    setNoteError('')
                    if (!window.CSS?.supports?.('field-sizing', 'content')) {
                      textarea.style.height = 'auto'
                      textarea.style.height = `${textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight}px`
                    }
                  }}
                  required
                  rows={3}
                  disabled={isSavingNote}
                />
                <div className="note-editor-footer">
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
                          onClick={() => setHighlightColor((current) => (
                            current === color.value ? null : color.value
                          ))}
                          disabled={isSavingNote}
                        >
                          <span
                            className="highlight-color-swatch"
                            style={{ backgroundColor: color.value }}
                          >
                            {highlightColor === color.value && (
                              <span className="highlight-color-x" aria-hidden="true">X</span>
                            )}
                          </span>
                          <span>{color.name}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="note-editor-actions">
                    <button
                      className="highlight-clear-button"
                      type="button"
                      onClick={() => setIsNoteEditorOpen(false)}
                      disabled={isSavingNote}
                    >
                      Close
                    </button>
                    {account ? (
                      <button
                        className="highlight-save-button"
                        type="submit"
                        disabled={isSavingNote || noteVerseEntries.length === 0}
                      >
                        {isSavingNote ? 'Saving…' : 'Save note'}
                      </button>
                    ) : (
                      <button
                        className="highlight-save-button"
                        type="button"
                        onClick={onRequestLogin}
                        disabled={isSavingNote}
                      >
                        Log in to save
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
            {!isNoteEditorOpen && (
              <form
                className="highlight-action"
                aria-label="Highlight selected verses"
                onSubmit={saveHighlight}
              >
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
                        onClick={() => setHighlightColor((current) => (
                          current === color.value ? null : color.value
                        ))}
                      >
                        <span
                          className="highlight-color-swatch"
                          style={{ backgroundColor: color.value }}
                        >
                          {highlightColor === color.value && (
                            <span className="highlight-color-x" aria-hidden="true">X</span>
                          )}
                        </span>
                        <span>{color.name}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="highlight-dock-actions">
                  <button
                    className="highlight-clear-button"
                    type="button"
                    aria-expanded={false}
                    aria-controls={noteEditorId}
                    onClick={openNoteEditor}
                  >
                    Add a note
                  </button>
                  {account ? (
                    <button className="highlight-save-button" type="submit" disabled={isSavingHighlight || !highlightColor}>
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
          </section>
        )}

        <dialog
          className="chapter-picker-dialog"
          id={`${selectorId}-picker`}
          ref={pickerDialogRef}
          aria-labelledby={pickerTitleId}
          onClose={() => {
            setIsPickerOpen(false)
            setIsAddingNoteVerse(false)
          }}
        >
          <div className="chapter-picker-card">
            <div className="chapter-picker-heading">
              <h2 id={pickerTitleId}>
                {isAddingNoteVerse ? 'Choose a verse' : 'Choose a passage'}
              </h2>
              <button
                className="chapter-picker-close"
                type="button"
                onClick={() => setIsPickerOpen(false)}
              >
                Close
              </button>
            </div>
            {renderPickerFields()}
            {isAddingNoteVerse && (
              <button
                className="highlight-save-button chapter-picker-add-verse"
                type="button"
                onClick={addSelectedNoteVerse}
                disabled={!selectedPickerVerseNumber || isLoadingChapter || verses.length === 0}
              >
                Add verse
              </button>
            )}
          </div>
        </dialog>

        <dialog
          className="saved-items-dialog"
          ref={savedItemsDialogRef}
          aria-labelledby={savedItemsTitleId}
          onClose={() => {
            setSelectedSavedVerse(null)
            setSavedItemEditor(null)
            setSavedItemError('')
          }}
        >
          <div className="saved-items-card">
            <div className="chapter-picker-heading">
              <h2 id={savedItemsTitleId}>
                {selectedBook?.name} {chapterNumber}:{selectedSavedVerse?.verseNum} saved items
              </h2>
              <form method="dialog">
                <button className="chapter-picker-close" type="submit" autoFocus>
                  Close
                </button>
              </form>
            </div>
            {selectedSavedVerse && (() => {
              const verseSavedItems = getSavedItemsForVerse(selectedSavedVerse.id)
              return (
                <>
                  {savedItemError && (
                    <p className="saved-item-feedback error-message" role="alert">
                      {savedItemError}
                    </p>
                  )}
                  {savedItemNotice && (
                    <p className="saved-item-feedback" role="status" aria-live="polite">
                      {savedItemNotice}
                    </p>
                  )}
                  {verseSavedItems.items.length === 0 ? (
                    <p className="saved-items-empty">No saved items remain for this verse.</p>
                  ) : (
                    <ul className="saved-items-list" aria-busy={isSavingSavedItem}>
                      {verseSavedItems.items.map((item, index) => {
                        const itemId = item.itemType === 'note' ? item.id : item.highlightId
                        const isEditing = savedItemEditor?.itemType === item.itemType
                          && savedItemEditor.id === itemId
                        const itemTypeLabel = item.itemType === 'note' ? 'note' : 'highlight'

                        return (
                          <li key={`${item.itemType}-${itemId}-${index}`}>
                            {item.itemType === 'highlight' ? (
                              <span
                                className="saved-item-color"
                                style={{ backgroundColor: item.color }}
                                aria-hidden="true"
                              />
                            ) : (
                              <span className="saved-item-note-icon" aria-hidden="true">N</span>
                            )}
                            <div className="saved-item-body">
                              <div className="saved-item-heading">
                                <p className="saved-item-type">
                                  {item.itemType === 'highlight' ? 'Highlight' : 'Note'}
                                </p>
                                {item.createdAt && (
                                  <time
                                    className="saved-item-date"
                                    dateTime={normalizeSavedItemTimestamp(item.createdAt)}
                                  >
                                    Saved {formatSavedItemDate(item.createdAt)}
                                  </time>
                                )}
                              </div>
                              {isEditing ? (
                                <form
                                  className="saved-item-edit-form"
                                  onSubmit={saveSavedItemEdit}
                                >
                                  {item.itemType === 'note' ? (
                                    <label htmlFor={`${selectorId}-saved-note-${itemId}`}>
                                      Note
                                      <textarea
                                        id={`${selectorId}-saved-note-${itemId}`}
                                        name="content"
                                        value={savedItemEditor.value}
                                        onChange={(event) => {
                                          setSavedItemEditor((current) => (
                                            current ? { ...current, value: event.target.value } : current
                                          ))
                                          setSavedItemError('')
                                        }}
                                        required
                                        autoFocus
                                        rows={3}
                                        disabled={isSavingSavedItem}
                                      />
                                    </label>
                                  ) : (
                                    <fieldset className="saved-item-highlight-colors">
                                      <legend>Highlight color</legend>
                                      <div className="highlight-color-options">
                                        {HIGHLIGHT_COLORS.map((color) => (
                                          <button
                                            className="highlight-color-option"
                                            key={color.value}
                                            type="button"
                                            aria-label={`${color.name} highlight color`}
                                            aria-pressed={savedItemEditor.value === color.value}
                                            onClick={() => {
                                              setSavedItemEditor((current) => (
                                                current ? { ...current, value: color.value } : current
                                              ))
                                            }}
                                            disabled={isSavingSavedItem}
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
                                  )}
                                  <div className="saved-item-actions saved-item-actions-editing">
                                    <button
                                      className="saved-item-action"
                                      type="button"
                                      disabled={isSavingSavedItem}
                                      onClick={() => {
                                        setSavedItemEditor(null)
                                        setSavedItemError('')
                                      }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      className="saved-item-action saved-item-action-primary"
                                      type="submit"
                                      disabled={isSavingSavedItem}
                                    >
                                      {isSavingSavedItem ? 'Saving…' : 'Save changes'}
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <>
                                  {item.itemType === 'highlight' ? (
                                    <p className="saved-item-detail">
                                      {item.color}
                                      {item.isActive ? ' · Shown on verse' : ' · Hidden on verse'}
                                    </p>
                                  ) : (
                                    <p className="saved-item-content">{item.content}</p>
                                  )}
                                  <div className="saved-item-actions">
                                    <button
                                      className="saved-item-action"
                                      type="button"
                                      aria-label={`Edit ${itemTypeLabel} ${index + 1}`}
                                      disabled={isSavingSavedItem}
                                      onClick={() => startSavedItemEdit(item)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="saved-item-action saved-item-action-danger"
                                      type="button"
                                      aria-label={`Delete ${itemTypeLabel} ${index + 1} from all linked verses`}
                                      disabled={isSavingSavedItem}
                                      onClick={() => void deleteSavedItem(item)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )
            })()}
          </div>
        </dialog>
      </section>
    </>
  )
}

export default ChapterReader
