"""Tests for the Lumina backend media serialization extensions.

Verifies that wandb JoinedTable and wandb Histogram round-trip through
the Lumina log() path and produce sensible manifest artifacts.
"""

import json
import os
import tempfile
from pathlib import Path
from typing import Any

import pytest

from lumina.backend.media import _serialize_joined_table, _serialize_histogram, _infer_media_type


class JoinedTable:
    """Minimal stand-in for wandb.JoinedTable (must keep class name)."""

    def __init__(self, join_key: str, tables: list[Any]) -> None:
        self.join_key = join_key
        self.tables = tables


class FakeTable:
    def __init__(self, columns: list[str], data: list[list[Any]]) -> None:
        self.columns = columns
        self.data = data


class Histogram:
    """Minimal stand-in for wandb.Histogram (must keep class name)."""

    def __init__(self, bins: list[int], edges: list[float]) -> None:
        self.np_histogram = (bins, edges)


class TestJoinedTableSerialization:
    def test_writes_manifest_with_join_key_and_tables(self) -> None:
        joined = JoinedTable(
            join_key="id",
            tables=[
                FakeTable(["id", "name"], [[1, "alice"], [2, "bob"]]),
                FakeTable(["id", "score"], [[1, 0.9], [2, 0.7]]),
            ],
        )

        with tempfile.TemporaryDirectory() as tmp:
            os.chdir(tmp)
            temp_path, filename, content_type = _serialize_joined_table("joins", joined)

            assert filename == "joins.json"
            assert content_type == "application/json"
            assert os.path.exists(temp_path)
            with open(temp_path, "rb") as fh:
                manifest = json.loads(fh.read())

        assert manifest["kind"] == "JoinedTable"
        assert manifest["join_key"] == "id"
        assert len(manifest["tables"]) == 2
        assert manifest["tables"][0]["columns"] == ["id", "name"]
        assert manifest["tables"][1]["data"] == [[1, 0.9], [2, 0.7]]


class TestHistogramSerialization:
    def test_writes_bins_and_edges(self) -> None:
        hist = Histogram(bins=[1, 2, 3], edges=[0.0, 0.5, 1.0, 1.5])
        temp_path, filename, content_type = _serialize_histogram("grads", hist)
        assert filename == "grads.json"
        assert content_type == "application/json"
        with open(temp_path, "rb") as fh:
            manifest = json.loads(fh.read())
        assert manifest["kind"] == "Histogram"
        assert manifest["bins"] == [1.0, 2.0, 3.0]
        assert manifest["bin_edges"] == [0.0, 0.5, 1.0, 1.5]
        assert manifest["num_bins"] == 3


class TestInferMediaType:
    def test_joined_table_maps_to_table(self) -> None:
        joined = JoinedTable("id", [])
        assert _infer_media_type(joined) == "table"

    def test_histogram_maps_to_histogram(self) -> None:
        hist = Histogram([], [])
        assert _infer_media_type(hist) == "histogram"