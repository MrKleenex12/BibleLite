import { useEffect, useId, useRef, useState } from 'react'
import AccountPanel from './AccountPanel.jsx'
import ChapterReader from './ChapterReader.jsx'
import './App.css'

function App() {
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [headerSelectorTarget, setHeaderSelectorTarget] = useState(null)
  const [account, setAccount] = useState(null)
  const accountDialogRef = useRef(null)
  const accountPanelRef = useRef(null)
  const desktopEmailInputRef = useRef(null)
  const mobileEmailInputRef = useRef(null)
  const mobileAccountTitleId = useId()

  function handleAccountChange(user) {
    setAccount(user)
    setIsAccountDialogOpen(false)
  }

  function handleHeaderLogin() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setIsAccountDialogOpen(true)
      return
    }

    accountPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    desktopEmailInputRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    const dialog = accountDialogRef.current
    if (!dialog) {
      return
    }

    if (isAccountDialogOpen && !dialog.open) {
      dialog.showModal()
      mobileEmailInputRef.current?.focus()
    } else if (!isAccountDialogOpen && dialog.open) {
      dialog.close()
    }
  }, [isAccountDialogOpen])

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
          onClick={handleHeaderLogin}
        >
          {account ? 'Account' : 'Log in'}
        </button>
      </header>

      <div className="home-layout">
        <ChapterReader headerSelectorTarget={headerSelectorTarget} />
        <AccountPanel
          account={account}
          onAccountChange={handleAccountChange}
          panelRef={accountPanelRef}
          emailInputRef={desktopEmailInputRef}
        />
      </div>

      <dialog
        className="account-dialog"
        id="mobile-account-dialog"
        ref={accountDialogRef}
        aria-labelledby={mobileAccountTitleId}
        onClose={() => setIsAccountDialogOpen(false)}
      >
        <button
          className="dialog-close"
          type="button"
          aria-label="Close sign-in"
          onClick={() => setIsAccountDialogOpen(false)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
        <AccountPanel
          account={account}
          headingId={mobileAccountTitleId}
          onAccountChange={handleAccountChange}
          emailInputRef={mobileEmailInputRef}
        />
      </dialog>
    </main>
  )
}

export default App
