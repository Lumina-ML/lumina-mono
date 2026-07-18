import atexit
import tempfile
MEDIA_TMP = tempfile.TemporaryDirectory('wandb-media')

def _cleanup_media_tmp_dir() -> None:
    atexit.register(MEDIA_TMP.cleanup)
