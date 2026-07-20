from __future__ import annotations
from typing import TYPE_CHECKING, TypeAlias
import lumina
from lumina.sdk.lib import telemetry
if TYPE_CHECKING:
    from lumina.proto.wandb_telemetry_pb2 import Deprecated
UNSET: DoNotSet = object()
'A temporary default value for removing formerly optional parameters.\n\nThis helps distinguish explicit None arguments from implicit None.\n\nUsage:\n    def myfunction(old_param: DoNotSet = UNSET) -> ...:\n        if old_param is not UNSET:\n            warn_user()\n        else:\n            # Set to None if checked in downstream logic,\n            # since UNSET is not None.\n            old_param = None\n        ...\n\n    myfunction()                # Does not warn\n    myfunction(old_param=None)  # Warns\n'
DoNotSet: TypeAlias = object
'The type of UNSET.'

def warn_and_record_deprecation(*, feature: Deprecated, message: str, run: lumina.Run | None=None) -> None:
    """Warn the user that a feature has been deprecated and update telemetry.

    Args:
        feature: A Deprecated protobuf message with the relevant field set to True.
        message: The deprecation warning message to display to the user.
        run: The run whose telemetry to update.
    """
    with telemetry.context(run=run or lumina.run) as tel:
        tel.deprecated.MergeFrom(feature)
    lumina.termwarn(message, repeat=False)
