import { useState } from 'react'
import './App.css'

function App() {
  const [mode, setMode] = useState('signup')
  const [notice, setNotice] = useState('')
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
    <main className="page">
      <header className="site-header">
        <a className="brand" href="/" aria-label="BibleLite home">BibleLite</a>
        <nav className="header-actions" aria-label="Account">
          <button className="text-button" type="button" onClick={() => changeMode('login')}>
            Log in
          </button>
          <button className="small-button" type="button" onClick={() => changeMode('signup')}>
            Sign up
          </button>
        </nav>
      </header>

      <section className="welcome">
        <div className="welcome-copy">
          <p className="eyebrow">A little space for reflection</p>
          <h1>Make time for the word.</h1>
          <p className="intro">
            Read the Bible at your own pace. Keep your favorite verses and notes together,
            wherever your reading takes you.
          </p>
        </div>

        <section className="account-card" aria-labelledby="account-title">
          <div className="card-heading">
            <h2 id="account-title">{isSigningUp ? 'Create your account' : 'Welcome back'}</h2>
            <p>{isSigningUp ? 'Get started with BibleLite.' : 'Log in to continue reading.'}</p>
          </div>

          <form onSubmit={handleSubmit}>
            {isSigningUp && (
              <div className="name-fields">
                <label>
                  First name
                  <input autoComplete="given-name" name="firstName" required />
                </label>
                <label>
                  Last name
                  <input autoComplete="family-name" name="lastName" required />
                </label>
              </div>
            )}

            <label>
              Email
              <input autoComplete="email" name="email" type="email" required />
            </label>
            <label>
              Password
              <input
                autoComplete={isSigningUp ? 'new-password' : 'current-password'}
                name="password"
                type="password"
                required
              />
            </label>
            {isSigningUp && (
              <p className="password-warning">
                Don't reuse a password from another account. Passwords are not handled properly for this final project.
              </p>
            )}

            <button className="submit-button" type="submit">
              {isSigningUp ? 'Create account' : 'Log in'}
            </button>
            <p className="form-notice" aria-live="polite">{notice}</p>
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
      </section>

      <footer className="site-footer">A simpler way to stay close to your reading.</footer>
    </main>
  )
}

export default App
