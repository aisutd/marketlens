"""Validated API inputs; prediction outputs retain the library's native fields."""
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)


class LaunchRequest(RequestModel):
    category: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0, description="Everyday selling price in USD")
    review_count: int = Field(ge=0, strict=True)
    months_on_market: int = Field(ge=0, strict=True)
    list_price: float | None = Field(default=None, gt=0)
    sub_category: str = Field(default="", max_length=200)
    brand: str = Field(default="", max_length=200)
    name: str = Field(default="", max_length=1000)
    rating: float = Field(default=4.2, gt=0, le=5)
    review_sentiment: float | None = Field(default=None, ge=-1, le=1)
    n_bullets: int | None = Field(default=None, ge=0, strict=True)
    about_len: int | None = Field(default=None, ge=0, strict=True)
    size_tier: Literal["small_standard", "large_standard", "large_standard_heavy", "large_bulky"] | None = None
    weight_lb: float | None = Field(default=None, gt=0)
    landed_cost: float | None = Field(default=None, gt=0)
    launch_month: int | None = Field(default=None, ge=1, le=12, strict=True)
    is_bundle: bool | None = Field(default=None, strict=True)

    @model_validator(mode="after")
    def check_prices(self):
        if self.list_price is not None and self.list_price < self.price:
            raise ValueError("list_price must be greater than or equal to price")
        return self


class MonthlyRequest(RequestModel):
    product_id: str = Field(min_length=1, max_length=100)
    promo_depth_pct: float | None = Field(default=None, ge=0, lt=100, description="Planned discount percentage, from 0 up to but excluding 100")
    everyday_price: float | None = Field(default=None, gt=0)


class YearlyRequest(RequestModel):
    product_id: str = Field(min_length=1, max_length=100)
    year: int = Field(default=2026, ge=2000, le=2100, strict=True)
    promo_months: int | None = Field(default=None, ge=0, le=12, strict=True)


class DataResponse(BaseModel):
    data: dict[str, Any]


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: list[dict[str, Any]] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: ErrorDetail
