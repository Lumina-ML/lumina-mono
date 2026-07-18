"""Tables & Media example for Lumina backend."""

import os

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    # Start a run
    lumina.init(project="demo", name="media-run", config={"lr": 0.01})

    # Log scalar metrics as usual
    lumina.log({"loss": 0.2, "acc": 0.85}, step=0)

    # Log a table via lumina.log() — automatically detected as media
    table = lumina.LuminaTable(columns=["epoch", "loss", "acc"])
    table.add_row([0, 0.9, 0.1])
    table.add_row([1, 0.5, 0.6])
    table.add_row([2, 0.2, 0.85])
    lumina.log({"metrics_table": table}, step=0)

    # Log media explicitly
    lumina.log_media("notes", {"text": "experiment notes"}, type="file")

    # Finish run
    lumina.finish()

    print("Media logged successfully")


if __name__ == "__main__":
    main()
