# BibleLite
This is my CS465 Final Project. I want to create a Bible app that lets users take notes and highlight verses.

## Accounts

Sign up with an email and a password, or use **Try the demo** on the login card. This class demo deliberately stores passwords as plain text in the existing `passwordHash` column and compares them directly at login. It does not create server-side sessions or enforce account ownership on notes and highlights. Account selection only lasts until the page is reloaded. Never use a real or reused password, and do not deploy this version for real accounts.

The demo button creates or reuses the `transaction-demo@example.com` database account. If `transaction.sql` has been run, its sample highlights and notes are available in that demo account.
