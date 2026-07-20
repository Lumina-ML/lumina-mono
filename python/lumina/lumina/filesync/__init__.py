"""File sync (kept for backward-compatible imports).

All wandb-cloud multipart-upload machinery was deleted in step 3.5
(`step_checksum`, `step_upload`, `upload_job`, `dir_watcher`).
Only `stats` remains as a leaf helper. Any code that imported the
removed submodules will now get an `ImportError` — use the new
LuminaClient-backed `Run.save()` / `Run.restore()` instead.
"""
from lumina.filesync import stats

__all__ = ("stats",)
