# ml_service/train_model.py
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

print("[*] Generating synthetic Indian Railways Corridor Delay Dataset...")
np.random.seed(42)
N = 10000

# Synthetic dataset with realistic physical railway features
distance = np.random.uniform(5, 120, N)  # Distance to next station (km)
current_speed = np.random.uniform(15, 110, N)  # Real-time GPS speed
current_delay = np.random.exponential(scale=12, size=N)  # Accumulated delay
congestion = np.random.uniform(0.05, 0.95, N)  # Section line capacity utilization
tsr_flag = np.random.choice([0, 1], p=[0.75, 0.25], size=N)  # Temporary Speed Restriction
weather_code = np.random.choice([0, 1, 2], p=[0.7, 0.2, 0.1], size=N)  # 0:Clear, 1:Rain, 2:Fog
headway_distance = np.random.uniform(1, 25, N)  # Gap to preceding train in block section (km)

# Target: Delay introduced in THIS specific section
added_delay = (
    (distance / np.maximum(current_speed, 15)) * 60 * 0.15
    + (congestion * 18.0)
    + (tsr_flag * 9.5)
    + (weather_code * 6.0)
    + np.where(headway_distance < 4.0, 14.0, 0.0)  # Signal red-amber penalty
    + (current_delay * 0.08)  # Ripple effect
    + np.random.normal(0, 1.5, N)
)
added_delay = np.maximum(0.0, added_delay)

df = pd.DataFrame({
    "distance_km": distance,
    "speed_kmph": current_speed,
    "current_delay_min": current_delay,
    "congestion_ratio": congestion,
    "tsr_flag": tsr_flag,
    "weather_code": weather_code,
    "headway_km": headway_distance,
    "added_delay_min": added_delay
})

X = df.drop(columns=["added_delay_min"])
y = df["added_delay_min"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

print("[*] Training Gradient Boosting Regressor for Dynamic ETA...")
model = GradientBoostingRegressor(n_estimators=120, learning_rate=0.08, max_depth=5, random_state=42)
model.fit(X_train_scaled, y_train)

mae = mean_absolute_error(y_test, model.predict(X_test_scaled))
print(f"[✔] Model Trained Successfully! Test MAE: {mae:.2f} Minutes")

joblib.dump(model, "ml_service/model.pkl")
joblib.dump(scaler, "ml_service/scaler.pkl")
print("[✔] Saved model.pkl & scaler.pkl")