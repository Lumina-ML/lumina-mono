"""Actions that are triggered by W&B Automations."""
from __future__ import annotations
from typing import Annotated, Any, Literal, get_args
from pydantic import BeforeValidator, Field
from typing_extensions import Self, TypeVar
from lumina._pydantic import GQLBase, GQLId
from lumina._strutils import nameof
from ._generated import AlertSeverity, GenericWebhookActionFields, GenericWebhookActionInput, NoOpActionFields, NoOpTriggeredActionInput, NotificationActionFields, NotificationActionInput, QueueJobActionFields
from ._validators import JsonEncoded, LenientStrEnum, default_if_none, parse_input_action, parse_saved_action, upper_if_str
from .integrations import SlackIntegration, WebhookIntegration
T = TypeVar('T')

class ActionType(LenientStrEnum):
    """The type of action triggered by an automation."""
    NO_OP = 'NO_OP'
    QUEUE_JOB = 'QUEUE_JOB'
    GENERIC_WEBHOOK = 'GENERIC_WEBHOOK'
    NOTIFICATION = 'NOTIFICATION'
    PUSH_NOTIFICATION = 'PUSH_NOTIFICATION'

class SavedLaunchJobAction(QueueJobActionFields):
    action_type: Literal[ActionType.QUEUE_JOB] = ActionType.QUEUE_JOB

class _SlackIntegrationStub(GQLBase):
    typename__: Annotated[Literal['SlackIntegration'], Field(alias='__typename', frozen=True, repr=False)] = 'SlackIntegration'
    id: GQLId

class _WebhookIntegrationStub(GQLBase):
    typename__: Annotated[Literal['GenericWebhookIntegration'], Field(alias='__typename', frozen=True, repr=False)] = 'GenericWebhookIntegration'
    id: GQLId

class SavedNotificationAction(NotificationActionFields, frozen=False):
    action_type: Literal[ActionType.NOTIFICATION] = ActionType.NOTIFICATION
    integration: _SlackIntegrationStub
    title: str | None
    message: str | None
    severity: AlertSeverity | None

class SavedWebhookAction(GenericWebhookActionFields, frozen=False):
    action_type: Literal[ActionType.GENERIC_WEBHOOK] = ActionType.GENERIC_WEBHOOK
    integration: _WebhookIntegrationStub
    request_payload: JsonEncoded[dict[str, Any]] | None = None

class SavedNoOpAction(NoOpActionFields, frozen=False):
    action_type: Literal[ActionType.NO_OP] = ActionType.NO_OP
    no_op: Annotated[bool, BeforeValidator(default_if_none), Field(repr=False, frozen=True)] = True
    'Placeholder field, only needed to conform to schema requirements.\n\n    There should never be a need to set this field explicitly, as its value is ignored.\n    '
SavedAction = Annotated[SavedLaunchJobAction | SavedNotificationAction | SavedWebhookAction | SavedNoOpAction, BeforeValidator(parse_saved_action), Field(discriminator='typename__')]
SavedActionTypes: tuple[type, ...] = get_args(SavedAction.__origin__)

class _BaseActionInput(GQLBase):
    action_type: Annotated[ActionType, Field(frozen=True)]
    'The kind of action to be triggered.'

class SendNotification(_BaseActionInput, NotificationActionInput):
    """Defines an automation action that sends a (Slack) notification."""
    action_type: Literal[ActionType.NOTIFICATION] = ActionType.NOTIFICATION
    integration_id: GQLId
    'The ID of the Slack integration that will be used to send the notification.'
    title: Annotated[str, BeforeValidator(default_if_none)] = ''
    'The title of the sent notification.'
    message: Annotated[str, BeforeValidator(default_if_none), Field(validation_alias='text')] = ''
    'The message body of the sent notification.'
    severity: Annotated[AlertSeverity, BeforeValidator(default_if_none), BeforeValidator(upper_if_str), Field(validation_alias='level')] = AlertSeverity.INFO
    'The severity (`INFO`, `WARN`, `ERROR`) of the sent notification.'

    @classmethod
    def from_integration(cls, integration: SlackIntegration, *, title: str='', text: str='', level: AlertSeverity=AlertSeverity.INFO) -> Self:
        """Define a notification action that sends to the given (Slack) integration."""
        return cls(integration_id=integration.id, title=title, message=text, severity=level)

class SendWebhook(_BaseActionInput, GenericWebhookActionInput):
    """Defines an automation action that sends a webhook request."""
    action_type: Literal[ActionType.GENERIC_WEBHOOK] = ActionType.GENERIC_WEBHOOK
    integration_id: GQLId
    'The ID of the webhook integration that will be used to send the request.'
    request_payload: JsonEncoded[dict[str, Any]] | None = Field(default=None, alias='requestPayload')
    'The payload, possibly with template variables, to send in the webhook request.'

    @classmethod
    def from_integration(cls, integration: WebhookIntegration, *, payload: JsonEncoded[dict[str, Any]] | None=None) -> Self:
        """Define a webhook action that sends to the given (webhook) integration."""
        return cls(integration_id=integration.id, request_payload=payload)

class DoNothing(_BaseActionInput, NoOpTriggeredActionInput, frozen=True):
    """Defines an automation action that intentionally does nothing."""
    action_type: Literal[ActionType.NO_OP] = ActionType.NO_OP
    no_op: Annotated[bool, BeforeValidator(default_if_none)] = True
    'Placeholder field which exists only to satisfy backend schema requirements.\n\n    There should never be a need to set this field explicitly, as its value is ignored.\n    '
InputAction = Annotated[SendNotification | SendWebhook | DoNothing, BeforeValidator(parse_input_action), Field(discriminator='action_type')]
InputActionTypes: tuple[type, ...] = get_args(InputAction.__origin__)
__all__ = ['ActionType', *(nameof(cls) for cls in InputActionTypes)]
