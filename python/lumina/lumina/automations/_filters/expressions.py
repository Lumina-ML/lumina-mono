"""Pydantic-compatible representations of MongoDB expressions."""
from __future__ import annotations
from collections.abc import Iterable
from typing import Any, TypeAlias
from pydantic import ConfigDict, model_serializer
from typing_extensions import Self
from lumina._pydantic import CompatBaseModel, model_validator
from lumina._strutils import nameof
from .operators import And, Contains, Eq, Exists, Gt, Gte, In, Lt, Lte, Ne, Nor, Not, NotIn, Op, Or, Regex, RichReprResult, Scalar, SupportsBitwiseLogicalOps

class FilterableField:
    """A descriptor that can be used to define a "filterable" field on a class.

    Internal helper to support syntactic sugar for defining event filters.
    """
    _python_name: str
    _server_name: str | None

    def __init__(self, server_name: str | None=None):
        self._server_name = server_name

    def __set_name__(self, owner: type, name: str) -> None:
        self._python_name = name

    def __get__(self, obj: Any, objtype: type) -> Self:
        return self

    @property
    def _name(self) -> str:
        return self._server_name or self._python_name

    def __str__(self) -> str:
        return self._name

    def __repr__(self) -> str:
        return f'{nameof(type(self))}({self._name!r})'

    def matches_regex(self, pattern: str, /) -> FilterExpr:
        return FilterExpr(field=self._name, op=Regex(val=pattern))

    def contains(self, text: str, /) -> FilterExpr:
        return FilterExpr(field=self._name, op=Contains(val=text))

    def exists(self, exists: bool=True, /) -> FilterExpr:
        return FilterExpr(field=self._name, op=Exists(val=exists))

    def lt(self, value: Scalar, /) -> FilterExpr:
        return FilterExpr(field=self._name, op=Lt(val=value))

    def gt(self, value: Scalar, /) -> FilterExpr:
        return FilterExpr(field=self._name, op=Gt(val=value))

    def lte(self, value: Scalar, /) -> FilterExpr:
        return FilterExpr(field=self._name, op=Lte(val=value))

    def gte(self, value: Scalar, /) -> FilterExpr:
        return FilterExpr(field=self._name, op=Gte(val=value))

    def ne(self, value: Scalar, /) -> FilterExpr:
        return FilterExpr(field=self._name, op=Ne(val=value))

    def eq(self, value: Scalar, /) -> FilterExpr:
        return FilterExpr(field=self._name, op=Eq(val=value))

    def in_(self, values: Iterable[Scalar], /) -> FilterExpr:
        return FilterExpr(field=self._name, op=In(val=values))

    def not_in(self, values: Iterable[Scalar], /) -> FilterExpr:
        return FilterExpr(field=self._name, op=NotIn(val=values))

    def __lt__(self, other: Any) -> FilterExpr:
        return self.lt(other)

    def __gt__(self, other: Any) -> FilterExpr:
        return self.gt(other)

    def __le__(self, other: Any) -> FilterExpr:
        return self.lte(other)

    def __ge__(self, other: Any) -> FilterExpr:
        return self.gte(other)

    def __eq__(self, other: Any) -> FilterExpr:
        return self.eq(other)

    def __ne__(self, other: Any) -> FilterExpr:
        return self.ne(other)

class FilterExpr(CompatBaseModel, SupportsBitwiseLogicalOps):
    """A MongoDB filter expression on a specific field."""
    model_config = ConfigDict(arbitrary_types_allowed=True)
    field: str
    op: Op | dict[str, Any]

    def __repr__(self) -> str:
        return f'{nameof(type(self))}({self.field!s}: {self.op!r})'

    def __rich_repr__(self) -> RichReprResult:
        yield (self.field, self.op)

    @model_validator(mode='before')
    @classmethod
    def _validate(cls, data: Any) -> Any:
        """Parse a MongoDB dict representation of the filter expression."""
        if isinstance(data, dict) and len(data) == 1 and (not any((key.startswith('$') for key in data))):
            (field, op), = data.items()
            return {'field': field, 'op': op}
        return data

    @model_serializer(mode='plain')
    def _to_mongo_dict(self) -> dict[str, Any]:
        """Return a MongoDB dict representation of the expression."""
        from pydantic_core import to_jsonable_python
        return {self.field: to_jsonable_python(self.op, by_alias=True, round_trip=True)}
And.model_rebuild()
Or.model_rebuild()
Nor.model_rebuild()
Not.model_rebuild()
MongoLikeFilter: TypeAlias = Op | FilterExpr | dict[str, Any]
