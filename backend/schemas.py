# backend/schemas.py
from pydantic import BaseModel

class ConditionUpdateSchema(BaseModel):
    current_speed: float
    current_delay: float
    downstream_congestion: float
    speed_restriction: int
    weather_severity: int
    headway_km: float