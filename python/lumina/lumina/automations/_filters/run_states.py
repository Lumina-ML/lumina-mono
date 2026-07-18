from __future__ import annotations
from collections.abc import Iterable
from typing import TYPE_CHECKING, Annotated, Any
from pydantic import BeforeValidator, field_validator
from lumina._iterutils import always_list
from lumina._pydantic import GQLBase
from lumina.automations._validators import LenientStrEnum
from .expressions import FilterExpr
from .operators import BaseOp
if TYPE_CHECKING:
    from lumina.automations.events import EventType, RunStateFilter

class ReportedRunState(LenientStrEnum):
    RUNNING = 'RUNNING'
    FINISHED = 'FINISHED'
    FAILED = 'FAILED'
    CRASHED = FAILED

class StateFilter(GQLBase):
    states: Annotated[list[ReportedRunState], BeforeValidator(always_list)]

    @property
    def event_type(self) -> EventType:
        from lumina.automations import EventType
        return EventType.RUN_STATE

    @field_validator('states', mode='after')
    @classmethod
    def _dedup_and_order(cls, v: list[ReportedRunState]) -> list[ReportedRunState]:
        """Ensure states are deduplicated and predictably ordered."""
        return sorted(set(v))

    def __and__(self, other: Any) -> RunStateFilter:
        """Returns `(state_filter & run_filter)` as a `RunStateFilter`."""
        from lumina.automations.events import RunStateFilter
        if isinstance((run_filter := other), (BaseOp, FilterExpr)):
            return RunStateFilter(run=run_filter, state=self)
        return NotImplemented

    def __rand__(self, other: BaseOp | FilterExpr) -> RunStateFilter:
        """Ensures `&` is commutative, i.e. `(A & B) == (B & A)`."""
        return self.__and__(other)

class StateOperand(GQLBase):
    """Descriptor type, returned on accessing `RunEvent.state`.

    Necessary in order to handle constructing the custom structure for run state filters.
    """

    def __get__(self, obj: Any, objtype: type) -> StateOperand:
        return self

    def eq(self, state: str | ReportedRunState, /) -> StateFilter:
        """Returns a filter that watches for `run_state == state`."""
        return StateFilter(states=[state])

    def in_(self, states: Iterable[str | ReportedRunState], /) -> StateFilter:
        """Returns a filter that watches for `run_state in states`."""
        return StateFilter(states=states)

    def __eq__(self, other: Any) -> StateFilter:
        if isinstance(other, (str, ReportedRunState)):
            return self.eq(other)
        raise TypeError(f'Invalid operand type in run state filter: {type(other)!r}')
