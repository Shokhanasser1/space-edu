# Working as six

Six people, one repository, one database. `CONTRIBUTING.md` covers how to write
the code; this covers how six people write it at the same time without
overwriting each other.

---

## The shape of it

```
you pull -> you write it -> you run the checks -> you push to main -> the lead reads it
```

**You push straight to `main`.** No branch to create, no pull request to open,
nobody to wait for. That is deliberate: someone learning to program should spend
the day on the code, not on the ceremony around it.

Your whole workflow, start to finish:

```bash
git pull --rebase origin main    # start from what everybody else already has
#  ... write the code, run the checks ...
git add -A
git commit -m "fix: the lesson page showed yesterday's progress"
git push origin main
```

If the push is rejected as *behind*, somebody pushed while you were working:
`git pull --rebase origin main`, run your tests again, push again. That is the
only failure mode of this flow, and it is thirty seconds.

**What this costs, said plainly.** Nothing now stands between a broken commit
and everybody else's clone. The check did not disappear — it moved to *after*
the push: the lead reads what lands and fixes or reverts it. A mistake is a
five-minute conversation, not a disaster. Read "Before you push" below anyway;
being trusted is the reason to be careful, not the reason to stop being.

**Branches still exist, and are still the right tool** for anything large,
anything you want read before it lands, and anything touching authentication,
payments, personal data or migrations. Branch, push the branch, open a pull
request, ask for eyes on it. `type/short-description` — `fix/logout-401`,
`feat/lesson-markdown`. One branch, one subject. Rebase rather than merge while
it is open (`git fetch origin && git rebase origin/main`), and keep it short: a
branch that lives a day conflicts with nothing, one that lives three weeks
conflicts with everything.

## Before you push

None of this is enforced by anything. The lead reads every commit by hand; this
is the list that makes that reading short, and it is thirty seconds of care in
exchange for nobody standing between you and five other people's work:

1. **Run what CI runs** — the block in `CONTRIBUTING.md`, Part 3. Nothing stops
   you pushing without it. It is how you find out you broke something before
   five other people do.
2. **Read your own diff.** `git diff --staged`. Half of all mistakes are visible
   in it: a `console.log`, a commented-out block, a file you did not mean to add.
3. **One thing per commit.** Small commits are easy to read and easy to revert on
   their own when one of them turns out to be wrong.
4. **Never `.env`, a password or a key.** GitHub blocks nothing here; that
   mistake is the one that cannot be taken back. See
   `docs/SECURITY-INCIDENT-2026-08-22.md`.
5. **Never `git push --force`** to `main`. GitHub still refuses it, and the day
   it does not, it destroys somebody else's work.
6. **Say it in the daily message** when you push something big — and *before*
   you generate a migration, always.

---

## What is protected, and what it means for you

Very little, on purpose. On `main`:

| Rule | What you will see |
|---|---|
| Anyone with write access may push | `git push origin main` simply works. No pull request, no approval, no waiting for CI. |
| CI still runs on every push | It reports; it no longer blocks. Watch your own: `gh run watch`, or the tick next to your commit on GitHub. |
| No force-push | `main` cannot be rewritten. This one stays, because this is the one that loses other people's work. |
| No deletion | `main` cannot be removed. |

Nothing else. Required pull requests, required approvals, required status checks
and required conversation resolution were all switched off on 27 August 2026,
when the team grew with people who are learning as they go. Two rules are left,
and neither of them will ever refuse an ordinary push.

The process was costing more than the mistakes it caught, and a beginner blocked
on "Review required" learns nothing while they wait. The checking did not stop
— the lead now reads what lands, by hand.

**The trade is real and worth naming.** Before this, everything on `main` had
been through CI and a second pair of eyes. Now `main` can be red, and the person
who notices is the next person to pull. If that starts happening weekly rather
than rarely, put the checks back — the flow is a choice, not a law:

```bash
gh api -X PUT repos/Shokhanasser1/space-edu/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": false,
    "contexts": ["Backend tests", "Frontend build", "Repository hygiene"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true, "required_approving_review_count": 1 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```

That is the exact state this repository ran on until 27 August 2026, so putting
it back is one command and loses nothing.

To see what is set at any time:

```bash
gh api repos/Shokhanasser1/space-edu/branches/main/protection
```

`.github/CODEOWNERS` no longer gates anything — with no required review there is
nothing for it to require. Read it as the map it now is: who owns which part,
and therefore who to tell when you touch it. Settings, authentication, chat
moderation, CI and migrations are the lead's whoever else works around them — a
mistake in those is not visible in the diff, it is visible in what stops being
true afterwards.

---

## The database is shared

One Postgres, everybody's `DB_URL` pointing at it. Content written in the admin
panel is there for everyone the moment it is saved, which is the point.

Neon, free plan, `eu-central-1` (Frankfurt), PostgreSQL 18. **The connection
string is a password and does not belong in this file, in a commit, or in a
chat** — the lead hands it out directly, and each person puts it in their own
`backend/.env`, which is git-ignored and which CI fails the build over if it is
ever committed.

What the free plan gives, and what it means in practice:

| | |
|---|---|
| 0.5 GB storage | The whole content tree plus accounts is 11 MB. Not a constraint; images live in R2, not here. |
| 100 CU-hours a month | About 400 hours at the smallest compute size. Pin autoscaling at 0.25–0.5 CU in the Neon console, or a load spike burns them faster than a working month needs. |
| Suspends after 5 min idle | Wakes on the next query in about a second. The first request after lunch feels slow; that is all it is. |
| Up to 10 branches | A branch is a copy-on-write clone of the data. This is the escape hatch for the migration rule below: branch, break it, throw the branch away. |

### Uploaded files go to Cloudflare R2

The database holds rows; the files those rows point at live in an R2 bucket,
shared the same way. Four fields put files there: `User.avatar`,
`MarketItem.image`, `NewsArticle.image` and `SpaceEvent.image`.

Without it they would land in `backend/media/` on whichever laptop ran the
server, and everybody else would see a broken image where a row says there is a
picture. Verified end to end on 24 August 2026: uploaded through a model field,
fetched over the public URL with no credentials, deleted again.

Two things worth knowing:

- **The stored filename is not the uploaded one.** `image_upload_to` renames
  every upload to a UUID. That is deliberate — the served `Content-Type` is
  derived from the name, and a file called `avatar.html` was once stored under
  exactly that name in a public bucket. Do not "fix" it.
- **The bucket is public and unsigned** (`AWS_QUERYSTRING_AUTH = False`), so
  anything uploaded is readable by anyone with the URL. Fine for lesson art and
  product pictures. Not a place for anything private.

It also means one person can ruin everyone's afternoon.

### Rules

1. **Only the lead runs `migrate` against the shared database, and only from
   `main` after the migration has merged.** Test your migration locally first —
   unset `DB_URL` and you are on your own SQLite file in seconds.
2. **Never run a destructive command against it.** `flush`,
   `seed_learn_content --prune`, `rotate_leaked_credentials`, an unfiltered
   `delete()` in `manage.py shell`. If you are about to type one, you want your
   local database, not this one.
3. **Never point a deployed thing at it.** This is a development database. It
   holds throwaway accounts and half-written lessons.
4. **Back it up before anything structural.** A month of admin-authored content
   lives only here:

   ```bash
   python manage.py dumpdata courses gamification market news events --natural-foreign --indent 2 > ../backup.json
   ```

### Tests never touch it

`manage.py test` is pinned to SQLite whatever `DB_URL` says — the
`_running_tests` guard in `base/settings/base.py`, held by two tests in
`base/tests.py`. Without it, the first thing a new developer does after setting
`DB_URL` is run the suite, and Django's runner CREATEs and DROPs a database of
its own; two people running tests at once collide on the same one.

### Working without it

Unset `DB_URL` and you are on `backend/db.sqlite3`, alone:

```bash
python manage.py migrate
python manage.py seed_learn_content   # the whole /learn tree, from the fixture
python manage.py createsuperuser
```

Do that for anything structural, anything you are unsure of, and any time you
are on a train. The learn content is committed as a fixture precisely so a local
database is one command from being useful.

### Why the migration rule is the strict one

Everything else a shared database does wrong is recoverable. Migrations are
state the database remembers. Two people generating migrations in parallel
branches produce two `0007_` files with the same parent; merged, Django has two
leaf nodes and no way to order them. CI catches it — the suite runs migrations —
but only after both have merged, and the fix is then a hand-written merge
migration. Cheaper to serialise: say so in the daily message before you generate
one.

---

## Not standing on each other's files

Most conflicts are not bad luck. They come from long branches, from two people
sent at the same area without knowing, and from files that should never be
merged by hand.

**Areas.** `CONTRIBUTING.md` Part 4 splits the work five ways and
`.github/CODEOWNERS` encodes it. Work inside your area by default; when you have
to reach outside it, say so in the PR so its owner reads that part properly.

**Files nobody merges by hand — regenerate instead:**

| File | On a conflict |
|---|---|
| `frontend/package-lock.json` | Take `main`'s, run `npm install`, commit |
| `backend/apps/courses/fixtures/learn_content.json` | Take either, run `npm run content:export`, commit |

Both are marked `linguist-generated` in `.gitattributes`, so they stay collapsed
in a review.

**The three locale files** are the most-touched files here and the easiest place
to collide. Add keys in the section they belong to rather than at the end, add
to all three in the same commit, and keep locale-only changes in their own small
PR. `npm run check:locales` fails the build if the three drift apart — 1026
keys, exact parity.

**Line endings and whitespace** are settled by `.gitattributes` and
`.editorconfig`. If your editor still reformats a whole file you touched two
lines of, fix the editor before opening the PR: a diff claiming 400 changed
lines cannot be reviewed, and it will conflict with everything.

---

## Your credentials

The lead sends you one file: **`.env.team`**. It carries the two things the team
genuinely shares — the connection string for the database, and the keys for the
R2 bucket where uploads live. Put it in `backend/`, rename it to `.env`, and it
is done.

One line in it is blank on purpose:

```
SECRET_KEY=
```

**Generate your own. Do not ask anybody for theirs.**

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

This is not about trust. `SECRET_KEY` signs sessions and JWTs, and everyone runs
their own server: sharing one means a token minted on your laptop is valid on
everybody else's. Harmless while it stays on six laptops, and a way to forge any
pupil's session the day the same key reaches a deployed server — including for
whoever had the file and has since left. It costs one command to avoid.

The front end needs its own file too, and it holds no secrets at all:

```bash
cd frontend
copy .env.example .env.local
```

### The rules around it

- **`.env` never goes in a commit.** It is in `.gitignore`, and the `hygiene`
  job fails the build if one is ever tracked. That check exists because a
  database *was* committed once — see `docs/SECURITY-INCIDENT-2026-08-22.md`.
- **Do not paste it into a group chat**, and do not screenshot it. Not because
  of the people in the chat: because the chat outlives the project, and so does
  everyone's copy of it. If you lose the file, ask the lead for it again.
- **`DB_URL` is the owner of the database.** Anybody holding it can drop the
  schema. That is why the migration rule above is the one written in bold.
- **The R2 keys are shared by all six.** If your laptop is lost or stolen, say
  so the same day: those keys have to be replaced for everybody, and that is a
  five-minute job if it happens on the day and a much worse one later.
- **Leaving the project?** Tell the lead so the credentials get rotated. No
  drama in it — it is the same reason an office takes the key back.

---

## Day one

```bash
git clone https://github.com/Shokhanasser1/space-edu.git
cd space-edu
```

Backend:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy ..\.env.team .env         # the file the lead sent you; see "Your credentials"
python manage.py runserver      # the shared database is already migrated and seeded
```

Only if you are working on your own SQLite instead, with `DB_URL` left blank:

```bash
python manage.py migrate
python manage.py seed_learn_content
python manage.py createsuperuser
```

Frontend, second terminal:

```bash
cd frontend
npm ci
copy .env.example .env.local    # VITE_API_URL=http://localhost:8000/api/v1
npm run dev
```

Then, before writing anything, run what CI runs:

```bash
cd backend  && python manage.py test apps base
cd backend  && python manage.py makemigrations --check --dry-run
cd frontend && npm run lint
cd frontend && npm run build && npm test
cd frontend && npm run check:locales && npm run content:check
```

Green on a fresh clone means your setup is right, and anything that breaks later
is yours.

---

## The linter

`npm run lint`. **Errors fail the build; warnings do not.** On arrival it
reported 249 problems, so the bar is set where it can be held: zero errors, and
the warnings as a backlog. Drive them down, and promote a rule to error once its
count reaches zero — a check that is red on arrival teaches everyone to ignore
it.

The React Compiler rules shipped with `eslint-plugin-react-hooks` v7 are off on
purpose: they fire 61 times, almost all of it react-three-fiber code mutating
refs inside `useFrame`, which is how that library is meant to be used. Read them
against the Three.js code specifically before switching them on.

---

## When something does go wrong on `main`

Roll back first, diagnose second. `git revert <sha>` — the revert is an ordinary
commit, so it goes straight to `main` like anything else — then work out what
happened. `main` being green matters more than anybody's afternoon, and
reverting somebody's commit is not an insult. It is the cheapest tool here, and
now that everybody pushes directly, it is the one that keeps the flow safe.
