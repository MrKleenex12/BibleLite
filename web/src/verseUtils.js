// --- Saved item dates ---

// Turns a database timestamp into an ISO string, treating timestamps without a timezone as UTC.
export function normalizeSavedItemTimestamp(timestamp) {
  if (typeof timestamp !== 'string') {
    return ''
  }

  const isoTimestamp = timestamp.replace(' ', 'T')
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(isoTimestamp)
    ? isoTimestamp
    : `${isoTimestamp}Z`
}

// Formats a saved timestamp for display in the viewer's locale.
export function formatSavedItemDate(timestamp) {
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

// --- Verse grouping ---

// Joins verse numbers into ranges such as "16–17, 20".
export function formatVerseNumbers(verses) {
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

// Splits verses into runs of consecutive verses from the same book, chapter and translation.
export function groupAdjacentVerses(verses) {
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
