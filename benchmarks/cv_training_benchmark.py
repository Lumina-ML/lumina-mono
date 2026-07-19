"""Business benchmark: computer-vision image-classification workflow.

Simulates training an image classifier and reports the full picture to Lumina:
- per-epoch train/val accuracy + loss curves
- sample prediction images logged via ``lumina.Image`` (needs numpy)
- a confusion matrix logged as a ``LuminaTable``
- a dataset artifact + per-epoch checkpoints, with model->dataset lineage
- a summary LuminaReport

Numbers/images are synthesized so the script runs without a real dataset or GPU.
NumPy is optional: image logging is skipped cleanly if it is missing.
"""

import os
import tempfile

import lumina
from _common import Timer, check_server, ensure_auth, loss_curve, synthetic_image

PROJECT = "benchmark-cv"
CLASSES = ["cat", "dog", "bird"]


def _checkpoint(epoch: int) -> str:
    with tempfile.NamedTemporaryFile("w", suffix=".pt", delete=False) as f:
        f.write(f"fake CNN weights @ epoch {epoch}")
        return f.name


def main() -> None:
    check_server()
    ensure_auth("cv")

    config = {
        "model": "resnet18",
        "dataset": "cifar-tiny",
        "epochs": 4,
        "batch_size": 128,
        "lr": 0.1,
        "num_classes": len(CLASSES),
    }
    run = lumina.init(project=PROJECT, name="cv-classification-benchmark", config=config)
    print(f"Run: {run['runId']}")

    run.define_metric("epoch")
    run.define_metric("val/acc", step_metric="epoch", summary="max")
    run.define_metric("train/loss", summary="min")

    # 1. Register the dataset artifact and remember its version for lineage.
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write("cifar-tiny: 300 images across 3 classes\n")
        dataset_path = f.name
    dataset = lumina.LuminaArtifact(name="cv-dataset", type="dataset")
    dataset.add_file(dataset_path)
    dataset_version_id = dataset.save(project=PROJECT, version="v1")["version"]["id"]

    train_losses = loss_curve(config["epochs"], start=1.6, floor=0.15)
    best_acc = 0.0

    with Timer() as timer:
        for epoch in range(config["epochs"]):
            train_loss = train_losses[epoch]
            val_acc = round(min(0.99, 0.55 + 0.1 * epoch + (0.05 - train_loss * 0.02)), 4)
            val_loss = round(train_loss * 1.1, 5)
            best_acc = max(best_acc, val_acc)
            run.log(
                {"epoch": epoch, "train/loss": train_loss, "val/loss": val_loss, "val/acc": val_acc},
                step=epoch,
            )

            # Log a couple of sample prediction images (if numpy available).
            img = synthetic_image(32, 32)
            if img is not None:
                pred = CLASSES[epoch % len(CLASSES)]
                run.log({"predictions": lumina.Image(img, caption=f"pred={pred}")}, step=epoch)

            # Checkpoint + record model<-dataset lineage.
            ckpt = lumina.log_model(
                path=_checkpoint(epoch),
                name="cv-model",
                aliases=[f"epoch-{epoch}"] + (["best"] if val_acc == best_acc else []),
                metadata={"epoch": epoch, "val_acc": val_acc},
                project=PROJECT,
            )
            try:
                lumina.link_artifacts(
                    ckpt["artifact_version"]["id"], dataset_version_id, lineage_type="derived_from"
                )
            except Exception as exc:  # noqa: BLE001
                print(f"  (lineage link skipped: {exc})")
            print(f"  epoch {epoch}: val/acc={val_acc} loss={train_loss}")

    # 2. Confusion matrix as a table.
    cm = lumina.LuminaTable(columns=["actual \\ predicted", *CLASSES])
    for i, actual in enumerate(CLASSES):
        row = [actual] + [90 if i == j else 5 for j in range(len(CLASSES))]
        cm.add_row(row)
    lumina.log({"confusion_matrix": cm}, step=config["epochs"])

    run.summary["best_val_acc"] = best_acc
    run.summary["train_seconds"] = round(timer.elapsed, 3)
    run.finish()

    # 3. Summary report.
    report = lumina.LuminaReport(title="CV Classification Benchmark", project=PROJECT, created_by="benchmark")
    report.add_text(f"Trained {config['model']} on {config['dataset']} for {config['epochs']} epochs.")
    report.add_metric("best_val_acc", best_acc)
    report.add_run_gallery([run["runId"]])
    saved = report.save()
    print(f"Report: {saved['id']}  |  best_val_acc={best_acc}  |  {timer.elapsed:.2f}s")


if __name__ == "__main__":
    main()
