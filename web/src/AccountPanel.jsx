import { useId, useState } from 'react'

function AccountPanel({ headingId, panelRef, emailInputRef }) {
  const [mode, setMode] = useState('login')
  const [notice, setNotice] = useState('')
  const instanceId = useId()
  const titleId = headingId || `${instanceId}-title`
  const firstNameId = `${instanceId}-first-name`
  const lastNameId = `${instanceId}-last-name`
  const emailId = `${instanceId}-email`
  const passwordId = `${instanceId}-password`
  const passwordWarningId = `${instanceId}-password-warning`
  const isSigningUp = mode === 'signup'

  function changeMode(nextMode) {
    setMode(nextMode)
    setNotice('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    setNotice('Account access is not connected yet.')
  }

  return (
    <aside className="account-panel" ref={panelRef}>
      <section className="account-card" aria-labelledby={titleId}>
        <div className="card-heading">
          <h2 id={titleId}>{isSigningUp ? 'Create your account' : 'Welcome back'}</h2>
          <p>{isSigningUp ? 'Get started with BibleLite.' : 'Log in to continue reading.'}</p>
        </div>

        <form aria-labelledby={titleId} method="post" onSubmit={handleSubmit}>
          {isSigningUp && (
            <div className="name-fields">
              <label htmlFor={firstNameId}>
                First name
                <input
                  autoComplete="given-name"
                  enterKeyHint="next"
                  id={firstNameId}
                  name="firstName"
                  required
                />
              </label>
              <label htmlFor={lastNameId}>
                Last name
                <input
                  autoComplete="family-name"
                  enterKeyHint="next"
                  id={lastNameId}
                  name="lastName"
                  required
                />
              </label>
            </div>
          )}

          <label htmlFor={emailId}>
            Email
            <input
              ref={emailInputRef}
              autoComplete={isSigningUp ? 'email' : 'username'}
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="next"
              id={emailId}
              name="email"
              spellCheck="false"
              type="email"
              required
            />
          </label>
          <label htmlFor={passwordId}>
            Password
            <input
              aria-describedby={isSigningUp ? passwordWarningId : undefined}
              autoComplete={isSigningUp ? 'new-password' : 'current-password'}
              enterKeyHint="done"
              id={passwordId}
              name="password"
              type="password"
              required
            />
          </label>
          {isSigningUp && (
            <p className="password-warning" id={passwordWarningId}>
              Passwords are not securely stored or verified in this demo. DO NOT reuse any passwords.
            </p>
          )}

          <button className="submit-button" type="submit">
            {isSigningUp ? 'Create account' : 'Log in'}
          </button>
          <p className="form-notice" role="status" aria-live="polite">{notice}</p>
        </form>

        <p className="switch-mode">
          {isSigningUp ? 'Already have an account?' : 'New to BibleLite?'}{' '}
          <button
            className="inline-button"
            type="button"
            onClick={() => changeMode(isSigningUp ? 'login' : 'signup')}
          >
            {isSigningUp ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </section>
    </aside>
  )
}

export default AccountPanel
