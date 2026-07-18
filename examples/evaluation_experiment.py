"""Evaluation example for Lumina backend."""

import os
import tempfile

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    # Upload a dataset artifact
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write("id,label\n1,cat\n2,dog\n")
        dataset_path = f.name

    dataset_artifact = lumina.LuminaArtifact(
        name="demo-dataset",
        type="dataset",
        description="Demo evaluation dataset",
    )
    dataset_artifact.add_file(dataset_path)
    dataset_artifact.save(project="demo", version="v1")

    # Upload a model artifact
    with tempfile.NamedTemporaryFile(mode="w", suffix=".pt", delete=False) as f:
        f.write("fake model weights")
        model_path = f.name

    model_artifact = lumina.LuminaArtifact(
        name="demo-classifier",
        type="model",
        description="Demo classifier",
    )
    model_artifact.add_file(model_path)
    model_artifact.save(project="demo", version="v1")

    # Create an evaluation linking the dataset and model artifacts by name
    evaluation = lumina.init_eval(
        name="demo-eval",
        dataset="demo-dataset",
        model="demo-classifier",
        project="demo",
        metadata={"framework": "pytorch"},
    )
    print(f"Evaluation: {evaluation['id']}")

    # Log evaluation results
    lumina.log_eval_result("accuracy", 0.92)
    lumina.log_eval_result("f1", 0.91, metadata={"class": "macro"})

    # Finish evaluation
    finished = lumina.finish_eval("completed")
    print(f"Status: {finished['status']}")


if __name__ == "__main__":
    main()
