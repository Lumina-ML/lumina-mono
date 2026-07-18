"""UUID v7 generator.

UUID v7 layout:
- 48 bits: Unix timestamp in milliseconds
- 4 bits: version (0111)
- 12 bits: rand_a
- 2 bits: variant (10)
- 62 bits: rand_b

This gives time-ordered, globally unique IDs without a central coordinator.
"""

import secrets
import time
import uuid


def uuid_v7() -> str:
    """Generate a UUID v7 string."""
    timestamp = int(time.time_ns() // 1_000_000)
    rand_a = secrets.randbits(12)
    rand_b = secrets.randbits(62)

    # Build 128-bit integer
    value = (timestamp & 0xFFFFFFFFFFFF) << 80
    value |= 0x7 << 76  # version
    value |= (rand_a & 0xFFF) << 64
    value |= 0x2 << 62  # variant
    value |= rand_b & 0x3FFFFFFFFFFFFFFF

    return str(uuid.UUID(int=value))


def is_valid_uuid_v7(value: str) -> bool:
    """Check if a string is a valid UUID v7."""
    try:
        u = uuid.UUID(value)
    except ValueError:
        return False
    # Version nibble must be 7
    if (u.int >> 76) & 0xF != 7:
        return False
    # Variant bits must be 10
    if (u.int >> 62) & 0x3 != 2:
        return False
    return True
