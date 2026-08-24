# Working as six

Six people, one repository, one database. `CONTRIBUTING.md` covers how to write
the code; this covers how six people write it at the same time without
overwriting each other.

---

## The shape of it

```
you branch -> you push -> you open a PR -> CI runs -> the lead reviews -> it merges
```

Nobody pushes to `main`. Not as a courtesy — the branch is protected and the
push is refused. That is the whole mechanism behind "one person cannot break
another's work": everything reaching `main` has been through CI and through a
second pair of eyes.

**Branch names.** `type/short-description`, where type is one of the commit
types: `feat fix refactor docs test chore perf ci`. So `fix/logout-401`,
`feat/lesson-markdown`. One branch, one subject.

**Keep branches short.** A branch that lives a day conflicts with nothing. A
branch that lives three weeks conflicts with everything, and no process fixes
that. If a piece of work is bigger than a few days, split it into merges that
each stand on their own.

**Rebase, do not merge, while your branch is open:**

```bash
git fetch origin
git rebase origin/main
```

That keeps `main` readable: every commit on it is a merged pull request rather
than a thicket of "Merge branch 'main' into...".

---

## What is protected, and what it means for you

On `main`:

| Rule | What you will see |
|---|---|
| Pull request required | `git push origin main` is refused. Branch and open a PR. |
| One approval required, from a code owner | The PR says "Review required" until the lead approves. |
| Stale approvals dismissed on new commits | Push a fix after approval and it needs approving again. |
| CI must pass | "Backend tests", "Frontend build" and "Repository hygiene" must be green. |
| Branches need not be up to date | Set on purpose: GitHub runs CI against your branch *merged into* `main`, so a semantic clash is caught anyway, and requiring a rebase before every merge puts six people in a queue. |
| Conversations must be resolved | Every review comment answered or fixed before merge. |
| No force-push, no deletion | `main` cannot be rewritten or removed. |

**One exemption, and it is deliberate.** Administrators are not blocked by these
rules (`enforce_admins: false`). With the lead as the only code owner, turning it
on would leave the lead unable to merge anything at all — GitHub does not let
anyone approve their own pull request, and there would be nobody else who could.
So the rules bind the five; the lead is on their honour, and should still work
through pull requests.

The day a second person can review — a senior developer, or two area owners who
cover each other — close the exemption:

```bash
gh api -X POST repos/Shokhanasser1/space-edu/branches/main/protection/enforce_admins
```

To check what is set at any time:

```bash
gh api repos/Shokhanasser1/space-edu/branches/main/protection
```

`.github/CODEOWNERS` decides whose approval counts. Today that is the lead on
everything, with per-area owners to fill in as people take theirs. Settings,
authentication, chat moderation, CI and migrations stay with the lead whoever
else owns the area around them — a mistake in those is not visible in the diff,
it is visible in what stops being true afterwards.

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
copy .env.example .env          # SECRET_KEY, and DB_URL if you are on the shared database
python manage.py migrate        # only when you are on your own SQLite
python manage.py seed_learn_content
python manage.py runserver
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

Roll back first, diagnose second. `git revert` the merge commit, open a PR for
it like anything else, then work out what happened. `main` being green matters
more than anybody's afternoon.
