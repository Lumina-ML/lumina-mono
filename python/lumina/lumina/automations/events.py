"""Events that trigger W&B Automations."""
from __future__ import annotations
from typing import TYPE_CHECKING, Annotated, Any, Literal, get_args
from pydantic import AfterValidator, BeforeValidator, Discriminator, Field
from lumina._pydantic import GQLBase, model_validator, pydantic_isinstance
from lumina._strutils import nameof
from ._filters import And, MongoLikeFilter
from ._filters.expressions import FilterableField
from ._filters.run_metrics import MetricChangeFilter, MetricThresholdFilter, MetricVal, MetricZScoreFilter
from ._filters.run_states import StateFilter, StateOperand
from ._generated import FilterEventFields
from ._validators import JsonEncoded, LenientStrEnum, ensure_json, parse_scope, wrap_mutation_event_filter, wrap_run_filter
from .actions import InputAction, InputActionTypes, SavedActionTypes
from .scopes import ArtifactCollectionScope, AutomationScope, EntityScope, ProjectScope
if TYPE_CHECKING:
    from .automations import NewAutomation

class EventType(LenientStrEnum):
    """The type of event that triggers an automation."""
    UPDATE_ARTIFACT_ALIAS = 'UPDATE_ARTIFACT_ALIAS'
    CREATE_ARTIFACT = 'CREATE_ARTIFACT'
    ADD_ARTIFACT_ALIAS = 'ADD_ARTIFACT_ALIAS'
    ADD_ARTIFACT_TAG = 'ADD_ARTIFACT_TAG'
    REMOVE_ARTIFACT_TAG = 'REMOVE_ARTIFACT_TAG'
    ADD_COLLECTION_TAG = 'ADD_COLLECTION_TAG'
    REMOVE_COLLECTION_TAG = 'REMOVE_COLLECTION_TAG'
    LINK_ARTIFACT = 'LINK_MODEL'
    UNLINK_ARTIFACT = 'UNLINK_ARTIFACT'
    RUN_METRIC_THRESHOLD = 'RUN_METRIC'
    RUN_METRIC_CHANGE = 'RUN_METRIC_CHANGE'
    RUN_METRIC_ZSCORE = 'RUN_METRIC_ZSCORE'
    RUN_STATE = 'RUN_STATE'

class _WrappedSavedEventFilter(GQLBase):
    filter: JsonEncoded[MongoLikeFilter] = And()

class _WrappedMetricThresholdFilter(GQLBase):
    event_type: Annotated[Literal[EventType.RUN_METRIC_THRESHOLD], Field(exclude=True, repr=False)] = EventType.RUN_METRIC_THRESHOLD
    threshold_filter: MetricThresholdFilter

    @model_validator(mode='before')
    @classmethod
    def _nest_inner_filter(cls, v: Any) -> Any:
        if pydantic_isinstance(v, MetricThresholdFilter):
            return cls(threshold_filter=v)
        return v

class _WrappedMetricChangeFilter(GQLBase):
    event_type: Annotated[Literal[EventType.RUN_METRIC_CHANGE], Field(exclude=True, repr=False)] = EventType.RUN_METRIC_CHANGE
    change_filter: MetricChangeFilter

    @model_validator(mode='before')
    @classmethod
    def _nest_inner_filter(cls, v: Any) -> Any:
        if pydantic_isinstance(v, MetricChangeFilter):
            return cls(change_filter=v)
        return v

class _WrappedMetricZScoreFilter(GQLBase):
    event_type: Annotated[Literal[EventType.RUN_METRIC_ZSCORE], Field(exclude=True, repr=False)] = EventType.RUN_METRIC_ZSCORE
    zscore_filter: MetricZScoreFilter

    @model_validator(mode='before')
    @classmethod
    def _nest_inner_filter(cls, v: Any) -> Any:
        if pydantic_isinstance(v, MetricZScoreFilter):
            return cls(zscore_filter=v)
        return v

class RunMetricFilter(GQLBase):
    run: Annotated[JsonEncoded[MongoLikeFilter], AfterValidator(wrap_run_filter), Field(alias='run_filter')] = And()
    'Filters that must match any runs that will trigger this event.'
    metric: Annotated[_WrappedMetricThresholdFilter | _WrappedMetricChangeFilter | _WrappedMetricZScoreFilter, Field(alias='run_metric_filter')]
    'Metric condition(s) that must be satisfied for this event to trigger.'
    legacy_metric_filter: Annotated[JsonEncoded[MetricThresholdFilter] | None, Field(alias='metric_filter', deprecated=True)] = None
    'Deprecated legacy field for defining run metric threshold events.\n\n    For new automations, use the `metric` field (JSON alias `run_metric_filter`).\n    '

    @model_validator(mode='before')
    @classmethod
    def _nest_metric_filter(cls, v: Any) -> Any:
        if pydantic_isinstance(v, (MetricThresholdFilter, MetricChangeFilter, MetricZScoreFilter)):
            return cls(metric=v)
        return v

class RunStateFilter(GQLBase):
    """Represents a filter for triggering events based on changes in run states."""
    run: Annotated[JsonEncoded[MongoLikeFilter], AfterValidator(wrap_run_filter), Field(alias='run_filter')] = And()
    'Filters that must match any runs that will trigger this event.'
    state: Annotated[StateFilter, Field(alias='run_state_filter')]
    'Run state condition(s) that must be satisfied for this event to trigger.'

    @model_validator(mode='before')
    @classmethod
    def _nest_state_filter(cls, v: Any) -> Any:
        if pydantic_isinstance(v, StateFilter):
            return cls(state=v)
        return v

class SavedEvent(FilterEventFields):
    """A triggering event from a saved automation."""
    event_type: Annotated[EventType, Field(frozen=True)]
    filter: JsonEncoded[_WrappedSavedEventFilter | RunMetricFilter | RunStateFilter]
    'The condition(s) under which this event triggers an automation.'

class _BaseEventInput(GQLBase):
    event_type: EventType
    scope: AutomationScope
    'The scope of the event.'
    filter: JsonEncoded[Any]

    def then(self, action: InputAction) -> NewAutomation:
        """Define a new Automation in which this event triggers the given action."""
        from .automations import NewAutomation
        if isinstance(action, (InputActionTypes, SavedActionTypes)):
            return NewAutomation(event=self, action=action)
        raise TypeError(f'Expected a valid action, got: {nameof(type(action))!r}')

    def __rshift__(self, other: InputAction) -> NewAutomation:
        """Implement `event >> action` to define an automation."""
        return self.then(other)

class _BaseMutationEventInput(_BaseEventInput):
    filter: Annotated[JsonEncoded[MongoLikeFilter], AfterValidator(wrap_mutation_event_filter)] = And()
    'Additional conditions(s), if any, that are required for this event to trigger.'

class OnLinkArtifact(_BaseMutationEventInput):
    """A new artifact is linked to a collection.

    Examples:
    Define an event that triggers when an artifact is linked to the
    collection "my-collection" with the alias "prod":

    ```python
    from wandb import Api
    from wandb.automations import OnLinkArtifact, ArtifactEvent

    api = Api()
    collection = api.artifact_collection(name="my-collection", type_name="model")

    event = OnLinkArtifact(
        scope=collection,
        filter=ArtifactEvent.alias.eq("prod"),
    )
    ```
    """
    event_type: Literal[EventType.LINK_ARTIFACT] = EventType.LINK_ARTIFACT

class OnUnlinkArtifact(_BaseMutationEventInput):
    """An artifact version is unlinked from a collection."""
    event_type: Literal[EventType.UNLINK_ARTIFACT] = EventType.UNLINK_ARTIFACT

class OnAddArtifactAlias(_BaseMutationEventInput):
    """A new alias is assigned to an artifact.

    Examples:
    Define an event that triggers whenever the alias "prod" is assigned to
    any artifact in the collection "my-collection":

    ```python
    from wandb import Api
    from wandb.automations import OnAddArtifactAlias, ArtifactEvent

    api = Api()
    collection = api.artifact_collection(name="my-collection", type_name="model")

    event = OnAddArtifactAlias(
        scope=collection,
        filter=ArtifactEvent.alias.eq("prod"),
    )
    ```
    """
    event_type: Literal[EventType.ADD_ARTIFACT_ALIAS] = EventType.ADD_ARTIFACT_ALIAS

class OnAddArtifactTag(_BaseMutationEventInput):
    """A new tag is assigned to an artifact version.

    Examples:
    Define an event that triggers whenever the tag "prod" is assigned to
    any artifact version in the collection "my-collection":

    ```python
    from wandb import Api
    from wandb.automations import OnAddArtifactTag, ArtifactEvent

    api = Api()
    collection = api.artifact_collection(name="my-collection", type_name="model")

    event = OnAddArtifactTag(
        scope=collection,
        filter=ArtifactEvent.tag.eq("prod"),
    )
    ```
    """
    event_type: Literal[EventType.ADD_ARTIFACT_TAG] = EventType.ADD_ARTIFACT_TAG

class OnRemoveArtifactTag(_BaseMutationEventInput):
    """A tag is removed from an artifact version."""
    event_type: Literal[EventType.REMOVE_ARTIFACT_TAG] = EventType.REMOVE_ARTIFACT_TAG

class OnAddCollectionTag(_BaseMutationEventInput):
    """A new tag is assigned to an artifact collection."""
    event_type: Literal[EventType.ADD_COLLECTION_TAG] = EventType.ADD_COLLECTION_TAG

class OnRemoveCollectionTag(_BaseMutationEventInput):
    """A tag is removed from an artifact collection."""
    event_type: Literal[EventType.REMOVE_COLLECTION_TAG] = EventType.REMOVE_COLLECTION_TAG

class OnCreateArtifact(_BaseMutationEventInput):
    """A new artifact is created.

    Examples:
    Define an event that triggers when a new artifact is created in the
    collection "my-collection":

    ```python
    from wandb import Api
    from wandb.automations import OnCreateArtifact

    api = Api()
    collection = api.artifact_collection(name="my-collection", type_name="model")

    event = OnCreateArtifact(scope=collection)
    ```
    """
    event_type: Literal[EventType.CREATE_ARTIFACT] = EventType.CREATE_ARTIFACT
    scope: ArtifactCollectionScope
    'The scope of the event: must be an artifact collection.'

class _BaseRunEventInput(_BaseEventInput):
    scope: Annotated[ProjectScope | EntityScope, BeforeValidator(parse_scope), Discriminator('typename__')]
    'The scope of the event: must be a project or a team/org entity.'

class OnRunMetric(_BaseRunEventInput):
    """A run metric satisfies a user-defined condition.

    Examples:
    Define an event that triggers for any run in project "my-project" when
    the average of the last 5 values of metric "my-metric" exceeds 123.45:

    ```python
    from wandb import Api
    from wandb.automations import OnRunMetric, RunEvent

    api = Api()
    project = api.project(name="my-project")

    event = OnRunMetric(
        scope=project,
        filter=RunEvent.metric("my-metric").avg(5).gt(123.45),
    )
    ```
    """
    event_type: Literal[EventType.RUN_METRIC_THRESHOLD, EventType.RUN_METRIC_CHANGE, EventType.RUN_METRIC_ZSCORE]
    filter: JsonEncoded[RunMetricFilter]
    'Run and/or metric condition(s) that must be satisfied for this event to trigger.'

    @model_validator(mode='before')
    @classmethod
    def _infer_event_type(cls, data: Any) -> Any:
        """Infer the event type from the inner filter during validation.

        This supports both "threshold" and "change" metric filters, which can
        only be determined after parsing and validating the inner JSON data.
        """
        match data:
            case {'filter': raw}:
                filter_ = RunMetricFilter.model_validate_json(ensure_json(raw))
                return {**data, 'event_type': filter_.metric.event_type}
            case _:
                return data

class OnRunState(_BaseRunEventInput):
    """A run state changes.

    Examples:
    Define an event that triggers for any run in project "my-project" when
    its state changes to "finished" (i.e. succeeded) or "failed":

    ```python
    from wandb import Api
    from wandb.automations import OnRunState

    api = Api()
    project = api.project(name="my-project")

    event = OnRunState(
        scope=project,
        filter=RunEvent.state.in_(["finished", "failed"]),
    )
    ```
    """
    event_type: Literal[EventType.RUN_STATE] = EventType.RUN_STATE
    filter: JsonEncoded[RunStateFilter]
    'Run state condition(s) that must be satisfied for this event to trigger.'
InputEvent = Annotated[OnLinkArtifact | OnAddArtifactAlias | OnAddArtifactTag | OnRemoveArtifactTag | OnAddCollectionTag | OnRemoveCollectionTag | OnCreateArtifact | OnUnlinkArtifact | OnRunMetric | OnRunState, Field(discriminator='event_type')]
InputEventTypes: tuple[type, ...] = get_args(InputEvent.__origin__)

class RunEvent:
    name = FilterableField(server_name='display_name')
    state = StateOperand()

    @staticmethod
    def metric(name: str) -> MetricVal:
        """Define a metric filter condition."""
        return MetricVal(name=name)

class ArtifactEvent:
    alias = FilterableField()
    tag = FilterableField()
__all__ = ['EventType', *(nameof(cls) for cls in InputEventTypes), 'RunEvent', 'ArtifactEvent', 'MetricThresholdFilter', 'MetricChangeFilter', 'MetricZScoreFilter']
