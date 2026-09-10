# backend/database.py
import sqlite3
import json
import random
from datetime import datetime, timedelta

DB_PATH = "railway_system.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Active Trains
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trains (
        train_no TEXT PRIMARY KEY,
        train_name TEXT,
        source TEXT,
        destination TEXT,
        current_lat REAL,
        current_lng REAL,
        current_speed REAL,
        current_delay REAL,
        downstream_congestion REAL,
        speed_restriction INTEGER,
        weather_severity INTEGER,
        headway_km REAL,
        route_stations TEXT,
        track_geometry TEXT
    )
    """)

    # 2. Historical Section Run Times (Last 30 days data)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS historical_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        train_no TEXT,
        journey_date TEXT,
        section_name TEXT,
        scheduled_time_min REAL,
        actual_time_min REAL,
        delay_recorded_min REAL,
        cause_of_delay TEXT
    )
    """)

    # 3. Model Accuracy Drift Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS accuracy_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        train_no TEXT,
        ntes_static_error_min REAL,
        ai_dynamic_error_min REAL
    )
    """)

    # Seed Active Corridors
    sample_trains = [
        (
            "12424",
            "NDLS-DBRG Rajdhani Express",
            "New Delhi",
            "Dibrugarh",
            25.3176,
            82.9739,
            88.0,
            14.0,
            0.30,
            0,
            0,
            12.0,
            json.dumps([
                {"station_code": "DDU", "station_name": "Pt. Deen Dayal Upadhyaya Jn", "distance_from_curr_km": 18.0, "scheduled_arrival": "19:10"},
                {"station_code": "BXR", "station_name": "Buxar", "distance_from_curr_km": 112.0, "scheduled_arrival": "20:25"},
                {"station_code": "ARA", "station_name": "Ara Jn", "distance_from_curr_km": 181.0, "scheduled_arrival": "21:18"},
                {"station_code": "PNBE", "station_name": "Patna Jn", "distance_from_curr_km": 230.0, "scheduled_arrival": "22:15"}
            ]),
            json.dumps([
                [25.3176, 82.9739], [25.2810, 83.1170], [25.5647, 83.9777], [25.5541, 84.6660], [25.6093, 85.1235]
            ])
        ),
        (
            "22436",
            "Vande Bharat Express",
            "New Delhi",
            "Varanasi Jn",
            25.4358,
            81.8463,
            115.0,
            3.0,
            0.15,
            0,
            0,
            18.0,
            json.dumps([
                {"station_code": "PRYJ", "station_name": "Prayagraj Jn", "distance_from_curr_km": 12.0, "scheduled_arrival": "12:10"},
                {"station_code": "JNH", "station_name": "Janghai Jn", "distance_from_curr_km": 65.0, "scheduled_arrival": "13:00"},
                {"station_code": "BSB", "station_name": "Varanasi Jn", "distance_from_curr_km": 124.0, "scheduled_arrival": "14:00"}
            ]),
            json.dumps([
                [25.4358, 81.8463], [25.4484, 81.8340], [25.7170, 82.2870], [25.3268, 82.9860]
            ])
        ),
        (
            "12382",
            "Poorva Express",
            "New Delhi",
            "Howrah Jn",
            25.3300,
            83.0100,
            45.0,
            42.0,
            0.75,
            1,
            1,
            2.5,
            json.dumps([
                {"station_code": "DDU", "station_name": "Pt. Deen Dayal Upadhyaya Jn", "distance_from_curr_km": 15.0, "scheduled_arrival": "18:40"},
                {"station_code": "SSM", "station_name": "Sasaram Jn", "distance_from_curr_km": 115.0, "scheduled_arrival": "20:05"},
                {"station_code": "GAYA", "station_name": "Gaya Jn", "distance_from_curr_km": 218.0, "scheduled_arrival": "21:50"}
            ]),
            json.dumps([
                [25.3300, 83.0100], [25.2810, 83.1170], [24.9500, 84.0300], [24.7955, 85.0002]
            ])
        )
    ]

    cursor.executemany("INSERT OR REPLACE INTO trains VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", sample_trains)

    # Seed 30 Days of realistic historical running data if empty
    cursor.execute("SELECT COUNT(*) FROM historical_logs")
    if cursor.fetchone()[0] == 0:
        sections = [
            ("Varanasi - DDU Block", 25.0),
            ("DDU - Buxar Corridor", 65.0),
            ("Buxar - Ara Mainline", 55.0),
            ("Ara - Patna Terminal Approach", 45.0)
        ]
        delay_reasons = [
            "Downstream Freight Train Precedence",
            "Speed Restriction (Track Maintenance)",
            "Foggy Weather & Sighting Distance",
            "Platform Congestion at Junction",
            "Automatic Signal Aspect Red"
        ]
        
        hist_rows = []
        now = datetime.now()
        for i in range(30, 0, -1):
            date_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            for sec, sch_time in sections:
                added = max(0, round(random.gauss(8, 6), 1))
                act_time = sch_time + added
                cause = random.choice(delay_reasons) if added > 5 else "On-Time Clearance"
                hist_rows.append(("12424", date_str, sec, sch_time, act_time, added, cause))
        
        cursor.executemany("""
        INSERT INTO historical_logs (train_no, journey_date, section_name, scheduled_time_min, actual_time_min, delay_recorded_min, cause_of_delay)
        VALUES (?,?,?,?,?,?,?)
        """, hist_rows)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("[✔] Database initialized with 30-day historical logs and accuracy tracking.")