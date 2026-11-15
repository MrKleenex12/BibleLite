# BibleLite

## Project Overview

BibleLite is a web app for reading Bible chapters and saving highlights and notes. It is intended for readers who want to browse English Bible translations and keep verse-related study notes.

Users can choose a book, chapter, and translation; create an account or use the demo account; highlight one or more verses; create notes for verses; view saved items by verse; and edit or delete saved highlights and notes.

## DBMS

BibleLite uses SQLite, a relational database. The database file is named `biblelite.db`.

## Database Setup

Requirements: SQLite 3 command-line tools, Python 3, and Bash. The Python import script uses only the Python standard library; no Python packages need to be installed.

From the repository root, create the database and move it to the location expected by the server:

```sh
cd final-submission-files
./setup_biblelite.sh
mv biblelite.db ../biblelite.db
cd ..
```

The setup script recreates `final-submission-files/biblelite.db`. It runs `setup.sql` to create the schema, then uses `insert.py` to load each `data/*.txt` translation. The included data files provide KJV and WEB. Moving the generated file replaces any existing `biblelite.db` in the repository root.

To add the demo account's sample highlights and notes, run this optional SQL file **after** the database has been created and moved:

```sh
sqlite3 biblelite.db < final-submission-files/transaction.sql
```

`queries.sql` contains optional examples and helper views; it is not required to run the application:

```sh
sqlite3 -header -column biblelite.db < final-submission-files/queries.sql
```

The schema and queries use SQLite SQL and `PRAGMA foreign_keys`. The server enables foreign-key enforcement when it opens the database. The generated `biblelite.db` is ignored by Git; recreate it from the included schema and translation data.

## Application Setup

The web client uses JavaScript, React, and Vite. The API uses JavaScript, Node.js, and Fastify. Python is used only to import translation text into SQLite.

Requirements: Node.js 22.12 or newer (or Node.js 20.19 or newer), npm, and the database at the repository root. Install dependencies from each package directory; no environment variables or secrets are required.

Start the API in one terminal:

```sh
cd server
npm ci
node index.js
```

Start the web client in a second terminal:

```sh
cd web
npm ci
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. Keep both processes running. Vite proxies `/api` requests to the API at `http://localhost:8000`.

The server opens `../biblelite.db` relative to its working directory, so run `node index.js` from `server/` as shown.

## Major Application Operations

- Browse chapters by book, chapter, and translation.
- Sign up, log in, use the demo account, and log out.
- Create highlights on selected verses using preset colors; edit colors or delete highlights.
- Create notes associated with one or more verses; edit or delete notes.
- Open a verse's saved-items list to see its highlights and notes, ordered newest first with saved dates.
- View the highlight summary report through the API.

## Known Limitations

- The included database data contains only KJV and WEB translations. More translations exist, but most modern translations are copywrited. More translations available from [Biblehub downloads](https://biblehub.com/downloads.htm).
- Passwords are stored as plain text. This is a class demo and must not be used with real or reused passwords.
- The app does not use server-side sessions or enforce account ownership on saved-item API operations. The selected account is kept only in React memory. It is not stored in cookies or `sessionStorage` and is lost when the page reloads.
- The included setup script replaces its generated database in `final-submission-files/`; moving it to the repository root replaces the existing root database.
