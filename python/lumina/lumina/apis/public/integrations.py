"""W&B Public API for integrations.

This module provides classes for interacting with W&B integrations.
"""
from __future__ import annotations
from typing import TYPE_CHECKING, Any, ClassVar, TypeVar
from typing_extensions import override
from lumina.apis.paginator import RelayPaginator
if TYPE_CHECKING:
    from lumina._pydantic import Connection
    from lumina.apis.public.service_api import ServiceApi
    from lumina.automations import Integration, SlackIntegration, WebhookIntegration
    from lumina.automations._generated import SlackIntegrationFields, WebhookIntegrationFields
    IntegrationFields = SlackIntegrationFields | WebhookIntegrationFields
_IntegrationT = TypeVar('_IntegrationT')
'The type of `Integration` object yielded by an integrations paginator.'

class _IntegrationsPaginator(RelayPaginator['IntegrationFields', _IntegrationT]):
    """Shared pagination logic for lazy iterators of entity integrations.

    <!-- lazydoc-ignore-class: internal -->
    """
    QUERY: ClassVar[str | None] = None
    last_response: Connection[IntegrationFields] | None

    def __init__(self, service_api: ServiceApi, variables: dict[str, Any], per_page: int=50, start: str | None=None):
        if self.QUERY is None:
            from lumina.automations._generated import INTEGRATIONS_BY_ENTITY_GQL
            type(self).QUERY = INTEGRATIONS_BY_ENTITY_GQL
        super().__init__(service_api, variables=variables, per_page=per_page, start=start)

    @override
    def _update_response(self) -> None:
        """Fetch and parse the response data for the current page."""
        from lumina._pydantic import Connection
        from lumina.automations._generated import IntegrationsByEntity
        result = self._execute_query(parse=IntegrationsByEntity.model_validate_json)
        if not ((entity := result.entity) and (conn := entity.integrations)):
            raise ValueError('Unexpected response data')
        self.last_response = Connection.model_validate(conn)

class Integrations(_IntegrationsPaginator['Integration']):
    """A lazy iterator of `Integration` objects.

    <!-- lazydoc-ignore-class: internal -->
    """

    def _convert(self, node: IntegrationFields) -> Integration:
        from lumina.automations.integrations import IntegrationAdapter
        return IntegrationAdapter.validate_python(node)

class WebhookIntegrations(_IntegrationsPaginator['WebhookIntegration']):
    """A lazy iterator of `WebhookIntegration` objects.

    <!-- lazydoc-ignore-class: internal -->
    """

    def _convert(self, node: IntegrationFields) -> WebhookIntegration | None:
        from lumina.automations import WebhookIntegration
        if node.typename__ == 'GenericWebhookIntegration':
            return WebhookIntegration.model_validate(node)
        return None

class SlackIntegrations(_IntegrationsPaginator['SlackIntegration']):
    """A lazy iterator of `SlackIntegration` objects.

    <!-- lazydoc-ignore-class: internal -->
    """

    def _convert(self, node: IntegrationFields) -> SlackIntegration | None:
        from lumina.automations import SlackIntegration
        if node.typename__ == 'SlackIntegration':
            return SlackIntegration.model_validate(node)
        return None
