import './App.css'

function App() {
  return (
    <main className="app">
      <header className="app-header">
        <p className="eyebrow">Offline Bible reader</p>
        <h1>BibleLite</h1>
        <p>Read, search, highlight, and take notes on Bible passages.</p>
      </header>

      <section className="reading-space" aria-labelledby="reading-space-title">
        <h2 id="reading-space-title">Your reading space</h2>
        <p>Choose a book, chapter, and translation to get started.</p>
      </section>
    </main>
  )
}

export default App
