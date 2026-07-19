"""WandB-compatible media logging example for Lumina backend.

``lumina.log({...})`` auto-detects media values and routes them through the
media pipeline (file upload + run-media registration) instead of the scalar
metric path. This shows the WandB-compatible media types:
- ``lumina.Image`` (from a NumPy array)
- ``lumina.Histogram``
- ``lumina.Table``

NumPy is an optional dependency; if it is missing the example skips cleanly.
"""

import os

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    try:
        import numpy as np
    except ImportError:
        print("SKIP: numpy is required for this example (pip install numpy).")
        return

    lumina.init(project="demo", name="wandb-media-run", config={"lr": 0.01})

    # Scalar metrics take the normal path.
    lumina.log({"loss": 0.3, "acc": 0.9}, step=0)

    # An image from a NumPy array (H, W, 3) uint8 — detected as media.
    img_array = (np.random.rand(32, 32, 3) * 255).astype("uint8")
    lumina.log({"sample_image": lumina.Image(img_array, caption="random sample")}, step=0)

    # A histogram of a value distribution — detected as media.
    values = np.random.randn(1000)
    lumina.log({"weight_dist": lumina.Histogram(values)}, step=0)

    # A wandb-compatible Table — detected as media.
    table = lumina.Table(columns=["epoch", "loss", "acc"])
    table.add_data(0, 0.9, 0.1)
    table.add_data(1, 0.5, 0.6)
    table.add_data(2, 0.3, 0.9)
    lumina.log({"metrics_table": table}, step=2)

    lumina.finish()
    print("WandB-compatible media logged successfully.")


if __name__ == "__main__":
    main()
