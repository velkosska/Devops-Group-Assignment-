"""HTTP endpoints for job applications.

A route reads the request, calls ApplicationService, and chooses the status
code. It does not run SQL or decide whether a stage move is allowed.
"""

from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.db import get_session
from app.domain.applications import ApplicationError
from app.repositories.applications import ApplicationRecord, SqlApplicationRepository
from app.schemas.applications import (
    ApplicationResponse,
    CreateApplicationRequest,
    StageChangeRequest,
    UpdateApplicationRequest,
)
from app.services.applications import ApplicationNotFound, ApplicationService
from app.services.insights import InsightsEvents

router = APIRouter()


def get_application_service(
    request: Request, session: Session = Depends(get_session)
) -> ApplicationService:
    """Build the service for this request from Marija's session dependency."""
    return ApplicationService(
        SqlApplicationRepository(session), InsightsEvents(request.app.state.settings)
    )


def _to_response(record: ApplicationRecord) -> ApplicationResponse:
    return ApplicationResponse(
        id=record.id,
        company=record.company,
        role=record.role,
        stage=record.stage,
        url=record.url,
        location=record.location,
        salary_range=record.salary_range,
        applied_at=record.applied_at,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _call[T](action: Callable[[], T]) -> T:
    """Turn a domain failure into the status code the board already expects."""
    try:
        return action()
    except ApplicationNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ApplicationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/applications", status_code=201, response_model=ApplicationResponse)
def create_application(
    body: CreateApplicationRequest,
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationResponse:
    record = _call(
        lambda: service.create(
            company=body.company,
            role=body.role,
            stage=body.stage,
            url=body.url,
            location=body.location,
            salary_range=body.salary_range,
            applied_at=body.applied_at,
        )
    )
    return _to_response(record)


@router.get("/applications", response_model=list[ApplicationResponse])
def list_applications(
    stage: str | None = None,
    service: ApplicationService = Depends(get_application_service),
) -> list[ApplicationResponse]:
    records = _call(lambda: service.list_applications(stage))
    return [_to_response(record) for record in records]


@router.get("/applications/{application_id}", response_model=ApplicationResponse)
def get_application(
    application_id: int,
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationResponse:
    return _to_response(_call(lambda: service.get(application_id)))


@router.put("/applications/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: int,
    body: UpdateApplicationRequest,
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationResponse:
    record = _call(
        lambda: service.update(
            application_id,
            company=body.company,
            role=body.role,
            url=body.url,
            location=body.location,
            salary_range=body.salary_range,
            applied_at=body.applied_at,
        )
    )
    return _to_response(record)


@router.patch("/applications/{application_id}/stage", response_model=ApplicationResponse)
def change_stage(
    application_id: int,
    body: StageChangeRequest,
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationResponse:
    record = _call(lambda: service.change_stage(application_id, body.stage))
    return _to_response(record)


@router.delete("/applications/{application_id}", status_code=204)
def delete_application(
    application_id: int,
    service: ApplicationService = Depends(get_application_service),
) -> Response:
    _call(lambda: service.delete(application_id))
    return Response(status_code=204)
