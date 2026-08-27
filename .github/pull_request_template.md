<!-- Pull requests are optional here — most work is pushed straight to `main`
     (docs/TEAM.md). Open one when the change is large, when you want it read
     before it lands, or when it touches authentication, payments, personal data
     or migrations. -->

## What this changes, and why

<!-- The why matters more than the what — the diff already says what. Name the
     ticket if there is one. -->

Ticket:

## How I know it works

<!-- "It should work" is not this section. What did you actually run or open?
     If the change crosses between the front end and the server, say that you
     saw it work in a browser against a running server — three sign-out bugs
     survived weeks of green tests because both suites mocked the other half. -->

- [ ] I saw it work, not just pass
- [ ] A test covers it, and I saw that test fail before the change
- [ ] New user-facing strings exist in all three locales (`npm run check:locales`)
- [ ] If I edited `src/data/*TopicsData.js`, I ran `npm run content:export` and committed the result
- [ ] If I added a migration, I read the note on the shared database in `docs/TEAM.md`

## How AI was used

<!-- Rule AI-11 in CONTRIBUTING.md. Not a confession — it tells the reviewer
     where to look hardest. "Wrote the serializer, I checked every field against
     the model" is a useful sentence. "None" is a fine answer. -->

## Anything found but not fixed

<!-- Rule: it becomes a ticket, not a memory. Link it here. -->
