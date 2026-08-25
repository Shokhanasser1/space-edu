# Credential exposure — 22 August 2026

**Status:** 25 August 2026 — the rewrite is **pushed**; step 3 is an accepted
risk, not an open emergency. What is left is the key rotation at the end of
step 1, which is worth doing regardless.

25 August 2026: the leaked file was opened and read, and the inventory below
was corrected against it. **It holds no data belonging to a minor, and no data
belonging to anyone but the repository owner.** The earlier claim that it did
is what made this document read as an emergency. See "What is actually in the
file" for the row-by-row evidence.

24 August 2026: step 2 is done and pushed — the blob is out of this clone's
history (`.git` 214 MB → 85 MB) and `main` matches `origin/main`.

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

757,760 bytes, a valid SQLite file — blob `973053284e6f78501b0b0500e8c7f28a7129f3fb`,
last carried by commit `0b9eb44` ("admin adding").

## What is actually in the file

Read out of the blob on 25 August 2026, not inferred. Every row of
`accounts_user`, with the birth date next to the date the account was created:

| id | username | `date_of_birth` | `date_joined` | what it is |
|---|---|---|---|---|
| 1 | `cosmonauttest` | NULL | 2026-04-29 | test |
| 4 | `yusuf` | 2000-05-15 | 2026-04-29 | 26 years old — "Yusuf Karimov", an invented name |
| 5 | `alisher` | 1995-03-10 | 2026-04-29 | 31 years old — "Alisher Navoi", an invented name |
| 7 | `shokhanasserp` | **2026-04-01** | 2026-04-29 | the owner's own account |
| 8 | `john.doe` | 1990-01-01 | 2026-05-01 | 36 years old, test |
| 9 | `qweqweqwe` | **2026-04-30** | 2026-05-01 | test |
| 10 | `qqq` | **2026-04-29** | 2026-05-01 | test |
| 12 | `qweqwe` | NULL | 2026-05-01 | **superuser**, admin@admin.admin |
| 13 | `admin1` | NULL | 2026-05-02 | **superuser**, admin1@admin.com |

**There is no minor in this file.** The three birth dates in bold are not birth
dates: each falls within days of the account's own `date_joined`, in the window
29 April – 1 May 2026. Someone born 2026-04-30 would be four months old. That
is a date picker defaulting to today and nobody changing it. The only three
values that are real birth dates are 2000, 1995 and 1990 — 26, 31 and 36 years
old.

The rest of the file:

| | |
|---|---|
| password hashes | 9 × `pbkdf2_sha256` — one per row, no plaintext |
| `django_session` | 2 rows |
| `chat_chatmessage` | 1 — "Assalomu alaykum, kosmoschilar!" |
| `chat_directmessage` | 1 — "asdasddsa" |
| everything else | seeded course content, no personal data |

**Whose data this is.** Six rows are throwaway tests, two are invented
characters, two are junk superusers. Exactly one address in the file belongs to
a real person, and it is the repository owner's own Gmail. Nobody else has
anything at stake here.

**The repository is public.** `github.com/Shokhanasser1/space-edu` reports
`visibility: public`, forking allowed. The earlier location,
`asilbekmurodqobilov05-hash/space-edu`, carried the same blob; if it still
exists it has to be dealt with as well.

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

## Step 3 — what the rewrite does not fix, and why it is being accepted

**GitHub keeps unreferenced objects reachable by SHA.** After a force-push, the
old commit is no longer on any branch, but
`github.com/<owner>/<repo>/commit/<sha>` and the API still serve it until
GitHub's garbage collection runs, which is not on a schedule you control.

Verified still true on 25 August 2026 — commit `96f47a4` answers, and three
`db.sqlite3` blobs download by SHA:

```
973053284e6f78501b0b0500e8c7f28a7129f3fb   757,760 bytes
17a71b652b43f55f8b0e5476a9a5c1a2293400d2   724,992 bytes
c03458179deeb761dcc4d105cceca46c28106930   360,448 bytes
```

**Decision, 25 August 2026: accepted risk. Do not re-open this without a new
fact.** Reading the file is what settled it — see "What is actually in the
file". The only real personal datum in it belongs to the repository owner, and
the two superuser accounts authenticate against nothing: there is no
deployment, and the shared database is a different Postgres with a different
superuser. Retrieving any of it requires knowing a 40-character SHA that
appears on no branch and in no clone taken after the rewrite. Weighed against
losing the commit history, the branch protection and the collaborator list,
that is not worth spending.

If a new fact turns up — a fork appears, the old
`asilbekmurodqobilov05-hash/space-edu` is found to still exist, or real user
accounts are ever written to a database that gets committed — the two ways to
actually close it are:

1. **Ask GitHub Support** to purge the cached views, quoting the repository and
   saying credentials were exposed. This is the documented route and they do it.
   Keeps the URL, the history, the PRs and the protection rules.
2. **Delete and recreate the repository.** Certain, and note it has to be a
   fresh repository built from the current tree, not a push of the existing
   history, which is what happened last time and is why the blob is still here.
   Costs the history, and means re-inviting the four collaborators and
   rebuilding branch protection and CI.

**Forks would keep a full copy.** There are 0 today. That is the single check
worth repeating: if a fork appears, this decision no longer holds, because the
fork's owner has a complete copy and only they can delete it.

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
