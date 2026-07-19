"""Business benchmark: LLM supervised fine-tuning (SFT) workflow.

Simulates an end-to-end SFT run and reports the full picture to Lumina:
- per-step train loss + learning-rate (cosine) schedule + grad norm
- per-epoch validation loss / perplexity (declared via define_metric)
- a dataset artifact and per-epoch model checkpoints in the Model Registry
- an Evaluation linking the dataset + final model
- a summary LuminaReport

No GPU or real model required — numbers are synthesized so the script runs
anywhere the Lumina backend is reachable.
"""

import math
import os
import tempfile

import lumina
from _common import Timer, check_server, ensure_auth, loss_curve

PROJECT = "benchmark-llm"


def _cosine_lr(base_lr: float, step: int, total: int) -> float:
    return round(base_lr * 0.5 * (1 + math.cos(math.pi * step / max(total, 1))), 8)


def _checkpoint(epoch: int) -> str:
    with tempfile.NamedTemporaryFile("w", suffix=".pt", delete=False) as f:
        f.write(f"fake SFT weights @ epoch {epoch}")
        return f.name


def main() -> None:
    check_server()
    ensure_auth("llm")

    config = {
        "model": "llama-3-8b",
        "task": "sft",
        "lr": 2e-5,
        "epochs": 3,
        "batch_size": 16,
        "seq_len": 2048,
        "steps_per_epoch": 40,
    }
    run = lumina.init(project=PROJECT, name="llm-sft-benchmark", config=config)
    print(f"Run: {run['runId']}")

    # Declare metric semantics.
    run.define_metric("epoch")
    run.define_metric("train/loss", summary="min")
    run.define_metric("val/loss", step_metric="epoch", summary="min")
    run.define_metric("val/perplexity", step_metric="epoch", summary="min")

    # 1. Register the training dataset as an artifact.
    with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
        f.write('{"prompt": "hi", "completion": "hello"}\n')
        dataset_path = f.name
    dataset = lumina.LuminaArtifact(name="llm-sft-dataset", type="dataset")
    dataset.add_file(dataset_path)
    dataset.save(project=PROJECT, version="v1")

    total_steps = config["epochs"] * config["steps_per_epoch"]
    global_step = 0
    best_val = float("inf")

    with Timer() as timer:
        for epoch in range(config["epochs"]):
            losses = loss_curve(config["steps_per_epoch"], start=2.5, floor=0.3)
            for i, loss in enumerate(losses):
                lr = _cosine_lr(config["lr"], global_step, total_steps)
                grad_norm = round(abs(loss) * (0.8 + 0.4 * (i % 3)), 4)
                run.log(
                    {"train/loss": loss, "lr": lr, "grad_norm": grad_norm},
                    step=global_step,
                )
                global_step += 1

            # Validation at epoch boundary.
            val_loss = round(losses[-1] * 1.15, 5)
            val_ppl = round(math.exp(min(val_loss, 20)), 4)
            best_val = min(best_val, val_loss)
            run.log({"epoch": epoch, "val/loss": val_loss, "val/perplexity": val_ppl}, step=global_step)

            # Checkpoint this epoch's model.
            ckpt = lumina.log_model(
                path=_checkpoint(epoch),
                name="llm-sft-model",
                aliases=[f"epoch-{epoch}"] + (["best"] if val_loss == best_val else []),
                metadata={"epoch": epoch, "val_loss": val_loss},
                project=PROJECT,
            )
            print(f"  epoch {epoch}: val/loss={val_loss} ppl={val_ppl} ckpt={ckpt['version']['id']}")

    run.summary["best_val_loss"] = best_val
    run.summary["train_seconds"] = round(timer.elapsed, 3)
    run.summary["throughput_steps_per_s"] = round(total_steps / timer.elapsed, 2)

    # 2. Evaluation linking dataset + final model.
    lumina.init_eval(
        name="llm-sft-eval",
        dataset="llm-sft-dataset",
        model="llm-sft-model",
        project=PROJECT,
        metadata={"split": "validation"},
    )
    lumina.log_eval_result("val_loss", best_val)
    lumina.log_eval_result("perplexity", round(math.exp(min(best_val, 20)), 4))
    lumina.finish_eval("completed")

    run.finish()

    # 3. Summary report.
    report = lumina.LuminaReport(title="LLM SFT Benchmark", project=PROJECT, created_by="benchmark")
    report.add_text(f"Fine-tuned {config['model']} for {config['epochs']} epochs.")
    report.add_metric("best_val_loss", best_val)
    report.add_metric("train_seconds", round(timer.elapsed, 3))
    report.add_run_gallery([run["runId"]])
    saved = report.save()
    print(f"Report: {saved['id']}  |  best_val_loss={best_val}  |  {timer.elapsed:.2f}s")


if __name__ == "__main__":
    main()
