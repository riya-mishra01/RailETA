import os
from datetime import datetime, timedelta
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import joblib
import numpy as np
from pydantic import BaseModel


app = FastAPI(title="RailGati AI - Standalone ML Prediction Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

model = joblib.load(os.path.join(BASE_DIR, "model.pkl"))
scaler = joblib.load(os.path.join(BASE_DIR, "scaler.pkl"))


class StationNode(BaseModel):
    station_code: str
    station_name: str
    distance_from_curr_km: float
    scheduled_arrival: str


class MLPredictionRequest(BaseModel):
    train_no: str
    current_speed_kmph: float
    current_delay_min: float
    downstream_congestion: float
    speed_restriction: int
    weather_severity: int
    headway_km: float
    stations: List[StationNode]


@app.post("/predict-eta")
def predict_eta(req: MLPredictionRequest):

    now = datetime.now()

    results = []

    previous_distance = 0.0
    propagated_delay = max(0.0, req.current_delay_min)

    for index, stn in enumerate(req.stations):

        distance = max(
            2.0,
            float(stn.distance_from_curr_km)
        )

        hop_distance = max(
            2.0,
            distance - previous_distance
        )

        previous_distance = distance

        features = np.array([[
            hop_distance,
            req.current_speed_kmph,
            propagated_delay,
            req.downstream_congestion,
            req.speed_restriction,
            req.weather_severity,
            req.headway_km
        ]])

        scaled_features = scaler.transform(features)

        model_delay = float(
            model.predict(scaled_features)[0]
        )

        # Environmental / operational impact
        congestion_impact = req.downstream_congestion * 6.0
        restriction_impact = 5.0 if req.speed_restriction else 0.0
        weather_impact = req.weather_severity * 3.0
        headway_impact = 4.0 if req.headway_km < 4 else 0.0

        # Delay added in this section
        section_delay = (
            max(0.5, model_delay * 0.35)
            + congestion_impact
            + restriction_impact
            + weather_impact
            + headway_impact
        )

        # Small natural propagation
        if index > 0:
            section_delay *= 0.65

        propagated_delay += section_delay

        # Running time
        effective_speed = max(
            25.0,
            req.current_speed_kmph * 0.92
        )

        runtime_minutes = (
            distance / effective_speed
        ) * 60.0

        predicted_time = (
            now +
            timedelta(
                minutes=runtime_minutes + propagated_delay
            )
        )

        # Confidence decreases with distance and operational uncertainty
        uncertainty = (
            distance * 0.045
            + req.downstream_congestion * 18
            + req.weather_severity * 7
            + (6 if req.speed_restriction else 0)
            + (5 if req.headway_km < 4 else 0)
        )

        confidence = int(
            np.clip(
                97 - uncertainty,
                60,
                96
            )
        )

        # Risk
        if propagated_delay >= 35 or req.downstream_congestion >= 0.75:
            risk = "High"
        elif propagated_delay >= 15 or req.downstream_congestion >= 0.45:
            risk = "Medium"
        else:
            risk = "Low"

        results.append({

            "station_code": stn.station_code,

            "station_name": stn.station_name,

            "distance_km": round(
                distance,
                1
            ),

            "scheduled_arrival": stn.scheduled_arrival,

            "predicted_eta": predicted_time.strftime(
                "%I:%M %p"
            ),

            "expected_delay_min": round(
                propagated_delay,
                1
            ),

            "confidence_score": confidence,

            "risk_assessment": risk,

            "section_delay_min": round(
                section_delay,
                1
            )
        })

    return {
        "train_no": req.train_no,
        "status": "COMPLETED",
        "predictions": results
    }


if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8001
    )