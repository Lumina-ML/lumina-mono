"""Model Registry upload/download example for Lumina backend."""

import os
import tempfile

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    # Train a "model" and save it locally
    with tempfile.NamedTemporaryFile(mode="w", suffix=".pt", delete=False) as f:
        f.write("fake model weights v1")
        model_path = f.name

    # Log the model to the Model Registry
    result = lumina.log_model(
        path=model_path,
        name="demo-classifier",
        description="A tiny demo classifier",
        aliases=["prod"],
        metadata={"framework": "pytorch", "epochs": 3},
        project="demo",
    )
    print(f"Registered model: {result['model']['id']}")
    print(f"Registry version: {result['version']['id']}")
    print(f"Artifact version: {result['artifact_version']['id']}")

    # Log a second version
    with tempfile.NamedTemporaryFile(mode="w", suffix=".pt", delete=False) as f:
        f.write("fake model weights v2")
        model_path_v2 = f.name

    result2 = lumina.log_model(
        path=model_path_v2,
        name="demo-classifier",
        aliases=["staging"],
        project="demo",
    )
    print(f"Second registry version: {result2['version']['id']}")

    # Download the latest (v2) model
    downloaded = lumina.use_model(
        name="demo-classifier",
        alias="latest",
        project="demo",
        download_dir="/tmp/lumina-models",
    )
    print(f"Downloaded files: {downloaded['downloaded']}")

    # Verify downloaded content
    if downloaded["downloaded"]:
        with open(downloaded["downloaded"][0]) as f:
            print(f"Content: {f.read()}")


if __name__ == "__main__":
    main()
