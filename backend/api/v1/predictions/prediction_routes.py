from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute

from core.deps import CurrentUser, get_current_user
from prediction.model_registry import get_model_registry
from prediction.schemas import WeightEstimationRequest, WeightEstimationResponse


class UnprocessableEntityValidationRoute(APIRoute):
    def get_route_handler(self):
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request):
            try:
                return await original_route_handler(request)
            except RequestValidationError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=exc.errors(),
                ) from exc

        return custom_route_handler


predictions_router = APIRouter(
    prefix="/api/v1/predictions",
    tags=["predictions"],
    route_class=UnprocessableEntityValidationRoute,
)

weight_estimation_predictor = get_model_registry().get_default()

WEIGHT_ESTIMATION_REQUEST_EXAMPLE = {
    "species": "cattle",
    "breed": "minhota",
    "sex": "female",
    "age_months": 28,
    "measurements": {
        "body_length_cm": 152.4,
        "withers_height_cm": 126.8,
        "thoracic_depth_cm": 65.9,
        "rump_width_cm": 50.2,
        "chest_girth_cm": 194.3,
    },
}


@predictions_router.post(
    "/weight-estimation",
    response_model=WeightEstimationResponse,
    status_code=status.HTTP_200_OK,
    summary="Estimate livestock weight from morphometric measurements",
)
def estimate_weight(
    payload: WeightEstimationRequest = Body(
        ...,
        openapi_examples={
            "baseline_formula_request": {
                "summary": "Formula-based weight estimation request",
                "value": WEIGHT_ESTIMATION_REQUEST_EXAMPLE,
            },
        },
    ),
    current: CurrentUser = Depends(get_current_user),
) -> WeightEstimationResponse:
    try:
        return weight_estimation_predictor.predict(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
