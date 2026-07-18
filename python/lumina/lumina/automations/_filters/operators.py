"""Types that represent operators in MongoDB filter expressions."""
from __future__ import annotations
from abc import ABC
from collections.abc import Iterable
from typing import TYPE_CHECKING, Any, TypeAlias, TypeVar, get_args
from pydantic import ConfigDict, Field, StrictBool, StrictFloat, StrictInt, StrictStr
from typing_extensions import Self, override
from lumina._pydantic import GQLBase
from lumina._strutils import nameof
if TYPE_CHECKING:
    from .expressions import FilterExpr
Scalar = StrictStr | StrictInt | StrictFloat | StrictBool
ScalarTypes: tuple[type, ...] = tuple((t.__origin__ for t in get_args(Scalar)))
RichReprResult: TypeAlias = Iterable[Any | tuple[Any] | tuple[str, Any] | tuple[str, Any, Any]]
T = TypeVar('T')
TupleOf: TypeAlias = tuple[T, ...]

class SupportsBitwiseLogicalOps:

    def __or__(self, other: Any) -> Or:
        """Implements default `|` behavior: `a | b -> Or(a, b)`."""
        return Or(exprs=(self, other))

    def __and__(self, other: Any) -> And:
        """Implements default `&` behavior: `a & b -> And(a, b)`."""
        from .expressions import FilterExpr
        if isinstance(other, (BaseOp, FilterExpr)):
            return And(exprs=(self, other))
        return NotImplemented

    def __invert__(self) -> Op | FilterExpr:
        """Implements default `~` behavior: `~a -> Not(a)`."""
        return Not(expr=self)

class BaseOp(GQLBase, SupportsBitwiseLogicalOps, ABC):
    model_config = ConfigDict(extra='forbid', frozen=True)

    def __repr__(self) -> str:
        """Returns the operator's repr string, with operand(s) as positional args.

        Note that BaseModels implement `__iter__()`:
          https://docs.pydantic.dev/latest/concepts/serialization/#iterating-over-models
        """
        return f"{nameof(type(self))}({', '.join((repr(v) for _, v in self))})"

    def __rich_repr__(self) -> RichReprResult:
        """Returns the operator's rich repr, if pretty-printing via `rich`.

        See: https://rich.readthedocs.io/en/stable/pretty.html
        """
        yield from ((None, v) for _, v in self)

class BaseVariadicLogicalOp(BaseOp, ABC):
    exprs: TupleOf[FilterExpr | Op]

    @classmethod
    def wrap(cls, expr: Any) -> Self:
        return expr if isinstance(expr, cls) else cls(exprs=(expr,))

class And(BaseVariadicLogicalOp):
    exprs: TupleOf[FilterExpr | Op] = Field(default=(), alias='$and')

class Or(BaseVariadicLogicalOp):
    exprs: TupleOf[FilterExpr | Op] = Field(default=(), alias='$or')

    @override
    def __invert__(self) -> Nor:
        """Implements `~Or(a, b) -> Nor(a, b)`."""
        return Nor(exprs=self.exprs)

class Nor(BaseVariadicLogicalOp):
    exprs: TupleOf[FilterExpr | Op] = Field(default=(), alias='$nor')

    @override
    def __invert__(self) -> Or:
        """Implements `~Nor(a, b) -> Or(a, b)`."""
        return Or(exprs=self.exprs)

class Not(BaseOp):
    expr: FilterExpr | Op = Field(alias='$not')

    @override
    def __invert__(self) -> FilterExpr | Op:
        """Implements `~Not(a) -> a`."""
        return self.expr

class Lt(BaseOp):
    val: Scalar = Field(alias='$lt')

    @override
    def __invert__(self) -> Gte:
        """Implements `~Lt(a) -> Gte(a)`."""
        return Gte(val=self.val)

class Gt(BaseOp):
    val: Scalar = Field(alias='$gt')

    @override
    def __invert__(self) -> Lte:
        """Implements `~Gt(a) -> Lte(a)`."""
        return Lte(val=self.val)

class Lte(BaseOp):
    val: Scalar = Field(alias='$lte')

    @override
    def __invert__(self) -> Gt:
        """Implements `~Lte(a) -> Gt(a)`."""
        return Gt(val=self.val)

class Gte(BaseOp):
    val: Scalar = Field(alias='$gte')

    @override
    def __invert__(self) -> Lt:
        """Implements `~Gte(a) -> Lt(a)`."""
        return Lt(val=self.val)

class Eq(BaseOp):
    val: Scalar = Field(alias='$eq')

    @override
    def __invert__(self) -> Ne:
        """Implements `~Eq(a) -> Ne(a)`."""
        return Ne(val=self.val)

class Ne(BaseOp):
    val: Scalar = Field(alias='$ne')

    @override
    def __invert__(self) -> Eq:
        """Implements `~Ne(a) -> Eq(a)`."""
        return Eq(val=self.val)

class In(BaseOp):
    val: TupleOf[Scalar] = Field(default=(), alias='$in')

    @override
    def __invert__(self) -> NotIn:
        """Implements `~In(a) -> NotIn(a)`."""
        return NotIn(val=self.val)

class NotIn(BaseOp):
    val: TupleOf[Scalar] = Field(default=(), alias='$nin')

    @override
    def __invert__(self) -> In:
        """Implements `~NotIn(a) -> In(a)`."""
        return In(val=self.val)

class Exists(BaseOp):
    val: bool = Field(alias='$exists')

    @override
    def __invert__(self) -> Exists:
        """Implements `~Exists(True) -> Exists(False)` and vice versa."""
        return Exists(val=not self.val)

class Regex(BaseOp):
    val: str = Field(alias='$regex')

class Contains(BaseOp):
    val: str = Field(alias='$contains')
KEY_TO_OP: dict[str, type[BaseOp]] = {'$and': And, '$or': Or, '$nor': Nor, '$not': Not, '$lt': Lt, '$gt': Gt, '$lte': Lte, '$gte': Gte, '$eq': Eq, '$ne': Ne, '$in': In, '$nin': NotIn, '$exists': Exists, '$regex': Regex, '$contains': Contains}
Op = And | Or | Nor | Not | Lt | Gt | Lte | Gte | Eq | Ne | In | NotIn | Exists | Regex | Contains
