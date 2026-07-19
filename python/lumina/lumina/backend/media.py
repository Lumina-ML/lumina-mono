"""Minimal Tables & Media support for the Lumina backend path."""

from __future__ import annotations

import csv
import io
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Optional

from lumina.backend.artifact import LuminaArtifact
from lumina.backend.client import LuminaClient
from lumina.backend.run_context import get_run_context


class LuminaTable:
    """A lightweight table for the Lumina backend."""

    def __init__(
        self,
        columns: Optional[list[str]] = None,
        data: Optional[list[list[Any]]] = None,
    ):
        self.columns = columns or []
        self.data = data or []

    def add_column(self, name: str, values: Optional[list[Any]] = None) -> "LuminaTable":
        """Add a column and optionally its values."""
        self.columns.append(name)
        if values:
            for i, value in enumerate(values):
                if i >= len(self.data):
                    self.data.append([None] * (len(self.columns) - 1))
                self.data[i].append(value)
            # Pad shorter rows with None
            for row in self.data:
                while len(row) < len(self.columns):
                    row.append(None)
        return self

    def add_row(self, row: dict[str, Any] | list[Any]) -> "LuminaTable":
        """Add a row to the table."""
        if isinstance(row, dict):
            for key in row:
                if key not in self.columns:
                    self.columns.append(key)
            new_row = [row.get(key) for key in self.columns]
        else:
            new_row = list(row)
            while len(new_row) < len(self.columns):
                new_row.append(None)
        self.data.append(new_row)
        return self

    def to_csv(self) -> str:
        """Serialize the table to CSV."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(self.columns)
        for row in self.data:
            writer.writerow(row)
        return output.getvalue()

    def to_json(self) -> dict[str, Any]:
        """Serialize the table to a JSON-friendly dict."""
        return {
            "columns": self.columns,
            "data": self.data,
        }

    def save(self, key: str, project: Optional[str] = None) -> dict[str, Any]:
        """Save the table as an artifact and register it as run media."""
        return log_media(key, self, type="table", project=project)


def log_media(
    key: str,
    value: Any,
    *,
    type: str,
    project: Optional[str] = None,
    run_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Log arbitrary media (table, image, video, audio, etc.) for a run.

    ``value`` can be:
    - a file path (str or Path)
    - a LuminaTable instance
    - a PIL Image
    - raw bytes
    """
    ctx = get_run_context()
    project_name = project or ctx.project
    actual_run_id = run_id or ctx.run_id
    if not project_name:
        raise ValueError("project is required when no run context exists")

    client = LuminaClient()
    project_obj = client.get_project_by_name(project_name)
    if not project_obj:
        project_obj = client._request("POST", "/api/v1/projects", {"name": project_name})
    project_id = project_obj["id"]

    # Serialize value to a temporary file
    temp_path, file_name, content_type = _serialize_media(key, value, type)

    try:
        # Upload via artifact
        artifact_name = f"run-{actual_run_id}-media" if actual_run_id else f"project-{project_name}-media"
        artifact = LuminaArtifact(name=artifact_name, type="file")
        artifact.add_file(temp_path)
        # Use a unique version per key to avoid collisions
        import uuid
        version_result = artifact.save(project=project_name, version=f"v-{uuid.uuid4().hex[:8]}")
        version_obj = version_result["version"]

        # Register RunMedia
        media = client.create_run_media(
            project_id,
            key,
            type,
            version_obj["id"],
            run_id=actual_run_id,
            metadata={
                "filename": file_name,
                "contentType": content_type,
                **(metadata or {}),
            },
        )
        return {
            "media": media,
            "artifact_version": version_obj,
        }
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


def _serialize_media(key: str, value: Any, type: str) -> tuple[str, str, str]:
    """Serialize media to a temporary file. Returns (path, filename, content_type)."""
    if isinstance(value, (str, Path)):
        path = Path(value)
        if not path.is_file():
            raise FileNotFoundError(f"Not a file: {value}")
        return str(path), path.name, _guess_content_type(path.suffix)

    # Wandb / Lumina SDK Media objects already have a backing file at ``_path``.
    if _is_wandb_media(value):
        cls_name = value.__class__.__name__
        if cls_name in ("Table", "EvalTable"):
            suffix = ".csv"
            data = _serialize_wandb_table(value)
            content_type = "text/csv"
            fd, temp_path = tempfile.mkstemp(suffix=suffix)
            try:
                with os.fdopen(fd, "wb") as f:
                    f.write(data)
            except Exception:
                os.remove(temp_path)
                raise
            return temp_path, f"{key}{suffix}", content_type
        if cls_name == "JoinedTable":
            # JoinedTable is a wandb Media that joins two or more Tables on
            # a shared key column. Emit a manifest JSON plus a CSV per
            # input table so the dashboard can reconstruct the join.
            return _serialize_joined_table(key, value)
        if cls_name == "Histogram":
            return _serialize_histogram(key, value)
        else:
            path = getattr(value, "_path", None)
            if path and os.path.isfile(path):
                suffix = Path(path).suffix
                return str(path), f"{key}{suffix}", _guess_content_type(suffix)
            # Fall through to type-specific serialization if no path is set.
            suffix = ".json"
            data = json.dumps(value, default=str).encode("utf-8")
            content_type = "application/json"

    if isinstance(value, LuminaTable):
        suffix = ".csv"
        data = value.to_csv().encode("utf-8")
        content_type = "text/csv"
    elif type == "table":
        suffix = ".json"
        data = json.dumps(value).encode("utf-8")
        content_type = "application/json"
    elif type == "image":
        suffix = ".png"
        data = _serialize_image(value)
        content_type = "image/png"
    elif type == "plotly":
        suffix = ".html"
        data = _serialize_plotly(value)
        content_type = "text/html"
    elif isinstance(value, bytes):
        suffix = ".bin"
        data = value
        content_type = "application/octet-stream"
    else:
        # Fallback to JSON
        suffix = ".json"
        data = json.dumps(value, default=str).encode("utf-8")
        content_type = "application/json"

    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
    except Exception:
        os.remove(temp_path)
        raise
    return temp_path, f"{key}{suffix}", content_type


def _guess_content_type(suffix: str) -> str:
    mapping = {
        ".csv": "text/csv",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".html": "text/html",
    }
    return mapping.get(suffix.lower(), "application/octet-stream")


def _serialize_image(value: Any) -> bytes:
    """Serialize a PIL/numpy/image-like object to PNG bytes."""
    # Try PIL first
    try:
        from PIL.Image import Image
        if isinstance(value, Image):
            buf = io.BytesIO()
            value.save(buf, format="PNG")
            return buf.getvalue()
    except Exception:
        pass

    # Try numpy array
    try:
        import numpy as np
        if isinstance(value, np.ndarray):
            from PIL import Image as PILImage
            img = PILImage.fromarray(value)
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return buf.getvalue()
    except Exception:
        pass

    raise TypeError(f"Unsupported image type: {type(value)}")


def _serialize_plotly(value: Any) -> bytes:
    """Serialize a Plotly figure to HTML bytes."""
    try:
        import plotly
        if isinstance(value, plotly.graph_objects.Figure):
            return value.to_html(include_plotlyjs="cdn").encode("utf-8")
    except Exception:
        pass
    raise TypeError(f"Unsupported plotly type: {type(value)}")


def _serialize_wandb_table(value: Any) -> bytes:
    """Serialize a wandb Table/EvalTable to CSV bytes."""
    columns = getattr(value, "columns", None) or []
    data = getattr(value, "data", None) or []
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(columns)
    for row in data:
        writer.writerow(row)
    return output.getvalue().encode("utf-8")


def _serialize_joined_table(key: str, value: Any) -> tuple[str, str, str]:
    """Serialize a wandb JoinedTable to a manifest JSON file.

    The manifest describes the join key and lists each constituent table by
    its columns/data. We intentionally avoid trying to render the joined
    result server-side; instead, we ship the inputs so the dashboard can
    run the join lazily.
    """
    join_key = getattr(value, "join_key", None)
    tables = getattr(value, "tables", None) or []
    manifest: dict[str, Any] = {
        "kind": "JoinedTable",
        "join_key": join_key,
        "tables": [],
    }
    for idx, table in enumerate(tables):
        manifest["tables"].append({
            "index": idx,
            "columns": getattr(table, "columns", []) or [],
            "data": getattr(table, "data", []) or [],
        })

    suffix = ".json"
    data = json.dumps(manifest, default=str).encode("utf-8")
    content_type = "application/json"
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
    except Exception:
        os.remove(temp_path)
        raise
    return temp_path, f"{key}{suffix}", content_type


def _serialize_histogram(key: str, value: Any) -> tuple[str, str, str]:
    """Serialize a wandb Histogram to a JSON file with bins + edges.

    wandb's Histogram stores ``np_histogram`` as a ``(hist, bin_edges)``
    tuple (or two such tuples in newer versions). We serialize whatever we
    can find; downstream code can rebuild the histogram from these arrays.
    """
    np_histogram = getattr(value, "np_histogram", None)
    bins: list[float] = []
    edges: list[float] = []
    if np_histogram is not None:
        try:
            hist_arr, edges_arr = np_histogram
            bins = [float(x) for x in hist_arr]
            edges = [float(x) for x in edges_arr]
        except Exception:
            # Older versions stored a single ndarray; fall back to treating
            # it as just the bin counts with auto edges.
            try:
                bins = [float(x) for x in np_histogram[0]]  # type: ignore[index]
            except Exception:
                bins = [float(x) for x in np_histogram]  # type: ignore[union-attr]
    manifest = {
        "kind": "Histogram",
        "bins": bins,
        "bin_edges": edges,
        "num_bins": len(bins),
    }

    suffix = ".json"
    data = json.dumps(manifest).encode("utf-8")
    content_type = "application/json"
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
    except Exception:
        os.remove(temp_path)
        raise
    return temp_path, f"{key}{suffix}", content_type


def _is_media_value(value: Any) -> bool:
    """Detect whether a value is a media object that should be logged as RunMedia."""
    if isinstance(value, LuminaTable):
        return True
    # Wandb / Lumina SDK Media types (Image, Audio, Video, Plotly, Html, Table, ...)
    if _is_wandb_media(value):
        return True
    # PIL Image
    cls = type(value)
    module = getattr(cls, "__module__", "")
    name = cls.__name__
    if module.startswith("PIL"):
        return name == "Image"
    # NumPy array treated as image
    if module.startswith("numpy"):
        return name == "ndarray"
    return False


def _is_wandb_media(value: Any) -> bool:
    """Return True if value is a wandb-sdk Media object."""
    try:
        from lumina.sdk.data_types.base_types.media import Media

        return isinstance(value, Media)
    except Exception:
        return False


def _wandb_media_type(value: Any) -> str | None:
    """Map a wandb Media object to a Lumina media type string."""
    cls_name = type(value).__name__
    mapping = {
        "Image": "image",
        "Video": "video",
        "Audio": "audio",
        "Plotly": "plotly",
        "Html": "html",
        "Table": "table",
        "EvalTable": "table",
        "JoinedTable": "table",
        "Histogram": "histogram",
        "Object3D": "file",
        "Molecule": "file",
    }
    return mapping.get(cls_name)


def _infer_media_type(value: Any) -> str:
    """Infer the media type from a value."""
    if isinstance(value, LuminaTable):
        return "table"
    if _is_wandb_media(value):
        return _wandb_media_type(value) or "file"
    # Fallback: some users construct duck-typed media objects without
    # extending wandb's Media base. Match on class name so JoinedTable /
    # Histogram serialize correctly even from third-party wrappers.
    mapped = _wandb_media_type(value)
    if mapped:
        return mapped
    cls = type(value)
    module = getattr(cls, "__module__", "")
    name = cls.__name__
    if name == "Image":
        return "image"
    if module.startswith("numpy") and name == "ndarray":
        return "image"
    return "file"
