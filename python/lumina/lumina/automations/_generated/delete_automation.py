from __future__ import annotations
from lumina._pydantic import GQLResult

class DeleteAutomation(GQLResult):
    result: DeleteAutomationResult

class DeleteAutomationResult(GQLResult):
    success: bool
DeleteAutomation.model_rebuild()
