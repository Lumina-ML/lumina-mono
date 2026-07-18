"""Base classes and other customizations for generated pydantic types."""
from __future__ import annotations
from abc import ABC
from collections.abc import Callable
from typing import TYPE_CHECKING, Any, ClassVar, Literal, overload
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from typing_extensions import TypedDict, Unpack, override
if TYPE_CHECKING:
    from pydantic.main import IncEx

class ModelDumpKwargs(TypedDict, total=False):
    """Shared keyword arguments for `BaseModel.model_{dump,dump_json}`.

    Newer pydantic versions may accept more arguments than are listed here.
    Last updated for pydantic v2.12.0.
    """
    include: IncEx | None
    exclude: IncEx | None
    context: Any | None
    by_alias: bool | None
    exclude_unset: bool
    exclude_defaults: bool
    exclude_none: bool
    exclude_computed_fields: bool
    round_trip: bool
    warnings: bool | Literal['none', 'warn', 'error']
    fallback: Callable[[Any], Any] | None
    serialize_as_any: bool

class CompatBaseModel(BaseModel):
    __doc__ = None

class JsonableModel(CompatBaseModel, ABC):
    model_config = ConfigDict(populate_by_name=True, validate_by_name=True, validate_by_alias=True, serialize_by_alias=True, validate_assignment=True, use_attribute_docstrings=True, from_attributes=True)
    __DUMP_DEFAULTS: ClassVar[dict[str, Any]] = dict(by_alias=True, round_trip=True)

    @overload
    def model_dump(self, *, mode: str, **kwargs: Unpack[ModelDumpKwargs]) -> dict[str, Any]:
        ...

    @overload
    def model_dump(self, **kwargs: Any) -> dict[str, Any]:
        ...

    @override
    def model_dump(self, *, mode: str='json', **kwargs: Any) -> dict[str, Any]:
        kwargs = {**self.__DUMP_DEFAULTS, **kwargs}
        return super().model_dump(mode=mode, **kwargs)

    @overload
    def model_dump_json(self, *, indent: int | None, **kwargs: Unpack[ModelDumpKwargs]) -> str:
        ...

    @overload
    def model_dump_json(self, **kwargs: Any) -> str:
        ...

    @override
    def model_dump_json(self, *, indent: int | None=None, **kwargs: Any) -> str:
        kwargs = {**self.__DUMP_DEFAULTS, **kwargs}
        return super().model_dump_json(indent=indent, **kwargs)

class GQLBase(JsonableModel, ABC):
    model_config = ConfigDict(validate_default=True, revalidate_instances='always', protected_namespaces=())

class GQLResult(GQLBase, ABC):
    model_config = ConfigDict(alias_generator=to_camel, frozen=True)

class GQLInput(GQLBase, ABC):
    __DUMP_DEFAULTS: ClassVar[dict[str, Any]] = dict(exclude_none=True)

    @override
    def model_dump(self, *, mode: str='json', **kwargs: Any) -> dict[str, Any]:
        kwargs = {**self.__DUMP_DEFAULTS, **kwargs}
        return super().model_dump(mode=mode, **kwargs)

    @override
    def model_dump_json(self, *, indent: int | None=None, **kwargs: Any) -> str:
        kwargs = {**self.__DUMP_DEFAULTS, **kwargs}
        return super().model_dump_json(indent=indent, **kwargs)
