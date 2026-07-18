"""Basic Lumina experiment: init -> log metrics/system/lines/tags -> finish."""

import lumina


def main():
    run = lumina.init(
        project="demo",
        name="basic-experiment",
        config={"lr": 0.01, "batch_size": 32},
    )
    print(f"Started run: {run['runId']}")

    for step in range(5):
        lumina.log({"loss": 1.0 / (step + 1), "acc": step / 5.0}, step=step)
        lumina.log_system({"cpu": 10.0 + step, "memory": 100.0 + step * 10}, step=step)
        lumina.log_line(f"completed step {step}", level="INFO", step=step)

    lumina.add_tag("baseline", color="#00ff00")
    lumina.add_tag("experiment")

    lumina.finish()
    print("Run finished.")


if __name__ == "__main__":
    main()
