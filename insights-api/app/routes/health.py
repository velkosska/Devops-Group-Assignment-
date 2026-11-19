from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness check. Deliberately does not touch the database."""
    return {"status": "ok"}
