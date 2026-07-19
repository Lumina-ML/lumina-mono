"""Alerts / preemption example for Lumina backend.

Demonstrates run-lifecycle signalling that a plain metric loop never touches:
- ``run.pin_config_keys`` to surface important config first
- ``run.alert`` at INFO/WARN/ERROR levels (rate-limited by title)
- ``run.mark_preempting`` to flag a run being pre-empted (e.g. spot instance)
- finishing with an explicit terminal status
"""

import os

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    run = lumina.init(
        project="demo",
        name="alert-preempt-run",
        config={"lr": 0.01, "batch_size": 64, "model": "resnet18"},
    )
    print(f"Started run: {run['runId']}")

    # Pin the config keys that matter most so they sort first in the UI.
    run.pin_config_keys("model", "lr")

    for step in range(5):
        loss = 1.0 / (step + 1)
        run.log({"loss": loss}, step=step)

        if step == 0:
            run.alert("Training started", "Baseline run kicked off", level="INFO")
        if loss > 0.9:
            # Rate-limited by title: only the first WARN with this title is sent
            # within the default 1-minute window.
            run.alert("High loss", f"loss={loss:.3f} at step {step}", level="WARN")

    # Simulate a spot-instance pre-emption before the run naturally completes.
    run.alert("Preemption", "Spot instance reclaimed; checkpointing", level="ERROR")
    run.mark_preempting()

    # Finish the run. Captured alerts are flushed to run metadata
    # (`_lumina_alerts`) and final summary aggregations are pushed on finish.
    run.finish()
    print("Run finished (alerts flushed to metadata).")


if __name__ == "__main__":
    main()
