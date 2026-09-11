import sys
from pathlib import Path

from fastapi.testclient import TestClient

# The CI runner executes pytest from the backend directory, but pytest's
# collection path can make the application package unavailable on sys.path.
# Add the backend root explicitly so the smoke test works in every runner.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "agata-api"}
