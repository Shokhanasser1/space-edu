"""Settings entry point.

There is one environment right now: local development. The hardened module and
the switch that chose between them went with the rest of the deployment
configuration, and have to come back together — a switch with nothing to switch
to is worse than no switch, because it reads as if there were a safe mode when
there is not.

Whatever replaces this has to fail *closed*, in the sense of rule C-7 in
CONTRIBUTING.md: the permissive branch is the one you have to ask for by name.
Written the other way round, as it was, a typo or an unset variable silently
booted development — DEBUG on, CORS open to everyone, and the e-mail sign-in
code returned in the response body.
"""
from .development import *  # noqa: F401,F403
