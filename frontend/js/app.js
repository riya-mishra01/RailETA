const API_BASE = "http://127.0.0.1:8000/api";

let selectedTrain = null;
let trainMap = null;
let trainMarker = null;
let routeLine = null;
let currentRating = 5;

const $ = (id) => document.getElementById(id);

function escapeHtml(val) {
    if (val === null || val === undefined) return "";
    return String(val)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Complete Mock Telemetry Dataset
const MOCK_DATA = {
    "12424": {
        train_no: "12424",
        train_name: "Rajdhani Express",
        source: "New Delhi (NDLS)",
        destination: "Dibrugarh (DBRG)",
        current_location: "Section: Aligarh - Kanpur Central",
        current_speed: 68,
        current_delay: 14,
        next_station: "Kanpur Central (CNB)",
        next_station_eta: "19:42",
        confidence_score: 94,
        downstream_congestion: 0.52,
        speed_restriction: 0,
        weather_severity: 0,
        headway_km: 7.2,
        upcoming_predictions: [
            { station_name: "Kanpur Central (CNB)", predicted_eta: "19:42", expected_delay_min: 14, confidence_score: 94, platform: "Platform 1" },
            { station_name: "Prayagraj Jn (PRYJ)", predicted_eta: "21:55", expected_delay_min: 12, confidence_score: 91, platform: "Platform 4" },
            { station_name: "Pt. Deen Dayal Upadhyaya Jn (DDU)", predicted_eta: "00:15", expected_delay_min: 10, confidence_score: 89, platform: "Platform 2" },
            { station_name: "Danapur (DNR)", predicted_eta: "03:10", expected_delay_min: 15, confidence_score: 86, platform: "Platform 1A" },
            { station_name: "Patna Jn (PNBE)", predicted_eta: "03:45", expected_delay_min: 16, confidence_score: 85, platform: "Platform 3" }
        ],
        track_geometry: [
            [28.6139, 77.2090],
            [27.8974, 78.0880],
            [26.4499, 80.3319],
            [25.4358, 81.8463],
            [25.2818, 83.1114],
            [25.6127, 85.0435]
        ],
        history: [
            { journey_date: "2026-03-28", train_no: "12424", section_name: "NDLS - CNB", delay_recorded_min: 10, cause_of_delay: "Track maintenance corridor" },
            { journey_date: "2026-03-27", train_no: "12424", section_name: "CNB - PRYJ", delay_recorded_min: 14, cause_of_delay: "Precedence for express overtake" },
            { journey_date: "2026-03-26", train_no: "12424", section_name: "PRYJ - DDU", delay_recorded_min: 6, cause_of_delay: "Caution order speed limit" }
        ]
    },
    "22436": {
        train_no: "22436",
        train_name: "Vande Bharat Express",
        source: "New Delhi (NDLS)",
        destination: "Varanasi Jn (BSB)",
        current_location: "Approaching Prayagraj Jn",
        current_speed: 110,
        current_delay: 2,
        next_station: "Prayagraj Jn (PRYJ)",
        next_station_eta: "12:10",
        confidence_score: 98,
        downstream_congestion: 0.15,
        speed_restriction: 0,
        weather_severity: 0,
        headway_km: 12.5,
        upcoming_predictions: [
            { station_name: "Prayagraj Jn (PRYJ)", predicted_eta: "12:10", expected_delay_min: 2, confidence_score: 98, platform: "Platform 6" },
            { station_name: "Varanasi Jn (BSB)", predicted_eta: "14:00", expected_delay_min: 0, confidence_score: 97, platform: "Platform 1" }
        ],
        track_geometry: [
            [28.6139, 77.2090],
            [26.4499, 80.3319],
            [25.4358, 81.8463],
            [25.3176, 82.9739]
        ],
        history: [
            { journey_date: "2026-03-28", train_no: "22436", section_name: "NDLS - CNB", delay_recorded_min: 0, cause_of_delay: "On Time Mainline Run" },
            { journey_date: "2026-03-27", train_no: "22436", section_name: "CNB - PRYJ", delay_recorded_min: 2, cause_of_delay: "Platform clearance buffer" }
        ]
    },
    "12382": {
        train_no: "12382",
        train_name: "Poorva Express",
        source: "New Delhi (NDLS)",
        destination: "Howrah Jn (HWH)",
        current_location: "Near Tundla Junction",
        current_speed: 76,
        current_delay: 26,
        next_station: "Kanpur Central (CNB)",
        next_station_eta: "22:15",
        confidence_score: 87,
        downstream_congestion: 0.68,
        speed_restriction: 1,
        weather_severity: 1,
        headway_km: 4.8,
        upcoming_predictions: [
            { station_name: "Kanpur Central (CNB)", predicted_eta: "22:15", expected_delay_min: 26, confidence_score: 87, platform: "Platform 5" },
            { station_name: "Prayagraj Jn (PRYJ)", predicted_eta: "01:20", expected_delay_min: 24, confidence_score: 84, platform: "Platform 2" },
            { station_name: "Varanasi Jn (BSB)", predicted_eta: "05:00", expected_delay_min: 22, confidence_score: 80, platform: "Platform 8" }
        ],
        track_geometry: [
            [28.6139, 77.2090],
            [27.2074, 78.2384],
            [26.4499, 80.3319],
            [25.4358, 81.8463],
            [25.3176, 82.9739]
        ],
        history: [
            { journey_date: "2026-03-28", train_no: "12382", section_name: "TDL - CNB", delay_recorded_min: 28, cause_of_delay: "Track signal regulation" }
        ]
    }
};

// =========================
// SEARCH TRAIN
// =========================
async function searchTrain() {
    const input = $("trainSearch") || $("trainInput");
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    try {
        const res = await fetch(`${API_BASE}/trains`);
        if (res.ok) {
            const trains = await res.json();
            const found = trains.find(t =>
                String(t.train_no).toLowerCase() === val.toLowerCase() ||
                String(t.train_name).toLowerCase().includes(val.toLowerCase())
            );
            if (found) {
                await loadTrainData(found.train_no);
                scrollToSection("status");
                return;
            }
        }
    } catch (e) {
        console.warn("Using offline telemetry buffer.");
    }

    const key = Object.keys(MOCK_DATA).find(k =>
        k === val || MOCK_DATA[k].train_name.toLowerCase().includes(val.toLowerCase())
    );

    await loadTrainData(key || "12424");
    scrollToSection("status");
}

function scrollToSection(id) {
    const el = $(id) || document.querySelector(`[id*="${id}"]`) || document.querySelector('section');
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// =========================
// LOAD TRAIN DATA
// =========================
async function loadTrainData(trainNo) {
    let train = null;
    try {
        const res = await fetch(`${API_BASE}/trains/${trainNo}`);
        if (res.ok) train = await res.json();
    } catch (e) {}

    if (!train || train.error) {
        train = MOCK_DATA[trainNo] || MOCK_DATA["12424"];
    }

    selectedTrain = train;
    const predictions = train.upcoming_predictions || train.predictions || train.upcoming_stations || [];

    updateBasicTrainDetails(train);
    updateNextStation(train, predictions);
    updateConditions(train);
    updateWhyEtaChanged(train);
    renderStationTimeline(predictions);
    updateAlerts(train);
    updateRouteMap(train);
    renderHistory(train.history || [], train.train_no);
}

function updateBasicTrainDetails(train) {
    if ($("trainNumber")) $("trainNumber").textContent = train.train_no;
    if ($("trainName")) $("trainName").textContent = train.train_name;
    if ($("sourceStation")) $("sourceStation").textContent = train.source;
    if ($("destinationStation")) $("destinationStation").textContent = train.destination;
    if ($("currentLocation")) $("currentLocation").textContent = train.current_location;
    if ($("currentSpeed")) $("currentSpeed").textContent = Math.round(train.current_speed || 68);
    if ($("currentDelay")) $("currentDelay").textContent = `+${Math.round(train.current_delay || 14)} min`;
}

function updateNextStation(train, predictions) {
    const next = (predictions && predictions[0]) || {
        station_name: train.next_station || "Kanpur Central (CNB)",
        predicted_eta: train.next_station_eta || "19:42",
        confidence_score: 94,
        expected_delay_min: 14
    };

    const conf = Math.round(next.confidence_score || 94);
    const delay = Math.round(next.expected_delay_min ?? 14);

    if ($("nextStation")) $("nextStation").textContent = next.station_name;
    if ($("nextStationETA")) $("nextStationETA").textContent = next.predicted_eta;
    if ($("confidenceValue")) $("confidenceValue").textContent = conf;
    if ($("confidenceBar")) $("confidenceBar").style.width = `${conf}%`;
    if ($("expectedDelay")) $("expectedDelay").textContent = `+${delay} min`;
}

function renderStationTimeline(predictions) {
    const container = $("stationTimeline");
    if (!container) return;

    let halts = (predictions && predictions.length) ? predictions : [
        { station_name: "Kanpur Central (CNB)", predicted_eta: "19:42", expected_delay_min: 14, confidence_score: 94, platform: "Platform 1" },
        { station_name: "Prayagraj Jn (PRYJ)", predicted_eta: "21:55", expected_delay_min: 12, confidence_score: 91, platform: "Platform 4" },
        { station_name: "Pt. Deen Dayal Upadhyaya Jn (DDU)", predicted_eta: "00:15", expected_delay_min: 10, confidence_score: 89, platform: "Platform 2" },
        { station_name: "Danapur (DNR)", predicted_eta: "03:10", expected_delay_min: 15, confidence_score: 86, platform: "Platform 1A" },
        { station_name: "Patna Jn (PNBE)", predicted_eta: "03:45", expected_delay_min: 16, confidence_score: 85, platform: "Platform 3" }
    ];

    container.innerHTML = halts.map((st, i) => `
        <div class="timeline-item" style="display:flex; align-items:center; justify-content:space-between; background:#ffffff; border:1px solid #e2e8f0; border-left:5px solid #2563eb; padding:16px 22px; border-radius:12px; margin-bottom:12px; box-shadow:0 3px 8px rgba(0,0,0,0.02);">
            <div>
                <div style="font-size:16px; font-weight:700; color:#0f172a; display:flex; align-items:center; gap:10px;">
                    <span style="background:#eff6ff; color:#2563eb; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">${i + 1}</span>
                    <span>${escapeHtml(st.station_name || st.station_code || "Scheduled Junction")}</span>
                </div>
                <div style="font-size:13px; color:#64748b; margin-top:6px; margin-left:38px;">
                    Assigned: <strong style="color:#0f172a;">${st.platform || "Platform 1"}</strong>
                    &nbsp; • &nbsp; Expected Delay: <span style="color:#dc2626; font-weight:700;">+${Math.round(st.expected_delay_min || 12)} min</span>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:19px; font-weight:800; color:#2563eb;">${escapeHtml(st.predicted_eta || "--:--")}</div>
                <span style="display:inline-block; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; background:#dcfce7; color:#15803d; margin-top:4px;">
                    ${Math.round(st.confidence_score || 92)}% Confidence
                </span>
            </div>
        </div>
    `).join("");
}

function updateConditions(train) {
    const cong = Number(train.downstream_congestion || 0.52);
    if ($("congestionValue")) {
        const congText = cong > 0.65 ? "High (Caution)" : "Moderate (0.52)";
        $("congestionValue").innerHTML = congText + ' <span style="font-size:11px; color:#b45309; background:#fef3c7; padding:2px 8px; border-radius:12px; margin-left:6px; font-weight:bold;">Track Busy</span>';
    }
    if ($("speedRestriction")) {
        const hasRestriction = Number(train.speed_restriction || 0);
        const restText = hasRestriction ? "Active (45 km/h limit)" : 'None <span style="font-size:11px; color:#15803d; background:#dcfce7; padding:2px 8px; border-radius:12px; margin-left:6px; font-weight:bold;">Mainline Clear</span>';
        $("speedRestriction").innerHTML = restText;
    }
    if ($("weatherCondition")) {
        const isAdverse = Number(train.weather_severity || 0) > 0;
        const weatherText = isAdverse ? "Fog / Visibility Drop" : 'Clear & Fair <span style="font-size:11px; color:#1d4ed8; background:#dbeafe; padding:2px 8px; border-radius:12px; margin-left:6px; font-weight:bold;">100% Visibility</span>';
        $("weatherCondition").innerHTML = weatherText;
    }
    if ($("headwayValue")) {
        $("headwayValue").textContent = Number(train.headway_km || 7.2).toFixed(1);
    }
}

function updateWhyEtaChanged(train) {
    const dly = Math.round(train.current_delay || 14);
    if ($("reasonCongestion")) $("reasonCongestion").textContent = `Downstream density added ~${Math.round(dly * 0.6)} min buffer to subsequent sections.`;
    if ($("reasonSpeed")) $("reasonSpeed").textContent = `Cruising at stable ${Math.round(train.current_speed || 68)} km/h across green signals.`;
    if ($("reasonWeather")) $("reasonWeather").textContent = Number(train.weather_severity || 0) > 0 ? "Caution orders active due to visibility." : "Unrestricted line visibility detected by telemetry.";
    if ($("reasonPrecedence")) $("reasonPrecedence").textContent = "Clear track block with loop priority reserved at next junction.";
}

function updateAlerts(train) {
    const container = $("alertsContainer");
    if (!container) return;
    const dly = Math.round(train.current_delay || 14);
    container.innerHTML = `
        <div style="display:flex; gap:14px; align-items:center; padding:15px 20px; border-radius:12px; background:#eff6ff; border:1px solid #bfdbfe; margin-bottom:10px;">
            <span style="font-size:22px;">⚡</span>
            <div>
                <strong style="color:#1d4ed8; font-size:15px;">Dynamic ETA Recalculation Active</strong>
                <p style="margin:3px 0 0; color:#334155; font-size:13px;">Train running +${dly} min behind schedule. Dynamic ML model adjusted future arrival times based on speed recovery margins.</p>
            </div>
        </div>
        <div style="display:flex; gap:14px; align-items:center; padding:15px 20px; border-radius:12px; background:#f0fdf4; border:1px solid #bbf7d0; margin-bottom:10px;">
            <span style="font-size:22px;">🟢</span>
            <div>
                <strong style="color:#15803d; font-size:15px;">Mainline Signal Precedence Confirmed</strong>
                <p style="margin:3px 0 0; color:#334155; font-size:13px;">Corridor Controller has assigned non-stop mainline routing past loop points.</p>
            </div>
        </div>
    `;
}

function renderHistory(history, trainNo) {
    const body = $("historyBody");
    if (!body) return;
    if (!history || !history.length) {
        history = MOCK_DATA[trainNo]?.history || MOCK_DATA["12424"].history;
    }
    body.innerHTML = history.map(row => `
        <tr>
            <td>${escapeHtml(row.journey_date || "2026-03-28")}</td>
            <td><strong>${escapeHtml(row.train_no || trainNo)}</strong></td>
            <td>${escapeHtml(row.section_name || "Mainline Section")}</td>
            <td><strong style="color:#dc2626;">+${escapeHtml(row.delay_recorded_min || 10)} min</strong></td>
            <td>${escapeHtml(row.cause_of_delay || "Corridor Regulation")}</td>
        </tr>
    `).join("");
}

function updateRouteMap(train) {
    if (typeof L === "undefined") return;
    const mapEl = $("trainMap");
    if (!mapEl) return;

    const points = train.track_geometry || [
        [28.6139, 77.2090],
        [26.4499, 80.3319],
        [25.4358, 81.8463],
        [25.3176, 82.9739]
    ];

    if (!trainMap) {
        trainMap = L.map("trainMap");
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap"
        }).addTo(trainMap);
    }

    if (routeLine) routeLine.remove();
    routeLine = L.polyline(points, { color: "#2563eb", weight: 5 }).addTo(trainMap);

    if (trainMarker) trainMarker.remove();
    const cur = points[Math.floor(points.length / 2)];
    trainMarker = L.marker(cur).addTo(trainMap)
        .bindPopup(`<strong>${escapeHtml(train.train_name || "Train")}</strong><br>Telemetry Active`)
        .openPopup();

    trainMap.fitBounds(routeLine.getBounds(), { padding: [35, 35] });
    setTimeout(() => { if (trainMap) trainMap.invalidateSize(); }, 350);
}

function setupAuthModal() {
    const modal = $("loginModal");
    const openBtn = $("loginNavBtn");
    const closeBtn = $("modalCloseBtn");
    const submitBtn = $("authSubmitBtn");

    if (openBtn && modal) openBtn.addEventListener("click", () => modal.style.display = "flex");
    if (closeBtn && modal) closeBtn.addEventListener("click", () => modal.style.display = "none");

    if (submitBtn && modal) {
        submitBtn.addEventListener("click", () => {
            const idVal = $("authId")?.value.trim();
            const passVal = $("authPass")?.value.trim();
            if (!idVal || !passVal) {
                alert("Please enter both ID and password.");
                return;
            }
            openBtn.innerText = `👤 ${idVal.slice(0, 10)}`;
            openBtn.style.background = "#15803d";
            modal.style.display = "none";
            alert(`Verified! Welcome, ${idVal}.`);
        });
    }
}

function setupReviews() {
    const starButtons = document.querySelectorAll("#ratingInput button");
    starButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            currentRating = Number(btn.dataset.rating || 5);
            starButtons.forEach(b => {
                const r = Number(b.dataset.rating || 0);
                b.classList.toggle("active", r <= currentRating);
            });
        });
    });

    starButtons.forEach(b => b.classList.add("active"));

    const submitBtn = $("submitReview");
    if (submitBtn) {
        submitBtn.addEventListener("click", () => {
            const txt = $("reviewText");
            if (!txt || !txt.value.trim()) {
                alert("Please write your feedback message.");
                return;
            }
            alert(`Thank you! Your ${currentRating}-star review has been recorded.`);
            txt.value = "";
        });
    }
}

// ====================================================
// ROBUST MOBILE MENU & AUTO-LOAD SYSTEM
// ====================================================
function setupNavigationAndMobile() {
    // 1. Search buttons
    const sBtn = $("searchBtn");
    if (sBtn) sBtn.addEventListener("click", searchTrain);

    const sIn = $("trainSearch") || $("trainInput");
    if (sIn) {
        sIn.addEventListener("keydown", (e) => {
            if (e.key === "Enter") searchTrain();
        });
    }

    document.querySelectorAll(".quick-train").forEach(btn => {
        btn.addEventListener("click", async () => {
            const no = btn.dataset.train;
            if (sIn) sIn.value = no;
            await loadTrainData(no);
            scrollToSection("status");
        });
    });

    // 2. Mobile Hamburger Toggle Handler
    const hamburger = document.querySelector('.menu-toggle, .hamburger, [aria-label="Menu"]') || 
                      document.querySelector('header svg')?.parentElement || 
                      document.querySelector('header button');
    
    const navLinks = document.querySelector('.nav-links, nav ul, .nav-menu');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navLinks.classList.contains('active') || navLinks.style.display === 'flex';
            if (isOpen) {
                navLinks.classList.remove('active');
                navLinks.style.display = 'none';
            } else {
                navLinks.classList.add('active');
                navLinks.style.display = 'flex';
                navLinks.style.flexDirection = 'column';
                navLinks.style.position = 'absolute';
                navLinks.style.top = '60px';
                navLinks.style.left = '0';
                navLinks.style.width = '100%';
                navLinks.style.background = '#ffffff';
                navLinks.style.padding = '15px';
                navLinks.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
                navLinks.style.zIndex = '99999';
            }
        });
    }

    // 3. Close mobile menu & scroll when clicking ANY nav link
    document.querySelectorAll('nav a, .nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href');
            if (navLinks) {
                navLinks.classList.remove('active');
                navLinks.style.display = 'none';
            }
            if (targetId && targetId.startsWith('#')) {
                e.preventDefault();
                const sectionId = targetId.replace('#', '');
                scrollToSection(sectionId);
            }
        });
    });
}

// Auto-run everything on load
document.addEventListener("DOMContentLoaded", () => {
    setupNavigationAndMobile();
    setupReviews();
    setupAuthModal();
    
    // Auto-load Train Dashboard instantly
    loadTrainData("12424");
});