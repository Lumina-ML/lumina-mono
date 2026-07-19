"""Config / summary / define_metric / save+restore example for Lumina backend.

Demonstrates the run-object surface that the scalar-logging examples skip:
- reading & mutating ``run.config`` and ``run.summary``
- ``run.define_metric`` to declare how a metric is summarized / its step axis
- ``run.save`` to upload a run file, then restoring it via the client
"""

import os
import tempfile

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    run = lumina.init(
        project="demo",
        name="config-summary-run",
        config={"lr": 0.01, "batch_size": 32, "optimizer": "adam"},
    )
    print(f"Started run: {run['runId']}")

    # Config behaves like a dict; update it after init.
    run.config["epochs"] = 3
    run.config.update({"weight_decay": 1e-4})
    print(f"Config: {run.config.as_dict()}")

    # Declare metric semantics: val_loss is tracked against the `epoch` axis and
    # summarized by its minimum; train_loss keeps its last value.
    run.define_metric("epoch")
    run.define_metric("val_loss", step_metric="epoch", summary="min")
    run.define_metric("train_loss", summary="last")

    for epoch in range(3):
        train_loss = 1.0 / (epoch + 1)
        val_loss = 1.2 / (epoch + 1)
        run.log({"epoch": epoch, "train_loss": train_loss, "val_loss": val_loss}, step=epoch)

    # Summary is auto-aggregated from logged metrics, and can also be set directly.
    run.summary["best_val_loss"] = 0.4
    run.summary["notes"] = "converged early"
    print(f"Summary: {dict(run.summary.items())}")

    # Save a run file (e.g. a config dump or final weights), then restore it.
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write("final hyperparameters snapshot\n")
        local_path = f.name
    saved = run.save(local_path, glob=False)
    print(f"Saved run files: {saved}")

    files = run._client.list_run_files(run["runId"])
    print(f"Run files on server: {[f['path'] for f in files.get('items', files.get('files', []))]}")

    restored = run._client.restore_run_file(run["runId"], os.path.basename(local_path))
    print(f"Restored content: {restored.decode('utf-8').strip()!r}")

    run.finish()
    print("Run finished.")


if __name__ == "__main__":
    main()
