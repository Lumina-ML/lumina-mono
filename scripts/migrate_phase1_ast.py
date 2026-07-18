#!/usr/bin/env python3
"""
Phase 1 brand migration: wandb -> lumina (AST-based version)

Rules:
- Rename package directory from wandb/ to lumina/
- Use AST to safely rename Name/Attribute nodes from "wandb" -> "lumina"
- Update import statements automatically via AST
- Skip protobuf generated files (_pb2.py) except for top-level imports
- DO NOT touch: WANDB_* env vars, API URLs, protobuf message type names
"""

import ast
from pathlib import Path

ROOT = Path(__file__).parent.parent
SDK_DIR = ROOT / "python" / "lumina" / "lumina" / "lumina"


def iter_py_files():
    for path in SDK_DIR.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        yield path


def iter_pyi_files():
    for path in SDK_DIR.rglob("*.pyi"):
        if "__pycache__" in path.parts:
            continue
        yield path


class RenameTransformer(ast.NodeTransformer):
    def visit_Name(self, node):
        if node.id == "wandb":
            node.id = "lumina"
        return node

    def visit_Attribute(self, node):
        self.generic_visit(node)
        if node.attr == "wandb":
            node.attr = "lumina"
        return node

    def visit_ImportFrom(self, node):
        if node.module and (node.module == "wandb" or node.module.startswith("wandb.")):
            node.module = "lumina" + node.module[5:]
        # Rename aliases from 'wandb' package, e.g. 'from x import wandb as wb'
        for alias in node.names:
            if alias.name == "wandb":
                alias.name = "lumina"
            # Don't rename 'as wandb' since it's a local alias chosen by user
        return node

    def visit_Import(self, node):
        for alias in node.names:
            if alias.name == "wandb" or alias.name.startswith("wandb."):
                alias.name = "lumina" + alias.name[5:]
            # Don't rename 'as wandb' alias
        return node

    def visit_arg(self, node):
        # Do not rename function arguments or keyword arguments named wandb
        return node

    def visit_FunctionDef(self, node):
        # Don't rename function name if it's "wandb"
        self.generic_visit(node)
        return node

    def visit_AsyncFunctionDef(self, node):
        self.generic_visit(node)
        return node

    def visit_ClassDef(self, node):
        # Don't rename class name if it's "Wandb"
        self.generic_visit(node)
        return node


def migrate_python_file(path: Path) -> bool:
    """Migrate a regular Python file using AST."""
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return False

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return False

    transformer = RenameTransformer()
    new_tree = transformer.visit(tree)
    ast.fix_missing_locations(new_tree)

    try:
        new_content = ast.unparse(new_tree)
    except Exception:
        return False

    # Preserve trailing newline style
    if content.endswith("\n") and not new_content.endswith("\n"):
        new_content += "\n"
    elif content.endswith("\r\n") and not new_content.endswith("\r\n"):
        new_content += "\r\n"

    if new_content != content:
        path.write_text(new_content, encoding="utf-8")
        return True
    return False


def migrate_pb2_file(path: Path) -> bool:
    """Migrate protobuf generated file: only update import statements."""
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return False

    original = content
    # Update import statements preserving indentation
    import re
    content = re.sub(r"^([ \t]*)import wandb(\b)", r"\1import lumina\2", content, flags=re.MULTILINE)
    content = re.sub(r"^([ \t]*)from wandb(\b|\.)", r"\1from lumina\2", content, flags=re.MULTILINE)

    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False


def main():
    changed = 0

    for path in iter_py_files():
        if path.name.endswith("_pb2.py"):
            if migrate_pb2_file(path):
                changed += 1
                print(f"Changed (pb2): {path.relative_to(ROOT)}")
        else:
            if migrate_python_file(path):
                changed += 1
                print(f"Changed: {path.relative_to(ROOT)}")

    for path in iter_pyi_files():
        if migrate_python_file(path):
            changed += 1
            print(f"Changed (pyi): {path.relative_to(ROOT)}")

    print(f"\nTotal files changed: {changed}")


if __name__ == "__main__":
    main()
