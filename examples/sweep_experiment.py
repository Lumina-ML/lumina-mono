"""Sweep example: random search over lr and epochs."""

import lumina


def train(params: dict) -> dict:
    """Dummy training function."""
    lr = params["lr"]
    epochs = params["epochs"]
    # Lower loss is better; larger lr and more epochs reduce loss in this toy example.
    loss = 1.0 / (lr * 100) + epochs * 0.01
    return {"loss": loss}


def main():
    config = {
        "method": "random",
        "parameters": {
            "lr": {"min": 0.001, "max": 0.1, "distribution": "log_uniform"},
            "epochs": {"values": [5, 10, 20]},
        },
        "metric": {"name": "loss", "goal": "minimize"},
    }

    sweep = lumina.sweep(config, project="demo", name="lr-sweep")
    print(f"Created sweep: {sweep['id']}")

    results = lumina.agent(sweep["id"], function=train, count=5, project="demo")
    best = min(results, key=lambda r: r["summary"]["loss"])
    print(f"Best params: {best['params']} loss: {best['summary']['loss']}")


if __name__ == "__main__":
    main()
