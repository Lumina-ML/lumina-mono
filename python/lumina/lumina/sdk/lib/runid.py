"""runid util."""
import os
import random
import secrets
from string import ascii_lowercase, digits
_ID_CHARS = f'{ascii_lowercase}{digits}'
_random = random.Random()
if hasattr(os, 'fork'):
    os.register_at_fork(after_in_child=_random.seed)

def generate_id(length: int=8) -> str:
    """Generate a random base-36 string of `length` digits."""
    return ''.join((secrets.choice(_ID_CHARS) for _ in range(length)))

def generate_fast_id(length: int=8) -> str:
    """Faster alternative to `generate_id` if cryptographic strength isn't needed.

    In local testing at the time of implementation, this is ~30-50x faster than
    `generate_id` when generating 128-character IDs.

    Uses a dedicated Random instance to avoid being affected by global
    random.seed() calls from user code or libraries.
    """
    return ''.join(_random.choices(_ID_CHARS, k=length))
