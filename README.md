# BibleLite

BibleLite is a Bible reader for reading chapters, highlighting verses, and saving notes.

## User functions

- **Read:** Choose a book, chapter, and translation; move between chapters.
- **Accounts:** Sign up, log in, log out, or use the demo account.
- **Highlight:** Select one or more verses and save them with a preset color. Edit the color or delete the saved highlight.
- **Notes:** Save a note for one or more verses, optionally with a highlight color. Edit the note text or delete it.
- **Saved items:** After login, saved highlights and notes load for the account. Open a verse's saved items to view them, including their saved dates. Edits and deletions apply to the entire saved item and all of its linked verses.

## Run locally

You need Node.js, npm, and `biblelite.db` in the repository root.

In the first terminal, start the API server:

```sh
cd server
npm install
node index.js
```

In a second terminal, start the web app:

```sh
cd web
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). Keep both processes running; the web app proxies API requests to `http://localhost:8000`.

## Demo and account limitations

Use **Try the demo** to create or reuse the `transaction-demo@example.com` account. Running `transaction.sql` adds the sample saved items for that account.

This class project stores passwords as plain text, does not create server-side sessions, and does not enforce account ownership on saved items. Account selection lasts only until the page reloads. Use test-only credentials; never use a real or reused password.
