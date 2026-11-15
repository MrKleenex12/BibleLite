import { useEffect, useId, useRef, useState } from 'react'
import AccountPanel from './AccountPanel.jsx'
import ChapterReader from './ChapterReader.jsx'
import SearchPage from './SearchPage.jsx'
import './App.css'

// --- Page routing ---

const SEARCH_HASH = '#/search'

// Reads which page the URL hash selects.
function readPageFromHash() {
  return window.location.hash === SEARCH_HASH ? 'search' : 'reader'
}

function App() {
  const [page, setPage] = useState(readPageFromHash)
  const [passage, setPassage] = useState(null)
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false)
  const [headerSelectorTarget, setHeaderSelectorTarget] = useState(null)
  const [account, setAccount] = useState(null)
  const accountDropdownRef = useRef(null)
  const accountDropdownEmailRef = useRef(null)
  const accountTitleId = useId()

  function handleAccountChange(user) {
    setAccount(user)
    setIsAccountDropdownOpen(false)
  }

  function handleHeaderLogin() {
    setIsAccountDropdownOpen((isOpen) => !isOpen)
  }

  useEffect(() => {
    // Keeps the page in sync with the hash so the browser back button works.
    function syncPageWithHash() {
      setPage(readPageFromHash())
    }

    window.addEventListener('hashchange', syncPageWithHash)

    return () => window.removeEventListener('hashchange', syncPageWithHash)
  }, [])

  // Opens the reader at a passage picked on the search page.
  function openPassage(nextPassage) {
    setPassage(nextPassage)
    window.location.hash = '#/'
  }

  useEffect(() => {
    const dropdown = accountDropdownRef.current
    if (!dropdown) {
      return
    }

    if (isAccountDropdownOpen && !dropdown.matches(':popover-open')) {
      dropdown.showPopover()
      accountDropdownEmailRef.current?.focus()
    } else if (!isAccountDropdownOpen && dropdown.matches(':popover-open')) {
      dropdown.hidePopover()
    }
  }, [isAccountDropdownOpen])

  return (
    <main className="page">
      <header className="site-header">
        <a className="brand" href="#/" aria-label="BibleLite home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 6.5c-2.2-1.6-5.1-1.8-8-.8v12c2.9-1 5.8-.8 8 .8m0-12c2.2-1.6 5.1-1.8 8-.8v12c-2.9-1-5.8-.8-8 .8m0-12v12.8" />
            </svg>
          </span>
          <span>BibleLite</span>
        </a>
        <div className="header-reading-controls" ref={setHeaderSelectorTarget} />
        <div className="header-actions">
          <a className="header-search-link" href={SEARCH_HASH}>Search</a>
          <button
            className="header-login-button"
            type="button"
            aria-expanded={isAccountDropdownOpen}
            aria-controls="account-dropdown"
            onClick={handleHeaderLogin}
          >
            {account ? 'Account' : 'Log in'}
          </button>
        </div>
        <dialog
          className="account-dropdown"
          id="account-dropdown"
          popover="auto"
          ref={accountDropdownRef}
          aria-labelledby={accountTitleId}
          onToggle={(event) => setIsAccountDropdownOpen(event.newState === 'open')}
        >
          <button
            className="dialog-close"
            type="button"
            aria-label="Close account dropdown"
            onClick={() => setIsAccountDropdownOpen(false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
          <AccountPanel
            account={account}
            headingId={accountTitleId}
            onAccountChange={handleAccountChange}
            emailInputRef={accountDropdownEmailRef}
          />
        </dialog>
      </header>

      <div className="home-layout">
        {page === 'search' ? (
          <SearchPage onSelectResult={openPassage} />
        ) : (
          <ChapterReader
            account={account}
            headerSelectorTarget={headerSelectorTarget}
            onRequestLogin={() => setIsAccountDropdownOpen(true)}
            passage={passage}
          />
        )}
      </div>
    </main>
  )
}

export default App
