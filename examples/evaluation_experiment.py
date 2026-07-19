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

    # Record structured summary data. These populate the dashboard's
    # Evaluation detail visualizations (confusion matrix, PR curve, threshold
    # sweep); repeated calls merge into Evaluation.summary rather than clobber.
    lumina.log_eval_summary(
        num_samples=200,
        confusion_matrix={
            "labels": ["cat", "dog"],
            "matrix": [
                [92, 8],   # actual cat  -> predicted [cat, dog]
                [7, 93],   # actual dog  -> predicted [cat, dog]
            ],
        },
        pr_curve=[
            {"recall": 0.0, "precision": 1.00},
            {"recall": 0.5, "precision": 0.95},
            {"recall": 0.8, "precision": 0.90},
            {"recall": 1.0, "precision": 0.85},
        ],
        threshold_sweep=[
            {"threshold": 0.3, "precision": 0.82, "recall": 0.97, "f1": 0.89},
            {"threshold": 0.5, "precision": 0.91, "recall": 0.92, "f1": 0.91},
            {"threshold": 0.7, "precision": 0.96, "recall": 0.83, "f1": 0.89},
        ],
    )

    # Finish evaluation
    finished = lumina.finish_eval("completed")
    print(f"Status: {finished['status']}")


if __name__ == "__main__":
    main()
