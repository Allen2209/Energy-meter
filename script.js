// Smart Prepaid Energy Meter Dashboard Application Logic (ESP32 Direct Integration)

// --- APPLICATION STATE ---
let state = {
    voltage: 0.0,
    current: 0.0,
    power: 0.0,
    energy: 0.000,
    balance: 0.00,
    relayState: false,
    faultDetected: false,
    theftDetected: false,
    lastUpdated: new Date()
};

// System Threshold configurations (loaded from localStorage or defaults)
let settings = {
    overVoltageLimit: 250,
    overCurrentLimit: 8.0,
    theftCurrentThreshold: 0.30,
    minBalanceThreshold: 20.00,
    costPerKwh: 7.50
};

// MQTT configuration
let mqttClient = null;
const MQTT_BROKER = "wss://broker.emqx.io:8084/mqtt";
const MQTT_TOPIC_LIVE = "allen/energy/live";
const MQTT_TOPIC_STATUS = "allen/energy/status";
const MQTT_TOPIC_CONTROL = "allen/energy/control";
const MQTT_TOPIC_RECHARGE = "allen/energy/recharge";
const CLIENT_ID = "allen_esp32_meter_" + Math.random().toString(16).substring(2, 8);

// History logs storage
let logs = {
    thefts: [],
    breakerLogs: [],
    telemetryHistory: [] // array of {time, voltage, current, power} for rolling charts
};

// Chart instances
let charts = {
    voltage: null,
    current: null,
    power: null,
    energy: null
};

// Track previous alarm states to prevent toast/popups spamming
let prevAlarms = {
    fault: false,
    theft: false,
    lowBalance: false
};

// --- DOM ELEMENTS ---
const elements = {
    // Preloader
    loadingScreen: document.getElementById('loading-screen'),
    loaderStatus: document.getElementById('loader-status'),
    
    // Navigation
    sidebarItems: document.querySelectorAll('.sidebar-item'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    
    // Header & Badges
    mqttStatusBadge: document.getElementById('mqtt-status-badge'),
    mqttStatusText: document.getElementById('mqtt-status-text'),
    liveClock: document.getElementById('live-clock'),
    
    // Telemetry Cards
    cardVoltage: document.getElementById('card-voltage'),
    cardCurrent: document.getElementById('card-current'),
    cardPower: document.getElementById('card-power'),
    cardEnergy: document.getElementById('card-energy'),
    cardBalance: document.getElementById('card-balance'),
    headerVoltIcon: document.getElementById('header-volt-icon'),
    headerCurrIcon: document.getElementById('header-curr-icon'),
    cardVoltageTrend: document.getElementById('card-voltage-trend'),
    cardCurrentTrend: document.getElementById('card-current-trend'),
    
    // Status Cards & Breaker Panel
    cardRelayState: document.getElementById('card-relay-state'),
    cardRelayBox: document.getElementById('card-relay-box'),
    relayStatusIcon: document.getElementById('relay-status-card-icon'),
    
    cardFaultStatus: document.getElementById('card-fault-status'),
    faultIconBox: document.getElementById('fault-icon-box'),
    faultCard: document.getElementById('fault-card'),
    
    cardTheftStatus: document.getElementById('card-theft-status'),
    theftIconBox: document.getElementById('theft-icon-box'),
    theftCard: document.getElementById('theft-card'),
    
    balanceIconBox: document.getElementById('balance-icon-box'),
    lastTelemetryTime: document.getElementById('last-telemetry-time'),
    
    // Control Panel
    panelRelayIndicator: document.getElementById('panel-relay-indicator'),
    panelRelayText: document.getElementById('panel-relay-text'),
    btnRelayOn: document.getElementById('btn-relay-on'),
    btnRelayOff: document.getElementById('btn-relay-off'),
    lastControlTime: document.getElementById('last-control-time'),
    controlWarningBox: document.getElementById('control-warning-box'),
    controlWarningMessage: document.getElementById('control-warning-message'),
    breakerLogsContainer: document.getElementById('breaker-logs-container'),
    
    // Gauges SVG
    gaugeVoltageFill: document.getElementById('gauge-voltage-fill'),
    gaugeCurrentFill: document.getElementById('gauge-current-fill'),
    gaugePowerFill: document.getElementById('gauge-power-fill'),
    gaugeVoltageValue: document.getElementById('gauge-voltage-value'),
    gaugeCurrentValue: document.getElementById('gauge-current-value'),
    gaugePowerValue: document.getElementById('gauge-power-value'),
    
    // Analytics Page
    analyticsTotalEnergy: document.getElementById('analytics-total-energy'),
    analyticsTariff: document.getElementById('analytics-tariff'),
    analyticsTotalDeducted: document.getElementById('analytics-total-deducted'),
    analyticsCarbon: document.getElementById('analytics-carbon'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    
    // System Status Page
    diagMqttText: document.getElementById('diag-mqtt-text'),
    diagDataText: document.getElementById('diag-data-text'),
    diagPzemText: document.getElementById('diag-pzem-text'),
    diagReconnectText: document.getElementById('diag-reconnect-text'),
    mqttTerminal: document.getElementById('mqtt-terminal'),
    clearConsoleBtn: document.getElementById('clear-console-btn'),
    
    // Settings Page
    settingOverVoltage: document.getElementById('setting-over-voltage'),
    settingOverCurrent: document.getElementById('setting-over-current'),
    settingTheftCurrent: document.getElementById('setting-theft-current'),
    settingMinBalance: document.getElementById('setting-min-balance'),
    settingCostKwh: document.getElementById('setting-cost-kwh'),
    settingsForm: document.getElementById('settings-form'),
    
    // Modals & Popups
    relayConfirmModal: document.getElementById('relayConfirmModal'),
    confirmRelayBtn: document.getElementById('confirm-relay-btn'),
    modalRechargeForm: document.getElementById('modal-recharge-form'),
    modalRechargeAmt: document.getElementById('modal-recharge-amt'),
    modalPaymentMode: document.getElementById('modal-payment-mode')
};

// Modal references initialized by Bootstrap
let bsRelayConfirmModal = null;
let bsRechargeModal = null;
let relayCommandPending = null;
let firstDataReceived = false;

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    // Load config from localStorage
    loadSettings();
    
    // Initialize Modals
    bsRelayConfirmModal = new bootstrap.Modal(elements.relayConfirmModal);
    bsRechargeModal = new bootstrap.Modal(document.getElementById('rechargeModal'));
    
    // Start clock
    setInterval(updateClock, 1000);
    
    // Navigation router
    initNavigation();
    
    // Apply configurations to Form Fields
    applySettingsToUI();
    
    // Setup charts (instantiates all 4 charts)
    initCharts();
    
    // Render static log history tables
    renderBreakerLogs();
    
    // Connect to EMQX MQTT Broker
    connectToMqttBroker();
    
    // Form and input listeners
    setupEventListeners();
    
    // Initial Render
    updateUI();
    
    // Loading Screen Auto-Dismiss Fallback (Dismiss after 3s if broker slow)
    setTimeout(() => {
        if (!firstDataReceived) {
            elements.loaderStatus.textContent = "Telemetry Offline - Launching Panel...";
            setTimeout(() => {
                elements.loadingScreen.classList.add('fade-out');
            }, 500);
        }
    }, 3000);
});

// Update Header Time
function updateClock() {
    const now = new Date();
    const timeString = now.toTimeString().split(' ')[0];
    elements.liveClock.textContent = timeString;
}

// --- CONFIGURATION / STORAGE ---
function loadSettings() {
    const saved = localStorage.getItem("energy_meter_settings");
    if (saved) {
        try {
            settings = JSON.parse(saved);
        } catch (e) {
            console.error("Error reading saved settings, using defaults.", e);
        }
    }
}

function saveSettings() {
    localStorage.setItem("energy_meter_settings", JSON.stringify(settings));
    addSystemTerminalLog("SYSTEM", "Configuration thresholds saved locally.");
    updateUI();
}

function applySettingsToUI() {
    elements.settingOverVoltage.value = settings.overVoltageLimit;
    elements.settingOverCurrent.value = settings.overCurrentLimit;
    elements.settingTheftCurrent.value = settings.theftCurrentThreshold;
    elements.settingMinBalance.value = settings.minBalanceThreshold;
    elements.settingCostKwh.value = settings.costPerKwh;
    
    elements.analyticsTariff.textContent = `₹${settings.costPerKwh.toFixed(2)} / kWh`;
}

// --- PAGE ROUTING SYSTEM ---
function initNavigation() {
    elements.sidebarItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.getAttribute('data-target');
            navigateToPage(pageId);
        });
    });
    
    elements.sidebarToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('open');
    });
    
    // Mobile tap collapse
    document.querySelector('.main-content').addEventListener('click', (e) => {
        if (elements.sidebar.classList.contains('open') && !e.target.closest('#sidebar-toggle') && !e.target.closest('#sidebar')) {
            elements.sidebar.classList.remove('open');
        }
    });
}

function navigateToPage(pageId) {
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
    });
    const targetSec = document.getElementById(pageId);
    if (targetSec) {
        targetSec.classList.add('active');
    }
    
    elements.sidebarItems.forEach(i => {
        i.classList.remove('active');
        if (i.getAttribute('data-target') === pageId) {
            i.classList.add('active');
        }
    });
    
    elements.sidebar.classList.remove('open');
    
    // Resize charts upon visibility
    if (pageId === 'live') {
        setTimeout(() => {
            if (charts.voltage) charts.voltage.resize();
            if (charts.current) charts.current.resize();
            if (charts.power) charts.power.resize();
        }, 100);
    }
    if (pageId === 'analytics') {
        setTimeout(() => {
            if (charts.energy) charts.energy.resize();
        }, 100);
    }
}

// --- DYNAMIC SLIDING TOASTER SYSTEM ---
function showToast(title, message, type = "info") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `cyber-toast toast-${type}`;
    
    let iconClass = "fa-circle-info";
    if (type === "success") iconClass = "fa-circle-check";
    if (type === "danger") iconClass = "fa-circle-exclamation";
    if (type === "warning") iconClass = "fa-triangle-exclamation";
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;
    
    container.appendChild(toast);
    
    // Close button click
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    });
    
    // Auto-remove after 5s
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.transform = 'translateX(120%)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// --- SYSTEM TELEMETRY RENDERERS ---
function updateUI() {
    // 1. Text telemetry card updates
    elements.cardVoltage.innerHTML = `${state.voltage.toFixed(1)} <span>V</span>`;
    elements.cardCurrent.innerHTML = `${state.current.toFixed(2)} <span>A</span>`;
    elements.cardPower.innerHTML = `${state.power.toFixed(1)} <span>W</span>`;
    elements.cardEnergy.innerHTML = `${state.energy.toFixed(3)} <span>kWh</span>`;
    elements.cardBalance.textContent = `₹${state.balance.toFixed(2)}`;
    
    // 2. Alarm checking & notification triggers
    checkAlarmsAndNotify();
    
    // 3. Status card styling & indicators (Green normal / Red fault / Orange theft)
    // Relay box style
    if (state.relayState) {
        elements.cardRelayState.textContent = "CONNECTED (ON)";
        elements.cardRelayState.className = "glow-text-green";
        elements.relayStatusIcon.className = "card-icon-container icon-green fs-2";
        elements.relayStatusIcon.innerHTML = '<i class="fa-solid fa-toggle-on"></i>';
        elements.cardRelayBox.style.borderLeft = "5px solid var(--color-success)";
        
        elements.panelRelayIndicator.className = "relay-status-indicator on";
        elements.panelRelayText.textContent = "BREAKER ON";
        elements.panelRelayText.className = "text-tech fw-bold text-success fs-5";
        
        elements.btnRelayOn.setAttribute('disabled', 'true');
        elements.btnRelayOff.removeAttribute('disabled');
    } else {
        elements.cardRelayState.textContent = "DISCONNECTED (OFF)";
        elements.cardRelayState.className = "glow-text-red";
        elements.relayStatusIcon.className = "card-icon-container icon-red fs-2";
        elements.relayStatusIcon.innerHTML = '<i class="fa-solid fa-toggle-off"></i>';
        elements.cardRelayBox.style.borderLeft = "5px solid var(--color-danger)";
        
        elements.panelRelayIndicator.className = "relay-status-indicator off";
        elements.panelRelayText.textContent = "BREAKER OFF";
        elements.panelRelayText.className = "text-tech fw-bold text-danger fs-5";
        
        elements.btnRelayOff.setAttribute('disabled', 'true');
        
        // Manual ON switch interlocks
        let blockBreakerOn = false;
        let warningText = "";
        
        if (state.faultDetected) {
            blockBreakerOn = true;
            warningText = "Breaker locked! Over-current safety trip active. Clear faults to reset.";
        } else if (state.theftDetected) {
            blockBreakerOn = true;
            warningText = "Breaker locked! Differential bypass theft active. Clear tap connection.";
        } else if (state.balance <= settings.minBalanceThreshold) {
            blockBreakerOn = true;
            warningText = "Breaker locked! Low balance lockout. Please recharge wallet.";
        }
        
        if (blockBreakerOn) {
            elements.btnRelayOn.setAttribute('disabled', 'true');
            elements.controlWarningMessage.textContent = warningText;
            elements.controlWarningBox.classList.remove('d-none');
        } else {
            elements.btnRelayOn.removeAttribute('disabled');
            elements.controlWarningBox.classList.add('d-none');
        }
    }
    
    // Fault status card style (Red when fault)
    if (state.faultDetected) {
        elements.cardFaultStatus.textContent = "OVER-CURRENT TRIP";
        elements.cardFaultStatus.className = "glow-text-red";
        elements.faultIconBox.className = "card-icon-container icon-red fs-2";
        elements.faultIconBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        elements.faultCard.style.borderLeft = "5px solid var(--color-danger)";
    } else {
        elements.cardFaultStatus.textContent = "NO FAULTS";
        elements.cardFaultStatus.className = "glow-text-green";
        elements.faultIconBox.className = "card-icon-container icon-green fs-2";
        elements.faultIconBox.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        elements.faultCard.style.borderLeft = "5px solid var(--color-success)";
    }
    
    // Theft status card style (Orange when theft)
    if (state.theftDetected) {
        elements.cardTheftStatus.textContent = "BYPASS DETECTED";
        elements.cardTheftStatus.className = "glow-text-orange";
        elements.theftIconBox.className = "card-icon-container icon-orange fs-2";
        elements.theftIconBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        elements.theftCard.style.borderLeft = "5px solid var(--color-warning)";
    } else {
        elements.cardTheftStatus.textContent = "SECURE";
        elements.cardTheftStatus.className = "glow-text-green";
        elements.theftIconBox.className = "card-icon-container icon-green fs-2";
        elements.theftIconBox.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';
        elements.theftCard.style.borderLeft = "5px solid var(--color-success)";
    }
    
    // Balance visual warning card
    if (state.balance <= settings.minBalanceThreshold) {
        elements.balanceIconBox.className = "card-icon-container icon-red";
        elements.cardBalance.className = "card-value glow-text-red";
        elements.dashboardLowBalanceAlert.classList.remove('d-none');
    } else {
        elements.balanceIconBox.className = "card-icon-container icon-green";
        elements.cardBalance.className = "card-value glow-text-green";
        elements.dashboardLowBalanceAlert.classList.add('d-none');
    }
    
    // Voltage nominal warnings
    if (firstDataReceived) {
        if (state.voltage > settings.overVoltageLimit) {
            elements.headerVoltIcon.className = "card-icon-container icon-red";
            elements.cardVoltageTrend.className = "card-trend text-danger";
            elements.cardVoltageTrend.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Over-Voltage Spikes Detected!';
        } else if (state.voltage < 180) {
            elements.headerVoltIcon.className = "card-icon-container icon-red";
            elements.cardVoltageTrend.className = "card-trend text-danger";
            elements.cardVoltageTrend.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Under-Voltage / Brownout!';
        } else {
            elements.headerVoltIcon.className = "card-icon-container icon-cyan";
            elements.cardVoltageTrend.className = "card-trend text-success";
            elements.cardVoltageTrend.innerHTML = '<i class="fa-solid fa-circle-check"></i> Nominal Range (220V - 240V)';
        }
        
        // Current bypass indicators
        if (state.theftDetected) {
            elements.headerCurrIcon.className = "card-icon-container icon-orange";
            elements.cardCurrentTrend.className = "card-trend text-warning";
            elements.cardCurrentTrend.innerHTML = '<i class="fa-solid fa-triangle-exclamation animate-pulse"></i> Shunt Mismatch Bypass!';
        } else {
            elements.headerCurrIcon.className = "card-icon-container icon-orange";
            elements.cardCurrentTrend.className = "card-trend text-muted";
            elements.cardCurrentTrend.innerHTML = 'Source line vs Load line match';
        }
    }
    
    // Analytics calculations
    elements.analyticsTotalEnergy.textContent = `${state.energy.toFixed(3)} kWh`;
    const billDeducted = state.energy * settings.costPerKwh;
    elements.analyticsTotalDeducted.textContent = `₹${billDeducted.toFixed(2)}`;
    
    const carbonFootprint = state.energy * 0.51;
    elements.analyticsCarbon.textContent = `${carbonFootprint.toFixed(2)} kg CO₂`;
    
    // Update footer stamps
    if (firstDataReceived) {
        const updateTimeStr = state.lastUpdated.toLocaleTimeString();
        elements.lastTelemetryTime.textContent = updateTimeStr;
    }
    
    // 4. Custom SVG Gauges Update
    updateGauges();
    
    // 5. Diagnostics board
    updateDiagnosticsUI();
}

function checkAlarmsAndNotify() {
    if (!firstDataReceived) return; // wait for telemetry before alarm monitoring

    // 1. Over-current fault
    if (state.faultDetected && !prevAlarms.fault) {
        showToast("Over-Current Safety Trip", "Load current exceeded safety cutoff limit! Breaker tripped.", "danger");
        addBreakerLog("SAFETY TRIP", "SYSTEM (OVER-CURRENT)", "TRIPPED");
    }
    prevAlarms.fault = state.faultDetected;
    
    // 2. Bypass theft
    if (state.theftDetected && !prevAlarms.theft) {
        showToast("Line Intrusion Alert", "Energy bypass tap detected! Current mismatch on shunt lines. Breaker isolated.", "warning");
        addBreakerLog("SAFETY TRIP", "SYSTEM (BYPASS THEFT)", "TRIPPED");
    }
    prevAlarms.theft = state.theftDetected;
    
    // 3. Low balance
    if (state.balance < 20 && !prevAlarms.lowBalance) {
        showToast("Low Balance Warning", `Meter balance dropped below ₹20.00 threshold limit. Please recharge.`, "warning");
    }
    prevAlarms.lowBalance = (state.balance < 20);
}

function updateDiagnosticsUI() {
    const isMqttConnected = mqttClient && mqttClient.connected;
    
    elements.diagMqttText.textContent = isMqttConnected ? "CONNECTED" : "DISCONNECTED";
    elements.diagMqttText.className = isMqttConnected ? "text-success" : "text-danger";
    elements.diagMqttText.parentElement.previousElementSibling.className = isMqttConnected ? "diag-icon bg-success bg-opacity-20 text-success fs-4" : "diag-icon bg-danger bg-opacity-20 text-danger fs-4";
    
    elements.diagDataText.textContent = firstDataReceived ? "ACTIVE (5s)" : "INACTIVE";
    elements.diagDataText.className = firstDataReceived ? "text-success" : "text-danger";
    elements.diagDataText.parentElement.previousElementSibling.className = firstDataReceived ? "diag-icon bg-success bg-opacity-20 text-success fs-4" : "diag-icon bg-danger bg-opacity-20 text-danger fs-4";
    
    elements.diagPzemText.textContent = firstDataReceived ? "OPERATIONAL" : "OFFLINE";
    elements.diagPzemText.className = firstDataReceived ? "text-success" : "text-danger";
    elements.diagPzemText.parentElement.previousElementSibling.className = firstDataReceived ? "diag-icon bg-success bg-opacity-20 text-success fs-4" : "diag-icon bg-danger bg-opacity-20 text-danger fs-4";
    
    elements.diagReconnectText.textContent = "AUTO RECONNECT";
}

function updateGauges() {
    const dashLength = 251.2; // Circumference of semicircle (r=80, stroke-dasharray=251.2)
    
    // 1. Voltage Gauge (0 - 300V range)
    const voltPct = Math.min(1.0, Math.max(0, state.voltage / 300));
    elements.gaugeVoltageFill.style.strokeDashoffset = dashLength - (voltPct * dashLength);
    elements.gaugeVoltageValue.innerHTML = `${state.voltage.toFixed(1)} <span>V</span>`;
    
    // 2. Current Gauge (0 - 10A range)
    const currPct = Math.min(1.0, Math.max(0, state.current / 10));
    elements.gaugeCurrentFill.style.strokeDashoffset = dashLength - (currPct * dashLength);
    elements.gaugeCurrentValue.innerHTML = `${state.current.toFixed(2)} <span>A</span>`;
    
    // 3. Power Gauge (0 - 3000W range)
    const pwrPct = Math.min(1.0, Math.max(0, state.power / 3000));
    elements.gaugePowerFill.style.strokeDashoffset = dashLength - (pwrPct * dashLength);
    elements.gaugePowerValue.innerHTML = `${state.power.toFixed(1)} <span>W</span>`;
}

// --- HISTORICAL DATA LOGGER TABLES ---
function renderBreakerLogs() {
    elements.breakerLogsContainer.innerHTML = "";
    if (logs.breakerLogs.length === 0) {
        elements.breakerLogsContainer.innerHTML = `<div class="p-3 text-center text-muted">No breaker transactions logged.</div>`;
        return;
    }
    logs.breakerLogs.forEach(log => {
        const div = document.createElement("div");
        div.className = "log-item";
        
        let colorClass = "tag-system";
        if (log.action.includes("ON")) colorClass = "tag-system";
        if (log.action.includes("OFF")) colorClass = "tag-theft";
        if (log.action.includes("TRIP")) colorClass = "tag-fault";
        
        div.innerHTML = `
            <span class="log-timestamp">${log.timestamp}</span>
            <span class="log-tag ${colorClass}">${log.action}</span>
            <span class="log-msg text-muted">${log.source} (${log.status})</span>
        `;
        elements.breakerLogsContainer.appendChild(div);
    });
}

function addBreakerLog(action, source, status) {
    const now = new Date();
    const timestampStr = now.getFullYear() + "-" + 
        String(now.getMonth()+1).padStart(2, '0') + "-" + 
        String(now.getDate()).padStart(2, '0') + " " + 
        now.toTimeString().split(' ')[0];
        
    logs.breakerLogs.unshift({
        timestamp: timestampStr,
        action: action,
        source: source,
        status: status
    });
    
    // Update elements
    elements.lastControlTime.textContent = timestampStr;
    renderBreakerLogs();
}

// --- EVENT HANDLERS ---
function setupEventListeners() {
    // 1. Breaker Panel buttons
    elements.btnRelayOn.addEventListener('click', () => {
        relayCommandPending = "ON";
        document.getElementById('relayModalTitle').textContent = "Confirm Switch ON Action";
        document.getElementById('relayModalBody').textContent = "This action will switch the relay ON, restoring AC mains electricity supply to the customer load. Proceed?";
        bsRelayConfirmModal.show();
    });
    
    elements.btnRelayOff.addEventListener('click', () => {
        relayCommandPending = "OFF";
        document.getElementById('relayModalTitle').textContent = "Confirm Switch OFF Action";
        document.getElementById('relayModalBody').textContent = "This action will switch the relay OFF, isolating the load and cutting off the electricity supply. Proceed?";
        bsRelayConfirmModal.show();
    });
    
    // Confirm relay action modal
    elements.confirmRelayBtn.addEventListener('click', () => {
        if (relayCommandPending) {
            triggerRelayControl(relayCommandPending);
            relayCommandPending = null;
        }
        bsRelayConfirmModal.hide();
    });
    
    // 2. Recharge Modal form (Send recharge package over MQTT to ESP32 for processing)
    elements.modalRechargeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amt = parseFloat(elements.modalRechargeAmt.value);
        const mode = elements.modalPaymentMode.value;
        if (amt > 0) {
            executeRecharge(amt, mode);
            bsRechargeModal.hide();
            elements.modalRechargeAmt.value = "";
        }
    });
    
    // 3. Settings Save button
    elements.settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        settings.overVoltageLimit = parseFloat(elements.settingOverVoltage.value);
        settings.overCurrentLimit = parseFloat(elements.settingOverCurrent.value);
        settings.theftCurrentThreshold = parseFloat(elements.settingTheftCurrent.value);
        settings.minBalanceThreshold = parseFloat(elements.settingMinBalance.value);
        settings.costPerKwh = parseFloat(elements.settingCostKwh.value);
        
        saveSettings();
        applySettingsToUI();
        showToast("Settings Saved", "Hardware cutoff parameters updated successfully.", "success");
    });
    
    // 4. CSV Export Button
    elements.btnExportCsv.addEventListener('click', () => {
        exportTelemetryToCSV();
    });
    
    // Clear terminal console
    elements.clearConsoleBtn.addEventListener('click', () => {
        elements.mqttTerminal.innerHTML = `<div class="line"><span class="time">[${new Date().toLocaleTimeString()}]</span> <span class="msg">Terminal console cleared.</span></div>`;
    });
}

function showRechargeModal() {
    bsRechargeModal.show();
}

// Trigger relay operation command (Publish raw 'ON' or 'OFF' text to MQTT control topic)
function triggerRelayControl(action) {
    if (!mqttClient || !mqttClient.connected) {
        showToast("Control Failed", "No link to MQTT Broker. Cannot transmit packet.", "danger");
        return;
    }
    
    // Publish raw string 'ON' or 'OFF'
    mqttClient.publish(MQTT_TOPIC_CONTROL, action, { qos: 1 }, (err) => {
        if (err) {
            console.error("Control publish failed", err);
            addSystemTerminalLog("ERROR", `Failed to publish relay ${action} command`);
        } else {
            addSystemTerminalLog("CONTROL", `Published raw command: ${action}`);
            addBreakerLog(`CMD ${action}`, "MANUAL CONTROL PANEL", "PENDING DEVICE FEEDBACK");
            showToast("Command Sent", `Switch ${action} command published to broker.`, "info");
        }
    });
}

// Recharge transaction: Publish recharge amount to MQTT for ESP32 and update locally
function executeRecharge(amount, mode) {
    if (mqttClient && mqttClient.connected) {
        // Publish recharge amount raw string
        mqttClient.publish(MQTT_TOPIC_RECHARGE, String(amount), { qos: 1 }, (err) => {
            if (!err) {
                addSystemTerminalLog("RECHARGE", `Published recharge value: ₹${amount.toFixed(2)}`);
            }
        });
    }
    
    // Local fallback simulation addition so they see changes instantly
    state.balance += amount;
    addSystemTerminalLog("SYSTEM", `Prepaid balance updated locally with ₹${amount.toFixed(2)}`);
    showToast("Recharge Sent", `Recharge of ₹${amount.toFixed(2)} sent to meter MTR-884021.`, "success");
    updateUI();
}

// --- MQTT CLIENT ENGINE ---
function connectToMqttBroker() {
    addSystemTerminalLog("SYSTEM", `Connecting to EMQX Broker: ${MQTT_BROKER}...`);
    
    elements.mqttStatusBadge.className = "status-badge offline";
    elements.mqttStatusText.textContent = "Connecting";
    
    mqttClient = mqtt.connect(MQTT_BROKER, {
        clientId: CLIENT_ID,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2000 // Automatically reconnects if connection drops
    });
    
    mqttClient.on('connect', () => {
        addSystemTerminalLog("SYSTEM", `Connected successfully to EMQX Broker.`);
        elements.mqttStatusBadge.className = "status-badge online";
        elements.mqttStatusText.textContent = "Connected";
        showToast("MQTT Connected", "Subscribing to live ESP32 telemetry feed...", "success");
        
        // Subscribe to live telemetry and relay status topics
        mqttClient.subscribe([MQTT_TOPIC_LIVE, MQTT_TOPIC_STATUS], { qos: 1 }, (err) => {
            if (!err) {
                addSystemTerminalLog("SYSTEM", `Subscribed to:`);
                addSystemTerminalLog("SYSTEM", ` - ${MQTT_TOPIC_LIVE}`);
                addSystemTerminalLog("SYSTEM", ` - ${MQTT_TOPIC_STATUS}`);
            }
        });
        
        updateDiagnosticsUI();
    });
    
    mqttClient.on('reconnect', () => {
        addSystemTerminalLog("SYSTEM", "Reconnection pending... Reconnecting to broker.");
        elements.mqttStatusBadge.className = "status-badge reconnecting";
        elements.mqttStatusText.textContent = "Reconnecting";
        updateDiagnosticsUI();
    });
    
    mqttClient.on('message', (topic, message) => {
        const payloadStr = message.toString().trim();
        addSystemTerminalLog("LIVE", payloadStr, topic);
        
        try {
            if (topic === MQTT_TOPIC_LIVE) {
                const data = JSON.parse(payloadStr);
                
                // Parse Live JSON Telemetry
                state.voltage = data.voltage !== undefined ? parseFloat(data.voltage) : state.voltage;
                state.current = data.current !== undefined ? parseFloat(data.current) : state.current;
                state.power = data.power !== undefined ? parseFloat(data.power) : state.power;
                state.energy = data.energy !== undefined ? parseFloat(data.energy) : state.energy;
                state.balance = data.balance !== undefined ? parseFloat(data.balance) : state.balance;
                state.relayState = data.relayState !== undefined ? !!data.relayState : state.relayState;
                state.faultDetected = data.faultDetected !== undefined ? !!data.faultDetected : state.faultDetected;
                state.theftDetected = data.theftDetected !== undefined ? !!data.theftDetected : state.theftDetected;
                
                state.lastUpdated = new Date();
                
                // First telemetry dismisses loader screen
                if (!firstDataReceived) {
                    firstDataReceived = true;
                    elements.loaderStatus.textContent = "Telemetry Link Established!";
                    setTimeout(() => {
                        elements.loadingScreen.classList.add('fade-out');
                    }, 500);
                }
                
                pushChartData();
                updateUI();
            } 
            else if (topic === MQTT_TOPIC_STATUS) {
                // Parse Relay state confirmations (Support JSON or raw strings 'ON'/'OFF')
                const oldState = state.relayState;
                
                if (payloadStr.startsWith("{")) {
                    try {
                        const data = JSON.parse(payloadStr);
                        state.relayState = data.relayState !== undefined ? !!data.relayState : state.relayState;
                    } catch (e) {}
                } else {
                    if (payloadStr === "ON" || payloadStr === "1" || payloadStr === "true") {
                        state.relayState = true;
                    } else if (payloadStr === "OFF" || payloadStr === "0" || payloadStr === "false") {
                        state.relayState = false;
                    }
                }
                
                if (oldState !== state.relayState) {
                    addBreakerLog(state.relayState ? "RELAY ON" : "RELAY OFF", "ESP32 HARDWARE RESPONSE", "SUCCESS");
                    updateUI();
                }
            }
        } catch (e) {
            console.error("Payload JSON parse error", e);
            addSystemTerminalLog("ERROR", "Invalid JSON packet format.");
        }
    });
    
    mqttClient.on('error', (err) => {
        addSystemTerminalLog("ERROR", `Broker Error: ${err.message}`);
        elements.mqttStatusBadge.className = "status-badge offline";
        elements.mqttStatusText.textContent = "Disconnected";
        updateDiagnosticsUI();
    });
    
    mqttClient.on('close', () => {
        addSystemTerminalLog("SYSTEM", "Broker connection disconnected.");
        elements.mqttStatusBadge.className = "status-badge offline";
        elements.mqttStatusText.textContent = "Disconnected";
        updateDiagnosticsUI();
    });
}

function addSystemTerminalLog(tag, msg, topic = "") {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    let topicText = topic ? `<span class="topic">[${topic}]</span> ` : "";
    let tagClass = "tag-system";
    
    if (tag === "CONTROL") tagClass = "tag-control";
    if (tag === "STATUS") tagClass = "tag-system";
    if (tag === "ALERT" || tag === "ERROR") tagClass = "tag-fault";
    if (tag === "LIVE") tagClass = "tag-system";
    if (tag === "RECHARGE") tagClass = "tag-system";
    if (tag === "THEFT") tagClass = "tag-theft";
    
    const line = document.createElement("div");
    line.className = "line";
    line.innerHTML = `
        <span class="time">[${timeStr}]</span> 
        <span class="log-tag ${tagClass}">${tag}</span> 
        ${topicText}
        <span class="msg">${escapeHTML(msg)}</span>
    `;
    
    elements.mqttTerminal.appendChild(line);
    elements.mqttTerminal.scrollTop = elements.mqttTerminal.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// --- CHARTS MANAGEMENT (4 CHART.JS INSTANCES) ---
function initCharts() {
    const defaultLabels = [];
    const now = new Date();
    
    // Pre-populate last 20 ticks with zero defaults until telemetry arrives
    for (let i = 19; i >= 0; i--) {
        const t = new Date(now.getTime() - i * 5000); // 5s ticks matching ESP32
        defaultLabels.push(t.toLocaleTimeString());
    }
    
    logs.telemetryHistory = defaultLabels.map(l => ({
        time: l,
        voltage: 0.0,
        current: 0.0,
        power: 0.0
    }));

    // Common Chart Grid style configs
    const commonScales = {
        x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#94a3b8', font: { size: 9 } }
        },
        y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { size: 9 } }
        }
    };

    // 1. Voltage Trend Chart
    const ctxVolt = document.getElementById('chart-voltage-trend-canvas').getContext('2d');
    charts.voltage = new Chart(ctxVolt, {
        type: 'line',
        data: {
            labels: defaultLabels,
            datasets: [{
                label: 'Voltage (V)',
                data: Array(20).fill(0),
                borderColor: '#00f2fe',
                backgroundColor: 'rgba(0, 242, 254, 0.05)',
                borderWidth: 2,
                pointRadius: 1,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: commonScales.x,
                y: {
                    min: 150,
                    max: 280,
                    grid: commonScales.y.grid,
                    ticks: commonScales.y.ticks
                }
            },
            plugins: { legend: { display: false } }
        }
    });

    // 2. Current Trend Chart
    const ctxCurr = document.getElementById('chart-current-trend-canvas').getContext('2d');
    charts.current = new Chart(ctxCurr, {
        type: 'line',
        data: {
            labels: defaultLabels,
            datasets: [{
                label: 'Current (A)',
                data: Array(20).fill(0),
                borderColor: '#ff1744',
                backgroundColor: 'rgba(255, 23, 68, 0.05)',
                borderWidth: 2,
                pointRadius: 1,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: commonScales.x,
                y: {
                    min: 0,
                    max: 10,
                    grid: commonScales.y.grid,
                    ticks: commonScales.y.ticks
                }
            },
            plugins: { legend: { display: false } }
        }
    });

    // 3. Power Trend Chart
    const ctxPwr = document.getElementById('chart-power-trend-canvas').getContext('2d');
    charts.power = new Chart(ctxPwr, {
        type: 'line',
        data: {
            labels: defaultLabels,
            datasets: [{
                label: 'Active Power (W)',
                data: Array(20).fill(0),
                borderColor: '#7c4dff',
                backgroundColor: 'rgba(124, 77, 255, 0.05)',
                borderWidth: 2,
                pointRadius: 1,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: commonScales.x,
                y: {
                    min: 0,
                    max: 3000,
                    grid: commonScales.y.grid,
                    ticks: commonScales.y.ticks
                }
            },
            plugins: { legend: { display: false } }
        }
    });

    // 4. Energy Consumption Bar Chart
    const ctxEnergy = document.getElementById('chart-energy-consumption-canvas').getContext('2d');
    charts.energy = new Chart(ctxEnergy, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Energy Consumed (kWh)',
                data: [0, 0, 0, 0, 0, 0, 0], // dynamically filled based on incoming data
                backgroundColor: 'rgba(0, 242, 254, 0.2)',
                borderColor: '#00f2fe',
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: commonScales,
            plugins: { legend: { display: false } }
        }
    });
}

function pushChartData() {
    if (!charts.voltage || !charts.current || !charts.power || !charts.energy) return;
    
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();
    
    // Add to historical cache
    logs.telemetryHistory.push({
        time: timeLabel,
        voltage: state.voltage,
        current: state.current,
        power: state.power
    });
    if (logs.telemetryHistory.length > 100) {
        logs.telemetryHistory.shift();
    }
    
    // Update Voltage Chart
    charts.voltage.data.labels.push(timeLabel);
    charts.voltage.data.datasets[0].data.push(state.voltage);
    if (charts.voltage.data.labels.length > 20) {
        charts.voltage.data.labels.shift();
        charts.voltage.data.datasets[0].data.shift();
    }
    charts.voltage.update('none');

    // Update Current Chart
    charts.current.data.labels.push(timeLabel);
    charts.current.data.datasets[0].data.push(state.current);
    if (charts.current.data.labels.length > 20) {
        charts.current.data.labels.shift();
        charts.current.data.datasets[0].data.shift();
    }
    charts.current.update('none');

    // Update Power Chart
    charts.power.data.labels.push(timeLabel);
    charts.power.data.datasets[0].data.push(state.power);
    if (charts.power.data.labels.length > 20) {
        charts.power.data.labels.shift();
        charts.power.data.datasets[0].data.shift();
    }
    charts.power.update('none');
    
    // Simple bar chart distribution update (spread cumulative reading for exhibition visual)
    const activeDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon is 0, Sun is 6
    charts.energy.data.datasets[0].data[activeDayIndex] = state.energy;
    charts.energy.update();
}

// --- DATA EXPORT TO CSV ---
function exportTelemetryToCSV() {
    if (logs.telemetryHistory.length === 0) {
        showToast("Export Failed", "No telemetry history logged.", "warning");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Timestamp,Voltage (V),Current (A),Active Power (W),Energy (kWh)\r\n";
    
    logs.telemetryHistory.forEach(row => {
        csvContent += `${row.time},${row.voltage.toFixed(2)},${row.current.toFixed(3)},${row.power.toFixed(1)},${state.energy.toFixed(3)}\r\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const filename = `live_meter_telemetry_${new Date().toISOString().slice(0,10)}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
    addSystemTerminalLog("SYSTEM", `CSV logs generated and downloaded: ${filename}`);
    showToast("Export Successful", `Downloaded: ${filename}`, "success");
}
