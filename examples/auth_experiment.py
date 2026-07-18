"""Auth example for Lumina backend."""

import os
import time

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    # Create a user (open sign-up endpoint). An API key is generated automatically.
    client = lumina.LuminaClient()
    email = f"demo{int(time.time())}@lumina.ai"
    user = client.create_user(email, name="Demo User")
    api_key = user["apiKey"]
    print(f"User: {user['id']}")
    print(f"API Key: {api_key}")

    # Authenticate subsequent requests
    lumina.login(api_key)

    # This request includes the Authorization header
    me = lumina.LuminaClient().get_current_user()
    print(f"Current user: {me['email']}")

    # Authenticated run logging still works
    lumina.init(project="demo", name="auth-run")
    lumina.log({"loss": 0.1}, step=0)
    lumina.finish()


if __name__ == "__main__":
    main()
