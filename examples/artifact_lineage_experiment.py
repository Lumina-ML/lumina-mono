"""Artifact lineage example for Lumina backend.

Builds a dataset artifact and a model artifact, then records that the model was
``derived_from`` the dataset. Lineage edges let downstream tooling trace which
data produced which model.
"""

import os
import tempfile

import lumina


def _write(content: str, suffix: str) -> str:
    with tempfile.NamedTemporaryFile("w", suffix=suffix, delete=False) as f:
        f.write(content)
        return f.name


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    # 1. Upload a dataset artifact.
    dataset = lumina.LuminaArtifact(name="lineage-dataset", type="dataset")
    dataset.add_file(_write("id,label\n1,cat\n2,dog\n", ".csv"))
    dataset_result = dataset.save(project="demo", version="v1")
    dataset_version_id = dataset_result["version"]["id"]
    print(f"Dataset version: {dataset_version_id}")

    # 2. Upload a model artifact trained on that dataset.
    model = lumina.LuminaArtifact(name="lineage-model", type="model")
    model.add_file(_write("fake model weights", ".pt"))
    model_result = model.save(project="demo", version="v1")
    model_version_id = model_result["version"]["id"]
    print(f"Model version: {model_version_id}")

    # 3. Record lineage: model derived_from dataset.
    lumina.link_artifacts(model_version_id, dataset_version_id, lineage_type="derived_from")
    print("Linked model -> dataset (derived_from).")

    # 4. Query lineage from the child (model) side.
    lineage = lumina.artifact_lineage(model_version_id)
    print(f"Parents of model: {[p.get('id') for p in lineage.get('parents', [])]}")

    # 5. Detach the edge again.
    lumina.unlink_artifacts(model_version_id, dataset_version_id)
    after = lumina.artifact_lineage(model_version_id)
    print(f"Parents after unlink: {after.get('parents', [])}")


if __name__ == "__main__":
    main()
