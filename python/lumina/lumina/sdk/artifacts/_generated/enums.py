from __future__ import annotations
from enum import Enum

class ArtifactCollectionState(str, Enum):
    DELETED = 'DELETED'
    READY = 'READY'

class ArtifactCollectionType(str, Enum):
    PORTFOLIO = 'PORTFOLIO'
    SEQUENCE = 'SEQUENCE'

class ArtifactState(str, Enum):
    COMMITTED = 'COMMITTED'
    DELETED = 'DELETED'
    PENDING = 'PENDING'
