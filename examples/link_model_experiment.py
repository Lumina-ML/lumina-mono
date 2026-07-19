"""link_model example for Lumina backend.

``lumina.link_model`` registers an existing local model file into the Model
Registry under a named registered model (W&B-compatible naming). It is a thin
convenience wrapper over ``log_model``.
"""

import os
import tempfile

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    with tempfile.NamedTemporaryFile("w", suffix=".pt", delete=False) as f:
        f.write("fake production weights")
        model_path = f.name

    result = lumina.link_model(
        model_path,
        "prod-classifier",
        aliases=["prod", "candidate"],
        project="demo",
    )
    print(f"Registered model: {result['model']['id']}")
    print(f"Registry version: {result['version']['id']}")
    print(f"Aliases: {result['version'].get('aliases')}")

    # Fetch it back by alias to confirm the link.
    downloaded = lumina.use_model(
        "prod-classifier",
        alias="prod",
        project="demo",
        download_dir="/tmp/lumina-linked-models",
    )
    print(f"Downloaded: {downloaded['downloaded']}")


if __name__ == "__main__":
    main()
