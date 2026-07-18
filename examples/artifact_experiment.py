"""Artifact upload/download example for Lumina backend."""

import tempfile

import lumina


def main():
    # Create a dummy file to upload
    with tempfile.NamedTemporaryFile(mode="w", suffix=".pt", delete=False) as f:
        f.write("fake model weights")
        local_path = f.name

    # Upload artifact
    artifact = lumina.LuminaArtifact(
        name="example-model",
        type="model",
        description="An example model artifact",
    )
    artifact.add_file(local_path)
    result = artifact.save(project="demo", version="v1")
    print(f"Uploaded artifact: {result['artifact']['id']}")
    print(f"Version: {result['version']['id']}")

    # Download artifact
    downloaded = lumina.use_lumina_artifact(
        "example-model",
        project="demo",
        alias="latest",
        download_dir="/tmp/lumina-artifacts",
    )
    print(f"Downloaded files: {downloaded['downloaded']}")


if __name__ == "__main__":
    main()
