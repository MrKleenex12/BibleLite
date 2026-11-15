import { useEffect, useId, useRef, useState } from 'react'
import AccountPanel from './AccountPanel.jsx'
import ChapterReader from './ChapterReader.jsx'
import './App.css'

function App() {
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
        <a className="brand" href="/" aria-label="BibleLite home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 6.5c-2.2-1.6-5.1-1.8-8-.8v12c2.9-1 5.8-.8 8 .8m0-12c2.2-1.6 5.1-1.8 8-.8v12c-2.9-1-5.8-.8-8 .8m0-12v12.8" />
            </svg>
          </span>
          <span>BibleLite</span>
        </a>
        <div className="header-reading-controls" ref={setHeaderSelectorTarget} />
        <button
          className="header-login-button"
          type="button"
          aria-expanded={isAccountDropdownOpen}
          aria-controls="account-dropdown"
          onClick={handleHeaderLogin}
        >
          {account ? 'Account' : 'Log in'}
        </button>
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
        <ChapterReader
          account={account}
          headerSelectorTarget={headerSelectorTarget}
          onRequestLogin={() => setIsAccountDropdownOpen(true)}
        />
      </div>
    </main>
  )
}

export default App
