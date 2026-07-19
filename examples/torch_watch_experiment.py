"""torch model watching example for Lumina backend.

``run.watch(model)`` installs forward/backward hooks that log parameter and
gradient statistics as metrics. PyTorch is an optional dependency; if it is
missing the example skips cleanly.
"""

import os

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    try:
        import torch
        import torch.nn as nn
    except ImportError:
        print("SKIP: torch is required for this example (pip install torch).")
        return

    run = lumina.init(project="demo", name="torch-watch-run", config={"lr": 0.1})

    model = nn.Sequential(nn.Linear(8, 16), nn.ReLU(), nn.Linear(16, 1))
    optimizer = torch.optim.SGD(model.parameters(), lr=0.1)
    loss_fn = nn.MSELoss()

    # Log gradient AND parameter stats every step.
    run.watch(model, log="all", log_freq=1)

    for step in range(5):
        x = torch.randn(32, 8)
        y = torch.randn(32, 1)
        optimizer.zero_grad()
        pred = model(x)
        loss = loss_fn(pred, y)
        loss.backward()
        optimizer.step()
        run.log({"loss": loss.item()}, step=step)

    run.unwatch()
    run.finish()
    print("torch watch run finished (gradient/param stats logged).")


if __name__ == "__main__":
    main()
