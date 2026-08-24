# Credential exposure — 22 August 2026

**Status:** open, one step left. 24 August 2026: step 2 is **done locally** —
the blob is out of this clone's history — but the rewrite has not been pushed,
so the public repository is unchanged and step 3 has not started.

Step 1 turned out not to apply: there is no database anywhere any more. No
`backend/db.sqlite3` on this machine, and nothing deployed. The accounts in the
leak exist only inside the leaked file itself, so there is nothing for
`rotate_leaked_credentials` to rotate. What still has to be rotated by hand is
everything that lives outside the database — see the end of step 1.

---

## What happened

`backend/db.sqlite3` was committed and later deleted in a commit titled
"fix: remove database from git tracking". Deleting a file in a later commit
removes it from the working tree, not from history: until the rewrite below,
anyone with a clone could recover it with a single `git show` of the parent
commit. That is still true of every clone taken before the rewrite is pushed,
and of the copy GitHub is serving right now.

757,760 bytes, a valid SQLite file. It contains:

| | |
|---|---|
| `accounts_user` | 9 rows |
| password hashes | 12 × `pbkdf2_sha256` |
| **superusers** | **2** — `qweqwe` / admin@admin.admin, `admin1` / admin1@admin.com |
| personal data | email addresses and dates of birth, including of minors |
| `django_session` | 2 rows |

**The repository is public.** `github.com/Shokhanasser1/space-edu` reports
`visibility: public`, forking allowed. Anyone who clones it has this file. This
is not a hypothetical risk; treat every credential in it as known to third
parties. The earlier location, `asilbekmurodqobilov05-hash/space-edu`, carried
the same blob; if it still exists it has to be dealt with as well.

Some of the rows look like throwaway test accounts (`qwe`, `qqq`, `john.doe`).
Two do not: a personal Gmail address, and both superusers.

---

## Step 1 — do this first, it needs nothing else

Rotating the credentials is what actually ends the exposure. It is independent
of anything to do with git, and it should not wait for the history rewrite.

This used to be a copy-paste `manage.py shell` session. It is now one command,
so it is repeatable, reports what it did, and cannot be half-applied by a typo
in the middle:

```bash
cd backend

python manage.py rotate_leaked_credentials --dry-run   # read the report first
python manage.py rotate_leaked_credentials
```

It does three things, in one transaction:

1. `set_unusable_password()` on every non-superuser account in the leak. The old
   hash stops verifying, so the leaked copy is worthless, and the account is not
   deleted — it comes back through the e-mail sign-in flow.
2. Deletes every `django_session` row.
3. Blacklists every outstanding JWT refresh token.

Running it a second time is safe and reports `Accounts locked out: 0`.

### The part it will not do for you

**Superuser passwords.** The command lists them and stops:

```bash
python manage.py changepassword qweqwe
python manage.py changepassword admin1
```

A password the command generated would have to be printed to be usable, which
puts a live credential into a terminal scrollback and a CI log. So it refuses.

**Everything that lives outside the database.** Rotate these by hand: the
`SECRET_KEY` (rotating it invalidates every existing session and JWT, which is
what we want here), the Cloudflare R2 keys, and `GEMINI_API_KEY`. If the same
password was reused anywhere else — the GitHub account itself, any hosting or
mail account — change it there too.

Covered by `apps/accounts/tests_incident.py`.

---

## Step 2 — remove the blob from history

Nothing is blocking this any more: `fix/audit-critical` is merged and `main`
is the only branch. Rewriting history renames every commit, so anyone holding a
clone has to re-clone afterwards — tell them before, not after.

### What was run, 24 August 2026

```bash
pip install git-filter-repo

git bundle create ../space-edu-BACKUP-before-rewrite.bundle --all   # 167 MB
git filter-repo --force   --invert-paths --path backend/db.sqlite3   --strip-blobs-with-ids blobs-to-strip.txt
```

`--strip-blobs-with-ids` took a list of 23 blob ids, computed as *every blob
over 1 MB in the whole history that is not reachable from the current commit* —
the superseded originals of the star photographs and the `.glb` models, 171 MB
between them.

**That list is the safe way to do it, and the obvious way is not.** An earlier
draft of this document suggested

```bash
git filter-repo --invert-paths --path-glob 'frontend/public/models/**/*.glb'
```

which would have deleted the fifteen `.glb` files the game currently uses, from
every commit including the latest — a path glob does not know the difference
between a superseded blob and a live one. Selecting by blob id does.

Result:

| | Before | After |
|---|---|---|
| `.git` | 214 MB | 85 MB |
| Commits | 99 | 97 |
| `db.sqlite3` blobs in history | 17 | 0 |

The two commits that disappeared contained nothing but the database, so
removing it left them empty and `filter-repo` pruned them. The working tree is
byte-for-byte identical — the top commit's tree hash is unchanged
(`b726d387`), which is the check worth repeating after any rewrite.

The backup bundle restores the pre-rewrite repository in full:
`git clone space-edu-BACKUP-before-rewrite.bundle`.

### What is left

```bash
git push --force --all
git push --force --tags
```

Then everyone else re-clones. **Do not merge an old clone back in** — it would
reintroduce the whole rewritten history, database included, which is exactly
how the blob survived the move between repositories.

---

## Step 3 — what the rewrite does not fix

**GitHub keeps unreferenced objects reachable by SHA.** After a force-push, the
old commit is no longer on any branch, but
`github.com/<owner>/<repo>/commit/<sha>` and the API still serve it until
GitHub's garbage collection runs, which is not on a schedule you control.

Two ways to close that:

1. **Ask GitHub Support** to purge the cached views, quoting the repository and
   saying credentials were exposed. This is the documented route and they do it.
2. **Delete and recreate the repository.** Fastest and certain — and note it
   has to be a fresh repository built from the current tree, not a push of the
   existing history, which is what happened last time and is why the blob is
   still here. Costs the stars, the issues and the watch list — currently
   0 stars, 0 issues, 0 forks, so the cost here is nothing.

**Forks would keep a full copy.** There are 0 today. Check again before you
start; if one has appeared, the fork's owner has to delete it themselves.

---

## Why this happened, and what stops the next one

`.gitignore` listed `backend/db.sqlite3`, but a file that is *already tracked*
stays tracked — `.gitignore` only affects untracked files. Nobody ran
`git rm --cached`.

**It nearly happened a second time.** The commit titled "project update repo" deleted the root
`.gitignore` outright, so `backend/db.sqlite3`, `backend/.env` and every
`__pycache__` directory were untracked *and unignored* — one `git add -A` from
being committed again, with the R2 keys and `SECRET_KEY` this time. Restored on
24 August 2026. If it goes missing again, that is the thing to fix first.

CI now fails the build if a `.env` or a `*.sqlite3` is tracked, if compiled
Python is tracked, if a `VITE_*` secret has a value outside `.env.example`, or
if something matching an API key pattern is committed. See the `hygiene` job in
`.github/workflows/ci.yml`.
