# Handover — state of the work on 22 August 2026

*Updated 24 August 2026: `fix/audit-critical` is merged, `main` is the only
branch and it is pushed. The deployment configuration has since been removed —
see "The deployment is gone, on purpose" below.*

---

## Start here

| Read | For |
|---|---|
| `docs/SECURITY-INCIDENT-2026-08-22.md` | The exposure, what was actually in it, and why step 3 is an accepted risk |
| `CONTRIBUTING.md` | Team rules: AI use, code, process, the five roles |
| `docs/adr/0001-content-model.md` | The content model, now decided and built |

Verify the state in one go:

```bash
cd backend  && python manage.py test apps base   # expect 320 OK
cd frontend && npm run build && npm test          # expect 193 OK
cd frontend && npm run build && npm run check:locales && npm run content:check
```

---

## What changed

An audit on 22 August found 42 defects across ~30 000 lines; 20 were reproduced
by running the code. The project had **zero tests**. It now has **489**, and CI
that blocks a red merge.

### Security

- `POST /gamification/grant/` **deleted**. It let the browser award itself any
  XP and fuel — one request produced level 101. Not validated, deleted: there
  was no safe version of that shape.
- Answer keys were readable anonymously in **two** apps (`challenges` and,
  separately, `courses` in three places). Serializers are now role-based
  everywhere, including nested.
- Quiz sessions had no ownership check on submit or result; ids are sequential.
- The login throttle was bypassable **two independent ways** — `AnonRateThrottle`
  returns no key for an authenticated caller, and `NUM_PROXIES` was unset so DRF
  keyed on a client-supplied header.
- Settings failed **open**: a typo in `DJANGO_ENV` booted development, which
  turned on `DEBUG`, opened CORS and returned the e-mail sign-in code in the
  response body.
- Sign-in codes moved from `random.randint` to `secrets`, constant-time
  comparison, attempt counting.
- The AI endpoint was `AllowAny` — an open proxy to a paid Google API — and
  spliced caller-supplied `context` into the model's system instruction.
- Uploads had no size, pixel or format limit and the caller chose the stored
  filename, which decided the served `Content-Type`.
- `cosmic-silk-road.html` reported a successful login for any password and took
  its API base from `?api=`. Both holes closed; the page no longer ships.
- The public leaderboard published children's real names and photos.
- **Chat had no moderation of any kind** — see B1 below.

### Correctness

- Rotated refresh tokens were discarded, so **every user was forced back to
  `/login` about an hour after signing in**.
- `/store` threw `ReferenceError` on its first product card and took the whole
  app down with it.
- Balance operations take a row lock; XP awards recompute the level.
- Eight endpoints returned `500` on ordinary bad input; the admin Missions tab
  raised `NameError` on every request.
- `manage.py seed` had **never** worked (unpacked 9 values from 8-element
  tuples, inside `@transaction.atomic`).
- The settings module layered over `base.py` rebuilt `STORAGES` without a
  `default` alias, so every upload raised `InvalidStorageError` once R2 was
  unconfigured. `base/tests.py` still guards that alias.

### Performance and delivery

- Served assets **246 MB → 20 MB**. Star photographs were stored at up to
  16000×9000 and rendered in a ~700 px box; models are Draco-compressed
  (rocket.glb 55.6 MB → 0.32 MB) with the decoder served from `/draco/`.
  Verified in a real browser, not just built.
- The game leaked a compiled shader program and a canvas texture on every
  unmount, never emptied its texture cache, accumulated ~1400 dead closures per
  ten minutes of music, and never closed its `AudioContext`.
- Sphere and conversation lists no longer scale their query count with row
  count (18→38 queries became a flat 14; 3N+1 became a flat 9).
- `admin_api` rebuilt on DRF serializers: 706 lines → 481.

### The content model, and the tickets that hung off it

**ADR 0001 accepted as Option A and built.** The project carried two complete
content models: the one with an admin UI had no readers, the one with readers
had no editor, and the content lived in neither. An administrator could spend an
afternoon writing lessons in the panel and nothing changed on the site.

- `Level`, `Unit`, `Lesson`, `LessonSection` and `courses.QuizQuestion` are
  gone, with their viewsets, serializers, routes, admin, seeds, and the two
  orphan frontend routes that reached them. Progress points at `TopicLesson`
  and `Topic`.
- `SubLesson` is gone too, replaced by a nullable `TopicLesson.parent`. Four
  levels was not one too many, it was also one too *few* — `interviewsTopicsData`
  nests topic → section → lesson → sub-lesson, which the fixed tree could not
  hold. Measured depths across the four subjects: 1, 2, 2, 3.
- Content had **four** copies (static files, a hand-written copy inside
  `seed_learn_data`, and an inline list in `PhysicsView`). It has one:
  `npm run content:export` turns `src/data/*TopicsData.js` into a fixture,
  `manage.py seed_learn_content` loads it keyed on slug, and CI fails if the
  committed fixture is stale.
- The learn screens read `GET /courses/spheres/<slug>/tree/` — the whole subject
  in three queries — through an adapter that reshapes it into the exact shape
  the static files gave. Each screen changed by one import, and the static file
  remains the fallback when the API is unreachable.
- XP is server-decided: `TopicLesson.xp_reward`/`fuel_reward` plus a `Topic`
  bonus paid once when every leaf is done, all editable per row. Only leaves are
  completable; a node with children is a heading.
- **R2 closed.** Finishing a static lesson now posts to
  `POST /progress/lessons/<slug>/complete/`. The other award path —
  `LiveSpaceView` granting 20 XP on mount, for the page rendering rather than
  for watching anything — was removed rather than given an endpoint; there is
  nothing to verify server-side.
- Quiz questions can attach to a lesson (`ChallengeQuestion.lesson`), and
  `POST /challenges/quiz/start/` takes a lesson slug.

### Second audit pass, after the merge

Six findings, five of them in code the first pass had already been through.

- **The daily streak bonus could be claimed twice.** `StreakUpdateView` read,
  decided, then wrote with nothing holding the row — the one award path the
  first pass's row-lock sweep missed. `UserStreak.update_streak()` in the
  challenges app had the identical shape.
- **The day was the server's, not the student's.** `TIME_ZONE` is Asia/Tashkent
  and the server runs on UTC, so the daily reset landed at 05:00 local and an
  evening session was filed under yesterday — which silently broke streaks for
  anyone studying after dinner. Five call sites moved to `timezone.localdate()`.
- **Submitting the daily challenge twice at once returned 500.** The `exists()`
  check is not the guard; `unique_together` is, and the loser of the race saw an
  unhandled IntegrityError.
- **The /learn cards understated every subject by three to six times** — physics
  advertised 24 lessons against 144. They now read `Sphere.lessons_count`.
- **The admin panel said nothing when anything failed.** Nine call sites either
  discarded the error or had no rejection handler at all.

All six have tests, and the ones where a test could pass for the wrong reason
were checked by mutation.

**And the one that matters most.** The first audit closed three answer-key leaks
on the server. The client had its own copies the whole time — `quizData.js` with
24 `correctAnswer` fields and `problemsData.js` with 145 answers — and graded in
the browser against them, so every answer was one View Source away and nothing
on the server could stop it. Confirmed in the built bundle before touching
anything.

The XP those screens showed was never real either: `addXp` is a local
optimistic update, so the number went up and the next profile fetch wiped it.
Two more award paths that silently did nothing, on top of R2's two. The
endpoints that do this properly already existed and nothing called them — the
same shape as ADR 0001's two content branches.

Four screens now read and submit through the API, both files are deleted, and
`src/bundleSecrets.test.js` reads `dist/` and fails the build if an answer key
or a credential appears in it again. **CI builds before it tests for that
reason — keep that order.**

Two consequences to know about: the daily challenge no longer flashes green or
red per question (that needed the key in the browser) and grades on the results
screen instead; and the problem set is honestly 30 rather than dishonestly 145,
because 115 of the entries were generated filler.

---

### Third pass: the browser was doing work only the server should

Two more, both structural.

- **The answer keys were in the bundle.** Covered above; the short version is
  that three server-side leaks were closed while the client kept its own copies
  and graded against them.
- **A broken screen was a broken site.** `SpaceLabView` reaches eight textures
  on third-party hosts through `useLoader`, which throws on a failed load, and
  the only error boundary was the root one — so a blocked host replaced the
  whole application with the crash screen. There is now a `RouteErrorBoundary`
  inside the chrome, and the textures degrade instead of raising. The audit had
  left a test saying no route boundary existed and asking for it to be updated
  deliberately; it has been.

And the gap B1 knowingly left is closed: a moderator can suspend an account
from chat for 1–90 days while resolving a report, rather than only deleting the
message. It is chat-scoped on purpose — `User.is_active` would take the
student's lessons too.

---

### The redesign merged from `main`

One commit on `main` ("backend changes baby") is a frontend redesign of the nine
learn screens, written against the pre-audit tree. It is merged in: his layout,
our data path, resolved file by file.

Three things in it were **not** taken, and the reasons matter if he asks:

- **`zustand` had been dropped from `package.json`.** Seven modules import it,
  including every store the app has. A clean `npm ci` would have produced a
  build that cannot start.
- **`three` 0.183.2 → 0.184.0 and `@react-three/fiber` 9.5.0 → 9.6.1** were
  picked up incidentally by an `npm install` during a CSS change. Nothing in the
  redesign needs them. Worth doing, in its own commit, with the game exercised.
- **`.agent/skills/ui-ux-pro-max/`** — 31 files of AI tooling, three of them
  compiled `.pyc`. CI's hygiene job fails on any tracked `__pycache__`, so this
  alone would have turned `main` red. Untracked; `.agent/` and `.claude/` are
  now in `.gitignore`.

Two of his changes would have quietly reverted work on this branch and were
re-applied on top of his layout: `UniversalLessonView` was back to awarding XP
client-side with no server call (R2), and `PhysicsView` was back to its inline
copy of the physics curriculum. Everything else of his is kept as written,
including the locale edits that drop the unsupportable "Managed by
NASA-Inspired Learning Systems" line from all three languages.

**Before he pulls:** he is working from the old tree, so tell him to re-clone or
hard-reset onto this branch rather than merging his local copy forward — a
second merge from the old base would reintroduce all three of the above.

---

## Open, and why

### Needs the lead — cannot be done for you

| | |
|---|---|
| **Q1 — credential exposure** | **Closed 25 August 2026, except the key rotation.** History rewritten and **pushed** (`.git` 214 MB → 85 MB, `main` matches `origin/main`). Step 3 — GitHub still serving the old blobs by SHA — is now a **recorded accepted risk**, because the file was finally opened and read: it holds nine accounts of which six are tests and two are invented characters, nine `pbkdf2_sha256` hashes, two throwaway messages, and exactly one real personal address, the owner's own. **It contains no data belonging to a minor**; the three birth dates that suggested otherwise sit within days of their own `date_joined` and are a date picker defaulting to today. The row-by-row evidence and the conditions that would re-open this are in `docs/SECURITY-INCIDENT-2026-08-22.md`. Still genuinely open, and cheap: rotate `SECRET_KEY`, the R2 keys, `GEMINI_API_KEY` and the Neon role password by hand — all of them have been through a chat window. |
| **B1 — review, then decide about DMs** | The moderation floor is built and DMs are **off** (`DM_ENABLED=false`). Turning them on is a product decision about a duty of care to 10-to-18-year-olds, not a code change. Before flipping it: decide who reads `GET /chat/reports/queue/` and how often, and how long a first suspension should be — the mechanism exists (`suspend_days`, 1-90, chat-scoped and time-boxed) but nobody has decided the policy. |

### Free to pick up

| | |
|---|---|
| **Q3 (tail)** | The history rewrite already took a fresh clone down to ~45 MB, so this is now only about the working tree: fifteen `.glb` models hold 50 MB of uncompressed texture data in `frontend/public/models`. `npm run assets:compress` does it, **on Linux or WSL only** (libvips fails on Windows). CI now fails if that total grows. |
| **C2 (tail)** | 31 assets the game references and does not have are pinned in `spaceRunAssets.test.js`; loading degrades rather than 404-ing, but the art is still missing. |
| **Lesson quizzes, content** | The plumbing is done end to end — `/quiz/:category?lesson=<slug>` runs a quiz for one lesson. What is missing is content: no `ChallengeQuestion` is attached to a lesson yet. That is admin-panel work. |
| **115 missing problems** | The Masalalar set advertises itself as a set and holds 30. The other 115 entries were placeholders and were dropped rather than seeded; someone has to write them. |
| **Lesson text** | `TopicLesson.content` is a bare `TextField` described as "text/markdown" and nobody renders markdown. Decide what a lesson body is before anyone writes into it. |
| ~~**SpaceLabView's textures**~~ | **Done, 24 August 2026.** All eight are served from `/textures/` now. Four were already in the repository and only the view had not been told; the other four were downscaled and re-encoded on the way in — 2.6 MB of downloads became 1.0 MB committed, nothing near the 2 MB file that CI starts counting. What each one is and what was done to it: `frontend/public/textures/ATTRIBUTION.md`. The non-throwing loader stays and is now `useTextures`, because a local path can be wrong too. |

---

## Fourth pass: the throttles locked out the school, not the attacker

Reported as "registration and login are broken", 24 August 2026. It was, and the
cause was a defence pointed at the wrong event.

**A school is one public address.** The login throttle counted *every* request
to `/auth/login/`, successful ones included, keyed on that address alone at
10/hour. Reproduced against a running server: ten sign-ins with the correct
password returned 200, the eleventh returned 429, and so did everything after
it for an hour — for every child in the building. Registration had the same
shape at 20/day, which one class exhausts before the second row has finished
typing.

Nothing about that was visible from the code alone, and the two tests covering
the throttles both used *failed* logins, so both passed throughout.

What changed:

- **Only wrong guesses cost anything.** A sign-in that works is not what the
  limit is defending against. `_FailureOnlyRateThrottle` checks the budget on
  the way in and spends it only when the view reports that the credentials were
  wrong. Registration still counts every attempt, because there the account
  created *is* the cost.
- **The account is part of the key.** `login` is now 10 failures per hour per
  address *and* account, so one child's typos cannot spend their classmates'
  budget — and an attacker cannot lock a victim out of their own account from
  somewhere else, which the old shape allowed.
- **A per-address ceiling replaces what that gave up.** `login_ip`, 60 failures
  an hour across all accounts, is what stops one password being sprayed across a
  list of addresses. A room full of people mistyping their own passwords does
  not reach it.
- **Registration fits a classroom:** 30/minute and 150/day per address instead
  of 20/day.
- **A blocked request no longer extends its own lockout.** Recording a hit for
  something already refused meant a retrying app pushed its own unlock further
  away every time it tried.
- **The screen says what happened.** Both auth screens showed
  `response.data.detail`, which on a 429 is DRF's English "Request was throttled.
  Expected available in 3513 seconds." — shown verbatim to a Russian or Uzbek
  child, and on the login screen sometimes replaced by "invalid email or
  password", sending them to reset a password that was fine. `retryAfterMinutes`
  reads the `Retry-After` header and both screens now show a translated sentence
  with the wait in minutes.

Eight backend tests cover it, the first of which is the bug as reported: thirty
children, one address, correct passwords, thirty 200s.

### The same defect, everywhere else

Login was where it was noticed. Auditing the rest found two more of exactly the
same shape, and one performance problem underneath all of them.

- **`anon` was 2000/day, keyed on the address.** Every anonymous request from
  the building came out of one budget — and a single page view costs several
  requests, as the comment beside it said. A class browsing the catalogue spent
  it by mid-afternoon, after which the public site stopped answering them until
  the next day. Now `120/sec`: a flood guard, which is the only honest job a
  per-address limit has here.
- **`problem_check` was 60/hour, keyed on the address** for anonymous callers,
  and the problem set has deliberately never been behind a login. Thirty
  problems, two classes, and it stopped for the whole school. It now has two
  rates: `60/hour` per account when signed in, `120/min` per address when not.
- **`user` was 10000/day** and `anon` 2000/day, which is also a storage
  problem. DRF keeps one timestamp per request in a single cache entry for the
  length of the window, so those were lists of up to ten thousand and two
  thousand floats, read and rewritten on every request — against a
  database-backed cache, which is what runs without `REDIS_URL`. Every window
  is now a minute or shorter except the deliberate daily registration ceiling,
  and a test fails the build if any scope goes above 500.
- **`write: 300/day` was dead configuration** — nothing referenced the scope.
  Removed rather than left to imply that writes were limited.

The rule all of it now follows, written at the top of `DEFAULT_THROTTLE_RATES`:
**keyed on the account, size it for a person; keyed on the address, size it for
a machine.** A per-address limit cannot do more than that behind NAT, and every
time one was sized for a person it locked out pupils and stopped nobody with a
second address.

`base/tests.py` has three tests that hold the rule rather than the numbers, so
a future edit that reintroduces a person-sized address limit fails the build.

**Known limit, and the way out.** 300 accounts a day from one address is
generous for a school and not nothing for an abuser. The real answer is
verifying the e-mail address before an account is worth anything. The machinery
already exists — `apps/accounts/email_code.py` sends and verifies six-digit
codes, and `/auth/email-code/request/` and `/verify/` both work — but **nothing
in the front end calls either of them**, and registration does not require
verification. That is the next thing to do here, and it would let the ceiling
come back down.

---

## Fifth pass: signing out did not sign you out

Found by driving the real thing in a browser, 24 August 2026, after the owner
asked for plain password sign-in to be solid before anything else is built on
top of it. Register, sign in, sign out, sign in again — three defects, none of
which any test was going to find, because two of them only exist between the
two halves of the system and the third only exists below 1280 pixels.

**1. "Log Out" left the session open on the server.** Pressing it produced
`401` on `POST /auth/logout/`, which `.catch(() => {})` swallowed, so the
refresh token was never blacklisted and kept working for its full seven days.
Confirmed by hand: sign in, sign out, then exchange the refresh token — `200`,
with a fresh access token.

Two causes, one on each side, and both had to go:

- `useAuthStore.logout()` clears the tokens *synchronously* and the request
  interceptor reads them a tick later, so the request went out with no
  `Authorization` header at all. The store's unit test mocked the API and
  asserted the call was made — which it was. Nobody had checked what came back.
- `LogoutView` required authentication. Even with the header it would have
  failed the common case: the access token lasts 8 hours against the refresh
  token's 7 days, so a tab left open overnight could never revoke its own
  session. It is `AllowAny` now, deliberately — the refresh token in the body
  *is* the credential being revoked, and anyone holding it already has the
  account, so demanding a second one protects nothing and broke the button.

**2. On a phone there was no way to sign out at all.** The dropdown holding
"Log Out" is `hidden` below Tailwind's `xl`, and the compact bar that replaces
it only links to `/profile`. Every phone, every tablet, any laptop under
1280px: a signed-in pupil could not end their session. On a shared school
computer that leaves the previous child's account open for the next one. The
mobile menu now carries the account section.

**3. Signing out locally depended on the network.** If the request threw on its
way out rather than rejecting, `logout()` aborted before clearing anything and
the pupil stayed signed in. The existing test used `mockRejectedValue`, which
returns a promise, so it never covered a synchronous throw. Found by the new
Navigation test rather than by reading.

Five backend tests and four front-end ones cover these. The one worth keeping
in mind: `test_signing_out_works_without_a_live_access_token` sends exactly what
the browser sends.

**What this says about the tests.** All three lived in the seam. The front-end
suite mocked the server, the back-end suite never rendered a browser, and both
were green while the button did nothing. Some things have to be driven end to
end at least once — see the note in `CONTRIBUTING.md` under "Definition of
done".

---

## Fifth pass, second half: the site answered in the wrong language

Noticed while driving the sign-in flow: the sign-up form was in Russian, and the
moment the child pressed the button the whole site turned English.

- **Signing in reset the language to English.** `_resetAllStores()` runs on both
  sign-in and sign-out and calls `useUserStore.resetProgress()`, which set
  `language: 'ENG'` alongside clearing the lessons and the astronaut name.
  Language is a preference, not somebody's progress. It was being wiped every
  single sign-in and sign-out — on a product for Uzbek schoolchildren whose
  default should never have been English in the first place. Removed from the
  reset; the rest of it still clears, so nothing of one pupil's is shown to the
  next.
- **An empty translation turned into English.** `t()` used `if (value)`, which
  cannot tell an absent translation from a deliberately empty one. English
  splits "Welcome Back" across two keys so the second half can be coloured;
  Russian says it in one word, so `loginPage.welcomeHighlight` is `""` — and the
  sign-in screen read **"С возвращением Back"**. `t()` now falls back only on
  `undefined`/`null`.

Both verified in a browser afterwards: the sign-in screen reads "С
возвращением", the language survives signing in, and the home page comes up in
Russian rather than English.

Not a bug, checked and dismissed: the hero heading's `textContent` reads
"Исследуйтекосмос" with no space, because the words are separate elements and
the spacing is a CSS gap. It renders correctly.

Still true and worth knowing: `User.language` exists on the server, is editable
in the admin panel, and **nothing reads or writes it from the site**. The UI
language lives only in that browser's local storage, so it does not follow a
pupil to another device. Wiring it up is a small job and was left alone
deliberately — the owner asked for plain password sign-in to be solid before
anything gets built on top of it.

---

## Sixth pass: a lesson had no text, and could not be finished on a phone

Both found by opening the lesson screen in a browser with a real lesson in the
database, 24 August 2026.

**1. `TopicLesson.content` was never rendered.** The field has existed since ADR
0001, describes itself in the model as "Lesson text/markdown content", is
editable in the admin panel and is sent by the API. Nothing read it: the adapter
in `learnContent.js` dropped it, and `UniversalLessonView` used only the title
and the video URL. So an administrator could write a lesson, save it, open the
page and find their work nowhere on it — the exact defect ADR 0001 was written
to close, left behind when the tree was fixed.

A lesson body is **markdown**, which the field's own help text had already
decided; what was missing was the half that reads it. `LessonBody` renders it
with `react-markdown` and `remark-gfm`, styled to the existing dark theme:
headings, lists, bold, links, blockquotes, code blocks and tables. Lessons with
nothing written in them keep the generic line they had, so the 144 physics
titles do not become blank pages.

**Raw HTML is deliberately not rendered.** `react-markdown` ignores HTML nodes
unless `rehype-raw` is added, and it is not added. Lesson text is written by
administrators and read by ten-to-eighteen-year-olds; one mistaken paste, or one
borrowed admin account, should not put a script on every pupil's screen. There
is a test for it. If a lesson ever genuinely needs an embed, give it a field
with its own validation rather than opening that door.

**Cost:** the lesson chunk is 183 kB / 56 kB gzipped, of which roughly 40 kB
gzipped is the markdown machinery. It is lazy-loaded, so it is paid on the
lesson page and nowhere else. Dropping `remark-gfm` would save about 10 kB and
lose tables — a physics lesson listing units wants tables, so it stays.

**Two things deliberately not decided here.** Mathematical notation: a physics
curriculum will want formulas, and that means KaTeX and a decision about how
authors write them. And images: markdown `![]()` renders, but a lesson image has
nowhere to live yet — it would point at somebody else's host, which is the
problem that was just removed from `SpaceLabView`. Put lesson images in R2 with
a field of their own before encouraging them.

**2. A pupil on a phone could not finish a lesson.** The info section under the
video was an inline `gridTemplateColumns: '1fr 350px'`, and an inline style
cannot carry a media query. At 390px the second column ran from 315px to 665px
— entirely off the right edge — and that column holds the "finish lesson"
button, which is what awards the XP. It is `grid-cols-1 lg:grid-cols-[1fr_350px]`
now. Verified: the page no longer scrolls sideways at 390px and the button is
on screen.

Worth a look while somebody is in there: `CreativityTopicView` has the same
inline-grid shape at `1.2fr 1fr`. It does not run off the edge, because both
columns are fractional, but it gives a phone two very narrow columns.

---

## The deployment is gone, on purpose

Removed on 24 August 2026 at the owner's request, to be set up again from
scratch later. What is no longer in the repository:

| Gone | What it did |
|---|---|
| `backend/railway.json` | Build and start command: migrate → `ensure_superuser` → collectstatic → `gunicorn --workers 2` |
| `backend/runtime.txt` | Pinned Python 3.12.9 for the host's builder |
| `backend/base/settings/production.py` | `DEBUG=False`, HSTS, secure cookies, `X_FRAME_OPTIONS`, proxy SSL header, WhiteNoise, 60-minute access tokens |
| The `DJANGO_ENV` switch | Chose between the two settings modules, failing *closed* |
| `frontend/vercel.json` | Build, SPA rewrite, **and every security header the site had** |
| `ensure_superuser` | Created the first admin unattended, because the host had no console |
| `gunicorn`, `whitenoise` | WSGI server and static-file serving |
| CI's `Deployment checks` step | `manage.py check --deploy` |

`settings/__init__.py` now loads `development` and nothing else, which means
**`DEBUG` defaults to on**. That is fine on a laptop and is a takeover on a
public host: with `DEBUG=True` an unhandled error renders a page containing
`SECRET_KEY`, and the development module also opens CORS to everyone and prints
sign-in codes instead of mailing them. Nothing may be exposed to the internet
until the hardened module is back.

Four things must come back together, and it is worth reading this list before
starting rather than after:

1. **The environment switch, failing closed** — the permissive branch must be
   the one you have to ask for by name. See rule C-7 in `CONTRIBUTING.md`; the
   original form of this bug returned account sign-in codes in HTTP responses.
2. **The security headers.** They lived in `vercel.json`, not in the
   application, so they left with it: CSP, `X-Content-Type-Options`,
   `Referrer-Policy`, `Permissions-Policy`, frame options. The CSP was the
   restrictive kind — an explicit `connect-src` allow-list — so it needs the API
   origin written into it and will silently break every request if that is
   wrong. Putting them in the app instead would mean they cannot be lost again.
3. **A WSGI server and a way to serve static files.** `runserver` is neither.
4. **The first administrator.** `manage.py createsuperuser` needs a console on
   the running service; if the host has none, that command has to come back.

What was deliberately **kept**: Cloudflare R2 for uploaded files, and
`dj-database-url` + `psycopg2`, so a hosted database is one `DB_URL` away.

### Where the data lives right now

**Since 24 August 2026 `DB_URL` points at a shared Neon Postgres** (free tier,
Frankfurt, PostgreSQL 18) — so accounts, products, orders, messages and XP
totals are one database that all six developers share, not a file on one
machine. The schema is migrated and the content is seeded. The connection
string lives only in `backend/.env`, which is git-ignored; `backend/.env.team`
is the copy meant for handing out.

Leave `DB_URL` blank and Django falls back to `backend/db.sqlite3` — a file on
one machine, not backed up, not shareable, and the same file that caused the
credential exposure in Q1 when someone committed it.

R2 is separate and holds *files* — avatars and product photographs — while the
rows that reference them are in the database.

Two consequences of a shared database, both covered in `docs/TEAM.md`:
migrations are irreversible for everyone at once, and the test suite is pinned
to SQLite on purpose (`_running_tests` in `base/settings/base.py`) so that a
test run cannot drop the shared schema. The cost of that pin is that
Postgres-specific bugs do not show up in tests — one already slipped through,
a duplicate `_like` index in `courses.0003` — which is why CI runs the
migrations against a real Postgres 16 as a separate step.

---

## Things worth knowing before you touch anything

- **Design is deliberately parked.** The owner reviewed three ground options and
  chose to keep the current dark theme, made *warmer and lighter*, closer to the
  "observatory dusk" option — not the light editorial direction picked earlier
  in the conversation. Do not restart the redesign from a light ground.
  Comparison: <https://claude.ai/code/artifact/25974d1b-86cd-4426-af5f-0006126edc0c>
- **Two contracts the admin panel depends on.** Responses must stay bare arrays
  (the dashboard does `items.map(...)`; turning DRF pagination on empties every
  table silently), and it posts `sphere_id` / `topic_id`, not `sphere` / `topic`.
  Both are covered by tests in `apps/admin_api/tests.py`. The panel also posts
  no slug — `Topic` and `TopicLesson` derive one from the title on save, which
  is what keeps that contract working.
- **Editing content now changes the site.** That was the point of ADR 0001, and
  it means a mistake in the admin panel is visible immediately. `seed_learn_content`
  will not delete admin-authored rows unless you pass `--prune`.
- **Locale parity is enforced by CI** at 1017 keys across `en`/`uz`/`ru`.
- **The learn fixture is generated.** Edit `src/data/*TopicsData.js`, then run
  `npm run content:export` and commit the result, or CI fails.
- **`gltf-transform --texture-compress` fails on Windows** with a libvips
  colourspace error. Geometry compression works fine.
- **`CACHES` falls back to the database** when `REDIS_URL` is absent, and the
  table is created by a migration. Point `REDIS_URL` at a real Redis when there
  is one — the chat rate limits are cache-backed, and a database cache makes
  them slower than they need to be.
- **The profanity filter is a floor, not a solution.** It catches the lazy case
  and it has a documented limit (a swapped vowel) with a test of its own. What
  it misses is what the report queue is for, and the report queue only works if
  somebody reads it.

---

## Artifacts

- Audit report — <https://claude.ai/code/artifact/b80e12e0-2d30-48e7-8df3-1b86c2689067>
- Team handbook — <https://claude.ai/code/artifact/4a85e840-04bb-4b32-a7bc-418c4b648eb3>
  (same content as `CONTRIBUTING.md`)
- Ground comparison — <https://claude.ai/code/artifact/25974d1b-86cd-4426-af5f-0006126edc0c>
