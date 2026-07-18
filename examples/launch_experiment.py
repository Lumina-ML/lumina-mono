"""Launch (Job Scheduling) example for Lumina backend."""

import os
import time

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    # Sign up and authenticate
    client = lumina.LuminaClient()
    email = f"launch{int(time.time())}@lumina.ai"
    user = client.create_user(email, name="Launch User")
    lumina.login(user["apiKey"])

    # Resolve project id
    client = lumina.LuminaClient()
    project_obj = client.get_project_by_name("demo")
    if not project_obj:
        project_obj = client._request("POST", "/api/v1/projects", {"name": "demo"})
    project_id = project_obj["id"]

    suffix = str(int(time.time()))
    queue_name = f"default-queue-{suffix}"
    job_name = f"hello-job-{suffix}"

    # Create a queue and a job
    queue = client.create_launch_queue(project_id, queue_name)
    print(f"Queue: {queue['id']}")

    job = client.create_launch_job(
        project_id,
        job_name,
        command=["python", "-c"],
        args=["print('hello from launch')"],
    )
    print(f"Job: {job['id']}")

    # Enqueue a run
    run = lumina.launch(queue_name, job_name, project="demo")
    print(f"Launch run: {run['id']}")

    # Run a local agent that executes one pending run
    executed = lumina.launch_agent(
        queue_name,
        project="demo",
        max_runs=1,
        poll_interval=1,
    )
    print(f"Executed: {len(executed)} run(s)")


if __name__ == "__main__":
    main()
