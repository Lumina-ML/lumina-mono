#!/usr/bin/env python3
"""
Fix remaining wandb references in Python source files.

Strategy:
1. Use AST to rename Name/Attribute nodes from "wandb" -> "lumina".
2. Replace "wandb." in string literals with "lumina." only when it looks like a module path.
3. Skip WANDB_* env vars and URLs.
"""

import ast
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
SDK_DIR = ROOT / "python" / "lumina" / "lumina" / "lumina"


def iter_py_files():
    for path in SDK_DIR.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        yield path


def is_wandb_url(s: str) -> bool:
    return bool(re.search(r"https?://[^\s\"']*wandb", s))


class RenameTransformer(ast.NodeTransformer):
    def visit_Name(self, node):
        if node.id == "wandb":
            node.id = "lumina"
        return node

    def visit_Attribute(self, node):
        # bottom-up: rename attribute name if it is "wandb"
        self.generic_visit(node)
        if node.attr == "wandb":
            node.attr = "lumina"
        return node

    def visit_arg(self, node):
        # Do not rename function arguments named wandb
        return node


def fix_strings(content: str) -> str:
    def replace_module_ref(s: str) -> str:
        if "WANDB" in s:
            return s
        if is_wandb_url(s):
            return s
        # "wandb.xxx" -> "lumina.xxx"
        return s.replace("wandb.", "lumina.")

    # Replace inside double and single quoted strings
    content = re.sub(r'"([^"\\]*(?:\\.[^"\\]*)*)"', lambda m: f'"{replace_module_ref(m.group(1))}"', content)
    content = re.sub(r"'([^'\\]*(?:\\.[^'\\]*)*)'", lambda m: f"'{replace_module_ref(m.group(1))}'", content)
    return content


def migrate_file(path: Path) -> bool:
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return False

    original = content

    # AST-based rename of Name/Attribute nodes
    try:
        tree = ast.parse(content)
        transformer = RenameTransformer()
        tree = transformer.visit(tree)
        content = ast.unparse(tree)
    except SyntaxError:
        # If AST fails, skip AST transformation
        pass

    # String literal fixes
    content = fix_strings(content)

    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False


def main():
    changed = 0
    for path in iter_py_files():
        if migrate_file(path):
            changed += 1
            print(f"Changed: {path.relative_to(ROOT)}")

    print(f"\nTotal files changed: {changed}")


if __name__ == "__main__":
    main()
