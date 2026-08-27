# ADR 0002 — How an account is proved

**Status:** accepted 28 August 2026
**Date:** 2026-08-28
**Decides:** how an e-mail address is confirmed, how a password is recovered, and
how signing in with Google works

---

## The problem

Registering and signing in worked. Nothing else about an account did.

There was no way to confirm an e-mail address, no way to reset a forgotten
password, and no way to change a password at all — `ProfileSerializer` accepts
neither `email` nor `password`, and `UserSerializer` is read-only throughout. A
child who forgot their password had lost the account and everything in it. The
only recovery anywhere was the passwordless sign-in code, which worked on the
server and which nothing in the front end called.

`User.email` was not unique either, which is survivable for a sign-in and fatal
for anything that treats an address as evidence of who somebody is.

The site is used by ten-to-eighteen-year-olds, and the decisions below are made
for them rather than for a general-purpose product.

---

## Codes, not links

Every flow — confirming an address, resetting a password, changing an address —
sends a six-digit code rather than a signed link.

**Why.** `apps/accounts/email_code.py` already existed, already used `secrets`,
constant-time comparison, counted attempts and a single-use cache entry, and
already had a test asserting `random.randint` has not come back. A second
mechanism is a second thing to get wrong. A link also needs a `FRONTEND_URL`,
which is the value most likely to be wrong per machine, and a code needs no URL
at all — so an unset one cannot break confirmation. And when mail printed to a
console, a code was typed while a link had to be copied out of a terminal.

**What it costs.** Six digits is less entropy than a signed token. It is bounded
by a 10-to-30-minute expiry, five wrong guesses, single use, and a per-account
rate limit — and it is the same mechanism this project already accepts for
passwordless sign-in, which is strictly the more dangerous of the two.

**The part that is not optional.** The purpose is in the cache key. Without that,
a code mailed out to confirm an address could be presented at the sign-in
endpoint for a token pair, and the weakest flow becomes a way into all of them.

**Alternative rejected:** `django.contrib.auth`'s reset token generator. It is
good, and it is link-shaped, and it would have meant two mechanisms.

---

## Google by ID token, not by authorisation code

The browser gets a signed assertion from Google's button and posts it to
`/auth/google/`. The server verifies signature, expiry and audience with
`google-auth`, and issues its own token pair.

**Why.** No client secret exists in this flow. That is the whole argument: a
repository that has already leaked a database has one fewer credential to leak,
the client id is public by design and safe in the bundle, and there is no
redirect URI to register for a project that is not deployed.

**Alternative rejected:** `django-allauth` or `social-auth-app-django` — roughly
twenty tables, `django.contrib.sites`, and a second authentication stack beside
SimpleJWT, for one button. Fifteen lines of `google-auth` do the same work.

**Alternative rejected:** `@react-oauth/google` on the front end. It is a wrapper
around the script we inject anyway, so it adds a dependency without removing the
third-party host.

**The accepted exception.** Google's script is loaded from
`accounts.google.com`. This project otherwise serves everything itself, after
`Earth3D` fetched Three.js from cdnjs and left the front page as a black circle
wherever cdnjs was slow, and there is a test that fails if certain files name an
outside host again. Google's button cannot be self-hosted — the script and the
origin are what the assertion is signed against. So: one script, loaded only on
the sign-in screens, and a failure to load leaves the password form working. When
the Content-Security-Policy comes back with the deployment, it needs
`accounts.google.com` in `script-src` and `connect-src`.

---

## The linking rule, and the account it protects

`email_verified` in the token must be true, or nothing happens. Every branch
below keys on the address, and one Google has not proved must not match an
account — nor become a match for somebody else later.

| What we find | What happens |
|---|---|
| A link on Google's `sub` | Sign in as that account. The address is not copied over, even if it changed. |
| An account holding that address, **confirmed** | Link it. Password untouched. |
| An account holding that address, **not confirmed** | Link it, confirm it, **clear its password**, revoke its sessions, and tell the client a password reset is needed. |
| Nothing | Create a student, with an unusable password and no date of birth. |

The third row is the one that needed deciding. Registration hands out tokens
immediately and confirms nothing, so anybody can make an account on a victim's
address and wait. When the victim signs in with Google they land in that
account — and whoever made it still knows the password.

Refusing instead would leave the victim with no way in at all, which is worse.
Clearing the password costs a real child one reset and costs an attacker the
account. Google has proved the address and controls the proof; the account has
proved nothing.

**`picture` is not taken.** Avatars here live in a bucket that is public and
unsigned, so copying one publishes a photograph of a child who did not choose to
upload it, to anyone who guesses the URL. Given and family name are taken —
registration asks for those anyway and chat already shows them. This is the C-11
decision, made deliberately.

---

## `role` grants nothing

`student`, `teacher`, `admin`, set by a superuser. Every existing gate still
reads `is_staff`.

Repointing `IsAdminUser`, `AdminWriteOrReadOnly`, the report queue and
`StaffRoute` at `role` is its own piece of work with its own test matrix, and
doing it in half the places is exactly how the answer key stayed readable in
three endpoints after being fixed in the fourth. There is also a second reason: a
role is a label typed into a form, and if setting it granted access, a
mislabelled pupil would be an administrator of a site used by children.

A test says a teacher can do nothing a student cannot. It is the test that fails
on the day somebody joins the two, which is the day to think about it.

---

## What this does not fix

**Access tokens cannot be revoked.** They are verified by signature with nothing
looked up, and they live eight hours. Every "everything else is signed out" here
means the refresh tokens were blacklisted, which caps whoever holds one at eight
more hours. `apps/accounts/tokens.py` says so in its docstring, and nothing in
this work claims more than that. Closing it needs a claim checked against the
account on every request — a change to how every endpoint authenticates, and its
own decision.

**Registration still issues tokens before the address is proved.** That is what
creates the linking edge above. Not issuing them is a larger change to the shape
of registration than this work took on; the mitigation is in the table.
