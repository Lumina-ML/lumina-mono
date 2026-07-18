from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import TriggerFields

class CreateAutomation(GQLResult):
    result: CreateAutomationResult | None

class CreateAutomationResult(GQLResult):
    trigger: TriggerFields | None
CreateAutomation.model_rebuild()
CreateAutomationResult.model_rebuild()
