import os
import sqlite3
import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx

from backend.database import DB_PATH, init_db
from backend.schemas import ConditionUpdateSchema


app = FastAPI(
    title="Dynamic Train ETA - Core Backend API"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


init_db()


# ==========================================
# DATABASE PATH
# ==========================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)


def get_database_path():

    if os.path.isabs(DB_PATH):
        return DB_PATH

    return os.path.join(
        BASE_DIR,
        DB_PATH
    )


# ==========================================
# DATABASE HELPER
# ==========================================

def query_db(
    query,
    args=(),
    one=False
):

    db_path = get_database_path()

    conn = sqlite3.connect(
        db_path
    )

    conn.row_factory = sqlite3.Row

    cur = conn.cursor()

    cur.execute(
        query,
        args
    )

    rows = cur.fetchall()

    conn.commit()
    conn.close()

    if one:
        return rows[0] if rows else None

    return rows


# ==========================================
# ALL TRAINS
# ==========================================

@app.get("/api/trains")
def list_available_trains():

    trains = query_db(
        """
        SELECT
            train_no,
            train_name,
            source,
            destination
        FROM trains
        """
    )

    return [
        {
            "train_no": train["train_no"],
            "train_name": train["train_name"],
            "route":
                f"{train['source']} ➔ {train['destination']}"
        }
        for train in trains
    ]


# ==========================================
# TRAIN LIVE TELEMETRY + ML
# ==========================================

@app.get("/api/trains/{train_no}")
async def get_train_telemetry(
    train_no: str
):

    row = query_db(
        """
        SELECT *
        FROM trains
        WHERE train_no = ?
        """,
        (train_no,),
        one=True
    )

    if not row:

        return {
            "error":
                "Train not found in active database"
        }

    train_data = dict(row)

    stations = json.loads(
        train_data.get(
            "route_stations",
            "[]"
        )
    )

    track_geometry = json.loads(
        train_data.get(
            "track_geometry",
            "[]"
        )
    )

    ml_payload = {

        "train_no":
            train_no,

        "current_speed_kmph":
            train_data.get(
                "current_speed",
                0
            ),

        "current_delay_min":
            train_data.get(
                "current_delay",
                0
            ),

        "downstream_congestion":
            train_data.get(
                "downstream_congestion",
                0
            ),

        "speed_restriction":
            train_data.get(
                "speed_restriction",
                0
            ),

        "weather_severity":
            train_data.get(
                "weather_severity",
                0
            ),

        "headway_km":
            train_data.get(
                "headway_km",
                0
            ),

        "stations":
            stations
    }


    # ======================================
    # ML PREDICTION
    # ======================================

    try:

        async with httpx.AsyncClient() as client:

            response = await client.post(
                "http://127.0.0.1:8001/predict-eta",
                json=ml_payload,
                timeout=2.5
            )

            response.raise_for_status()

            predictions = response.json().get(
                "predictions",
                []
            )

    except Exception as error:

        print(
            "ML service error:",
            error
        )

        predictions = []


    train_data[
        "upcoming_predictions"
    ] = predictions

    train_data[
        "track_geometry"
    ] = track_geometry

    train_data[
        "route_stations"
    ] = stations


    return train_data


# ==========================================
# JOURNEY HISTORY
# ==========================================

@app.get(
    "/api/trains/{train_no}/history"
)
def get_historical_records(
    train_no: str
):

    rows = query_db(
        """
        SELECT
            train_no,
            journey_date,
            section_name,
            scheduled_time_min,
            actual_time_min,
            delay_recorded_min,
            cause_of_delay
        FROM historical_logs
        WHERE train_no = ?
        ORDER BY journey_date DESC
        LIMIT 20
        """,
        (train_no,)
    )


    return [
        {
            "train_no":
                row["train_no"],

            "journey_date":
                row["journey_date"],

            "section_name":
                row["section_name"],

            "scheduled_time_min":
                row["scheduled_time_min"],

            "actual_time_min":
                row["actual_time_min"],

            "delay_recorded_min":
                row["delay_recorded_min"],

            "cause_of_delay":
                row["cause_of_delay"]
        }

        for row in rows
    ]


# ==========================================
# UPDATE TELEMETRY
# ==========================================

@app.post(
    "/api/trains/{train_no}/telemetry"
)
async def update_telemetry(
    train_no: str,
    cond: ConditionUpdateSchema
):

    query_db(
        """
        UPDATE trains
        SET
            current_speed = ?,
            current_delay = ?,
            downstream_congestion = ?,
            speed_restriction = ?,
            weather_severity = ?,
            headway_km = ?
        WHERE train_no = ?
        """,
        (
            cond.current_speed,
            cond.current_delay,
            cond.downstream_congestion,
            cond.speed_restriction,
            cond.weather_severity,
            cond.headway_km,
            train_no
        )
    )


    return {
        "status": "SUCCESS",
        "message":
            "Telemetry stream updated"
    }


# ==========================================
# RUN SERVER
# ==========================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000
    )