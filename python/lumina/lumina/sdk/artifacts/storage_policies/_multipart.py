"""Helpers and constants for multipart upload and download."""
from __future__ import annotations
import logging
import math
import threading
from collections.abc import Callable, Iterator
from concurrent.futures import FIRST_EXCEPTION, Executor, ThreadPoolExecutor, wait
from dataclasses import dataclass, field
from queue import Full, Queue
from typing import IO, TYPE_CHECKING, Any, Final, TypeAlias
import requests
from typing_extensions import TypeIs, final
from lumina import env
from lumina.sdk.artifacts.artifact_file_cache import Opener
from lumina.sdk.lib import retry
if TYPE_CHECKING:
    from requests import Session
logger = logging.getLogger(__name__)
KiB: Final[int] = 1024
MiB: Final[int] = 1024 ** 2
GiB: Final[int] = 1024 ** 3
TiB: Final[int] = 1024 ** 4
MAX_PARTS = 1000
MIN_MULTI_UPLOAD_SIZE = 2 * GiB
MAX_MULTI_UPLOAD_SIZE = 5 * TiB
MIN_MULTI_DOWNLOAD_SIZE = MIN_MULTI_UPLOAD_SIZE
MULTI_DEFAULT_PART_SIZE = 100 * MiB
RSP_CHUNK_SIZE = 1 * MiB

@final
class _ChunkSentinel:
    """Signal the end of the multipart chunk queue.

    Queue consumers terminate when they receive this item from the queue. Do
    not instantiate this class directly; use the `END_CHUNK` constant as a
    pseudo-singleton instead.

    NOTE: Use this only in multi-threaded (not multi-process) contexts because
    it is not guaranteed to be process-safe.
    """

    def __repr__(self) -> str:
        return 'ChunkSentinel'
END_CHUNK: Final[_ChunkSentinel] = _ChunkSentinel()

def is_end_chunk(obj: Any) -> TypeIs[_ChunkSentinel]:
    """Returns True if the object is the terminal queue item for multipart downloads."""
    return obj is END_CHUNK

@dataclass(frozen=True)
class ChunkContent:
    __slots__ = ('offset', 'data')
    offset: int
    data: bytes
QueuedChunk: TypeAlias = ChunkContent | _ChunkSentinel

def should_multipart_download(size: int | None, override: bool | None=None) -> bool:
    return (size or 0) >= MIN_MULTI_DOWNLOAD_SIZE if override is None else override

def calc_part_size(file_size: int, min_part_size: int=MULTI_DEFAULT_PART_SIZE) -> int:
    return max(math.ceil(file_size / MAX_PARTS), min_part_size)

def scan_chunks(path: str, chunk_size: int) -> Iterator[bytes]:
    with open(path, 'rb') as f:
        while (data := f.read(chunk_size)):
            yield data

@dataclass
class MultipartDownloadContext:
    """Shared state for multipart download threads."""
    session: Session
    q: Queue[QueuedChunk]
    cancel: threading.Event = field(default_factory=threading.Event)
    _url_lock: threading.Lock = field(default_factory=threading.Lock)
    _url: str = ''
    _url_invalidated: bool = False
    _url_fetch_fn: Callable[[], str] | None = None

    def get_url(self) -> str:
        """Get the current URL, fetching a fresh one only if invalidated."""
        with self._url_lock:
            if self._url_invalidated and self._url_fetch_fn:
                self._url = self._url_fetch_fn()
                self._url_invalidated = False
            return self._url

    def invalidate_url(self) -> None:
        """Mark the cached URL as invalid, forcing next get_url() to fetch fresh."""
        with self._url_lock:
            self._url_invalidated = True

    def signal_writer_stop(self) -> None:
        """Signal the writer thread to stop.

        On the error path (cancel already set), uses non-blocking put to avoid
        hanging on a full queue. On the success path, uses blocking put so the
        writer drains all remaining chunks before stopping.
        """
        if self.cancel.is_set():
            try:
                self.q.put_nowait(END_CHUNK)
            except Full:
                pass
        else:
            self.q.put(END_CHUNK)

def _download_chunk_with_refresh(ctx: MultipartDownloadContext, start: int, end: int | None) -> None:
    """Download a single chunk with refresh logic for expired presigned URLs.

    Args:
        ctx: Shared download context with session, queue, cancel event, and URL state.
        start: Start byte offset (inclusive).
        end: End byte offset (inclusive), or None for end of file.
    """
    if ctx.cancel.is_set():
        return
    bytes_range = f'{start}-' if end is None else f'{start}-{end}'
    headers = {'Range': f'bytes={bytes_range}'}

    def check_retry_fn(e: Exception) -> bool:
        """Check if we should retry this exception and refresh URL if needed."""
        if not isinstance(e, requests.HTTPError):
            return False
        status_code = getattr(e.response, 'status_code', None)
        if status_code in (401, 403):
            if env.is_debug():
                logger.debug(f'Download got {status_code}, refreshing URL for retry')
            ctx.invalidate_url()
            return True
        return False

    def attempt_download() -> None:
        with ctx.session.get(url=ctx.get_url(), headers=headers, stream=True) as rsp:
            rsp.raise_for_status()
            offset = start
            for chunk in rsp.iter_content(chunk_size=RSP_CHUNK_SIZE):
                if ctx.cancel.is_set():
                    return
                ctx.q.put(ChunkContent(offset=offset, data=chunk))
                offset += len(chunk)
    retrier = retry.Retry(attempt_download, num_retries=3, check_retry_fn=check_retry_fn, retryable_exceptions=(requests.HTTPError,), error_prefix='Multipart download chunk url expired')
    retrier(retry_sleep_base=0.5)

def _write_chunks(ctx: MultipartDownloadContext, file: IO[bytes]) -> None:
    """Write downloaded chunks to file.

    Args:
        ctx: Shared download context with queue and cancel event.
        file: File handle to write to.
    """
    while not (ctx.cancel.is_set() or is_end_chunk((chunk := ctx.q.get()))):
        try:
            file.seek(chunk.offset)
            file.write(chunk.data)
        except Exception as e:
            if env.is_debug():
                logger.debug(f'Error writing chunk to file: {e}')
            ctx.cancel.set()
            raise

def multipart_download(executor: Executor, session: Session, size: int, cached_open: Opener, initial_url: str, fetch_fn: Callable[[], str], part_size: int=MULTI_DEFAULT_PART_SIZE) -> None:
    """Download file as multiple parts in parallel.

    Uses one thread for writing to file (so it never competes with
    the caller's executor for thread slots). Each part runs one HTTP request
    submitted to the caller's executor.  HTTP response chunks are sent to the
    writer thread via a queue.

    Args:
        executor: Thread pool executor for parallel downloads.
        session: HTTP session for making requests.
        size: Total file size in bytes.
        cached_open: Opener function for writing to cache.
        initial_url: The initial presigned URL for downloading.
        fetch_fn: Callable that fetches a fresh URL when the current one expires.
        part_size: Size of each download part in bytes.
    """
    ctx = MultipartDownloadContext(session=session, q=Queue(maxsize=500), _url=initial_url, _url_fetch_fn=fetch_fn)
    with cached_open('wb') as f:
        writer_executor = ThreadPoolExecutor(max_workers=1)
        write_future = writer_executor.submit(_write_chunks, ctx, f)
        download_futures = set()
        for start in range(0, size, part_size):
            end = end if (end := (start + part_size - 1)) < size else None
            download_futures.add(executor.submit(_download_chunk_with_refresh, ctx, start, end))
        done, not_done = wait(download_futures, return_when=FIRST_EXCEPTION)
        try:
            for fut in done:
                fut.result()
        except Exception as e:
            if env.is_debug():
                logger.debug(f'Error downloading file: {e}')
            ctx.cancel.set()
            for fut in not_done:
                fut.cancel()
            raise
        finally:
            ctx.signal_writer_stop()
            write_future.result()
