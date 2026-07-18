from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import TriggerFields

class UpdateAutomation(GQLResult):
    result: UpdateAutomationResult | None

class UpdateAutomationResult(GQLResult):
    trigger: TriggerFields | None
UpdateAutomation.model_rebuild()
UpdateAutomationResult.model_rebuild()
