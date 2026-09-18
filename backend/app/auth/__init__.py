"""Authentication package.

Layout:
    passwords.py  bcrypt hashing + policy
    tokens.py     HS256 session tokens issued by this service
    firebase.py   Admin SDK + Identity Toolkit integration
    service.py    register / authenticate / change password
    deps.py       FastAPI dependencies

See `service.py` for why password verification is pluggable.
"""

from .deps import CurrentUser, OptionalUser, current_user, optional_user
from .service import AuthError
from .tokens import TokenError, issue_session

__all__ = [
    "AuthError",
    "CurrentUser",
    "OptionalUser",
    "TokenError",
    "current_user",
    "issue_session",
    "optional_user",
]
