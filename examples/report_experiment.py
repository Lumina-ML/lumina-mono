"""Report example for Lumina backend."""

import os

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    # Create a run and log some metrics
    run = lumina.init(project="demo", name="report-run", config={"lr": 0.01})
    for i in range(5):
        lumina.log({"loss": 1.0 / (i + 1), "acc": i / 5.0}, step=i)
    lumina.finish()

    # Build a report
    report = lumina.LuminaReport(
        title="Demo Report",
        project="demo",
        created_by="lumina-user",
    )
    report.add_text("This is a demo report built from the Lumina SDK.")
    report.add_metric("final_loss", 0.2)
    report.add_metric("final_acc", 0.8)
    report.add_run_gallery([run["runId"]])

    saved = report.save()
    print(f"Report: {saved['id']}")
    print(f"Blocks: {saved['blocks']}")


if __name__ == "__main__":
    main()
