import { useId, useState } from 'react'

async function sendAccountRequest(path, body) {
  const response = await fetch(`/api/users${path}`, {
    method: 'POST',
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
    throw new Error(data.error || `Request failed (${response.status}).`)
  }
  if (!data.user) {
    throw new Error('The server did not return an account.')
  }

  return data
}

function AccountPanel({
  account,
  headingId,
  onAccountChange,
  panelRef,
  emailInputRef,
}) {
  const [mode, setMode] = useState('login')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  async function authenticate(path, body) {
    setIsSubmitting(true)
    setNotice('')

    try {
      const { user } = await sendAccountRequest(path, body)
      onAccountChange(user)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const body = Object.fromEntries(formData.entries())
    void authenticate(mode === 'signup' ? '/signup' : '/login', body)
  }

  function handleLogout() {
    onAccountChange(null)
  }

  return (
    <aside className="account-panel" ref={panelRef}>
      <section className="account-card" aria-labelledby={titleId}>
        <div className="card-heading">
          <h2 id={titleId}>
            {account ? `Welcome, ${account.firstName}` : isSigningUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p>
            {account
              ? 'This account is selected for this visit.'
              : isSigningUp
                ? 'Get started with BibleLite.'
                : 'Log in to continue reading.'}
          </p>
        </div>

        {account ? (
          <div className="account-details">
            <p className="account-email">{account.email}</p>
            <button
              className="submit-button"
              type="button"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        ) : (
          <>
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
                  aria-describedby={passwordWarningId}
                  autoComplete={isSigningUp ? 'new-password' : 'current-password'}
                  enterKeyHint="done"
                  id={passwordId}
                  maxLength={128}
                  name="password"
                  type="password"
                  required
                />
              </label>
              <p className="password-warning" id={passwordWarningId}>
                Class demo only. Do not use a real or reused password.
              </p>

              <button className="submit-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Please wait…' : isSigningUp ? 'Create account' : 'Log in'}
              </button>
              <p className="form-notice" role="status" aria-live="polite">
                {notice}
              </p>
            </form>

            {!isSigningUp && (
              <>
                <div className="account-separator" aria-hidden="true"><span>or</span></div>
                <button
                  className="demo-button"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void authenticate('/demo')}
                >
                  {isSubmitting ? 'Please wait…' : 'Try the demo'}
                </button>
              </>
            )}

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
          </>
        )}
      </section>
    </aside>
  )
}

export default AccountPanel
