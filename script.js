// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
// Replace with your Firebase configuration
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCIfqgfkcsL4mJZVrGEfpWZfrdA-tuHECc",
    authDomain: "prepaid-energy-meter-766f1.firebaseapp.com",
    databaseURL: "https://prepaid-energy-meter-766f1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "prepaid-energy-meter-766f1",
    storageBucket: "prepaid-energy-meter-766f1.firebasestorage.app",
    messagingSenderId: "829090401638",
    appId: "1:829090401638:web:636bab9c5047837f48cca7",
    measurementId: "G-6ZM817EVFN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


// Database reference path - adjust according to your structure
const METER_DATA_PATH = 'energyMeter/meterData';

// ==========================================
// STATE MANAGEMENT
// ==========================================
let previousBalance = null;
let previousRelayState = null;
let isInitialLoad = true;

// ==========================================
// DOM ELEMENTS
// ==========================================
const elements = {
    // Cards
    sidebar: document.getElementById('sidebar'),
    balanceCard: document.getElementById('balanceCard'),
    voltageCard: document.getElementById('voltageCard'),
    currentCard: document.getElementById('currentCard'),
    powerCard: document.getElementById('powerCard'),
    energyCard: document.getElementById('energyCard'),

    // Values
    balanceValue: document.getElementById('balanceValue'),
    voltageValue: document.getElementById('voltageValue'),
    currentValue: document.getElementById('currentValue'),
    powerValue: document.getElementById('powerValue'),
    energyValue: document.getElementById('energyValue'),
    lastUpdated: document.getElementById('lastUpdated'),
    monthlyEnergy: document.getElementById('monthlyEnergy'),
    powerStatus: document.getElementById('powerStatus'),

    // Bars
    voltageBar: document.getElementById('voltageBar'),
    currentBar: document.getElementById('currentBar'),

    // Status
    faultStatus: document.getElementById('faultStatus'),
    theftStatus: document.getElementById('theftStatus'),
    connectionStatus: document.getElementById('connectionStatus'),

    // Controls - New buttons
    rechargeBtn: document.getElementById('rechargeBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    historyBtn: document.getElementById('historyBtn'),
    helpBtn: document.getElementById('helpBtn'),
    userInfoBtn: document.getElementById('userInfoBtn'),

    // Alert
    alertBanner: document.getElementById('alertBanner'),

    // Modal
    rechargeModal: document.getElementById('rechargeModal'),
    modalClose: document.getElementById('modalClose'),
    confirmRecharge: document.getElementById('confirmRecharge'),

    // Floating
    floatingSymbols: document.getElementById('floatingSymbols'),

    // Dashboard
    dashboardGrid: document.querySelector('.dashboard-grid')
};

// ==========================================
// ANIMATION UTILITIES
// ==========================================

// Trigger initial page load animations
function triggerInitialAnimations() {
    // Sidebar slides in from left
    setTimeout(() => {
        elements.sidebar.classList.add('slide-in');
    }, 100);

    // Cards fall in with staggered delays
    const cards = [
        elements.balanceCard,
        elements.voltageCard,
        elements.currentCard,
        elements.powerCard,
        elements.energyCard
    ];

    cards.forEach((card, index) => {
        setTimeout(() => {
            card.classList.add('fall-in');
        }, 200 + (index * 100));
    });
}

// Balance sinking animation (when balance decreases)
function triggerBalanceSinking() {
    elements.balanceCard.classList.remove('sinking', 'zero-drop', 'float-up');
    void elements.balanceCard.offsetWidth; // Force reflow
    elements.balanceCard.classList.add('sinking');

    setTimeout(() => {
        elements.balanceCard.classList.remove('sinking');
    }, 1000);
}

// Balance zero drop animation (dramatic fall)
function triggerBalanceZeroDrop() {
    elements.balanceCard.classList.remove('sinking', 'float-up');
    void elements.balanceCard.offsetWidth;
    elements.balanceCard.classList.add('zero-drop');

    // Trigger dashboard shake
    elements.dashboardGrid.classList.add('shake');
    setTimeout(() => {
        elements.dashboardGrid.classList.remove('shake');
    }, 500);
}

// Balance float up animation (recharge success)
function triggerBalanceFloatUp() {
    elements.balanceCard.classList.remove('sinking', 'zero-drop');
    void elements.balanceCard.offsetWidth;
    elements.balanceCard.classList.add('float-up');

    // Create floating currency symbols
    createFloatingCurrency();

    setTimeout(() => {
        elements.balanceCard.classList.remove('float-up');
    }, 1500);
}

// Create floating currency symbols
function createFloatingCurrency() {
    const cardRect = elements.balanceCard.getBoundingClientRect();
    const centerX = cardRect.left + cardRect.width / 2;
    const centerY = cardRect.top + cardRect.height / 2;

    // Create 5 floating symbols
    for (let i = 0; i < 5; i++) {
        const symbol = document.createElement('div');
        symbol.className = 'floating-currency';
        symbol.textContent = '₹';

        // Random spread around center
        const offsetX = (Math.random() - 0.5) * 100;
        const offsetY = (Math.random() - 0.5) * 50;

        symbol.style.left = (centerX + offsetX) + 'px';
        symbol.style.top = (centerY + offsetY) + 'px';

        elements.floatingSymbols.appendChild(symbol);

        // Remove after animation
        setTimeout(() => {
            symbol.remove();
        }, 2000);
    }
}

// ==========================================
// FIREBASE DATA HANDLERS
// ==========================================

// Handle balance updates
function handleBalanceUpdate(balance) {
    const balanceNum = parseFloat(balance) || 0;
    elements.balanceValue.textContent = balanceNum.toFixed(2);

    // Update last updated time
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (elements.lastUpdated) {
        elements.lastUpdated.textContent = timeStr;
    }

    // Trigger animations based on balance changes
    if (!isInitialLoad && previousBalance !== null) {
        if (balanceNum === 0 && previousBalance > 0) {
            // Balance just hit zero - dramatic drop
            triggerBalanceZeroDrop();
        } else if (balanceNum > previousBalance) {
            // Balance increased - recharge success
            triggerBalanceFloatUp();
        } else if (balanceNum < previousBalance) {
            // Balance decreased - sinking effect
            triggerBalanceSinking();
        }
    }

    previousBalance = balanceNum;
}

// Handle relay state updates
function handleRelayStateUpdate(state) {
    const isOn = state === 'ON' || state === true || state === 1;

    // Update power status in card
    if (elements.powerStatus) {
        elements.powerStatus.textContent = isOn ? 'ON' : 'OFF';
        elements.powerStatus.style.background = isOn ? 'rgba(34, 197, 94, 0.3)' : 'rgba(0, 0, 0, 0.3)';
    }

    previousRelayState = isOn;
}

// Handle voltage updates
function handleVoltageUpdate(voltage) {
    const voltageNum = parseFloat(voltage) || 0;
    elements.voltageValue.textContent = voltageNum.toFixed(1);

    // Update bar (assuming 230V is 100%)
    const percentage = Math.min((voltageNum / 230) * 100, 100);
    elements.voltageBar.style.width = percentage + '%';
}

// Handle current updates
function handleCurrentUpdate(current) {
    const currentNum = parseFloat(current) || 0;
    elements.currentValue.textContent = currentNum.toFixed(2);

    // Update bar (assuming 10A is 100%)
    const percentage = Math.min((currentNum / 10) * 100, 100);
    elements.currentBar.style.width = percentage + '%';
}

// Handle power updates
function handlePowerUpdate(power) {
    const powerNum = parseFloat(power) || 0;
    elements.powerValue.textContent = powerNum.toFixed(0);
}

// Handle energy updates
function handleEnergyUpdate(energy) {
    const energyNum = parseFloat(energy) || 0;
    elements.energyValue.textContent = energyNum.toFixed(2);
}

// Handle fault detection
function handleFaultDetection(faultDetected) {
    if (elements.faultStatus) {
        if (faultDetected) {
            elements.faultStatus.textContent = 'Yes';
            elements.faultStatus.className = 'status-value fault-status yes';
        } else {
            elements.faultStatus.textContent = 'No';
            elements.faultStatus.className = 'status-value fault-status no';
        }
    }

    if (faultDetected) {
        elements.alertBanner.textContent = '⚠️ Fault Detected! System protection activated.';
        elements.alertBanner.className = 'alert-banner fault';
    } else {
        elements.alertBanner.classList.add('hidden');
    }
}

// Handle theft detection
function handleTheftDetection(theftDetected) {
    if (elements.theftStatus) {
        if (theftDetected) {
            elements.theftStatus.textContent = 'Yes';
            elements.theftStatus.className = 'status-value theft-status yes';
        } else {
            elements.theftStatus.textContent = 'No';
            elements.theftStatus.className = 'status-value theft-status no';
        }
    }

    if (theftDetected) {
        elements.alertBanner.textContent = '🚨 Theft Alert! Unauthorized tampering detected.';
        elements.alertBanner.className = 'alert-banner theft';
    } else if (!elements.alertBanner.classList.contains('fault')) {
        elements.alertBanner.classList.add('hidden');
    }
}

// ==========================================
// FIREBASE LISTENERS
// ==========================================

function setupFirebaseListeners() {
    const meterRef = database.ref(METER_DATA_PATH);

    // Listen to balance changes
    meterRef.child('balance').on('value', (snapshot) => {
        const balance = snapshot.val();
        handleBalanceUpdate(balance);
    });

    // Listen to relay state changes
    meterRef.child('relayState').on('value', (snapshot) => {
        const state = snapshot.val();
        handleRelayStateUpdate(state);
    });

    // Listen to voltage changes
    meterRef.child('voltage').on('value', (snapshot) => {
        const voltage = snapshot.val();
        handleVoltageUpdate(voltage);
    });

    // Listen to current changes
    meterRef.child('current').on('value', (snapshot) => {
        const current = snapshot.val();
        handleCurrentUpdate(current);
    });

    // Listen to power changes
    meterRef.child('power').on('value', (snapshot) => {
        const power = snapshot.val();
        handlePowerUpdate(power);
    });

    // Listen to energy changes
    meterRef.child('energy').on('value', (snapshot) => {
        const energy = snapshot.val();
        handleEnergyUpdate(energy);
    });

    // Listen to fault detection
    meterRef.child('faultDetected').on('value', (snapshot) => {
        const fault = snapshot.val();
        handleFaultDetection(fault);
    });

    // Listen to theft detection
    meterRef.child('theftDetected').on('value', (snapshot) => {
        const theft = snapshot.val();
        handleTheftDetection(theft);
    });
}

// ==========================================
// RECHARGE FUNCTIONALITY
// ==========================================

let selectedAmount = 0;
let selectedPaymentMethod = '';

function rechargeAccount(amount) {
    const rechargeAmount = parseFloat(amount);

    if (isNaN(rechargeAmount) || rechargeAmount <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    if (!selectedPaymentMethod) {
        alert('Please select a payment method');
        return;
    }

    // Get current balance
    database.ref(METER_DATA_PATH + '/balance').once('value')
        .then((snapshot) => {
            const currentBalance = parseFloat(snapshot.val()) || 0;
            const newBalance = currentBalance + rechargeAmount;

            // Update balance in Firebase
            return database.ref(METER_DATA_PATH + '/balance').set(newBalance);
        })
        .then(() => {
            console.log('Recharge successful');
            closeModal();
            // Reset selections
            selectedAmount = 0;
            selectedPaymentMethod = '';
            // Animation will be triggered automatically by Firebase listener
        })
        .catch((error) => {
            console.error('Error during recharge:', error);
            alert('Recharge failed. Please try again.');
        });
}

// ==========================================
// MODAL CONTROLS
// ==========================================

function openModal() {
    elements.rechargeModal.classList.remove('hidden');
    // Reset selections
    selectedAmount = 0;
    selectedPaymentMethod = '';
    document.querySelectorAll('.recharge-option').forEach(btn => btn.classList.remove('selected'));
    document.querySelectorAll('.payment-method').forEach(btn => btn.classList.remove('selected'));
}

function closeModal() {
    elements.rechargeModal.classList.add('hidden');
    document.getElementById('customAmount').value = '';
    selectedAmount = 0;
    selectedPaymentMethod = '';
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function setupEventListeners() {
    // Sidebar button actions
    elements.rechargeBtn.addEventListener('click', openModal);

    elements.settingsBtn.addEventListener('click', () => {
        alert('Settings feature - Configure your energy meter preferences');
    });

    elements.historyBtn.addEventListener('click', () => {
        alert('History feature - View your energy usage history');
    });

    elements.helpBtn.addEventListener('click', () => {
        alert('Help feature - Get assistance with the dashboard');
    });

    elements.userInfoBtn.addEventListener('click', () => {
        alert('User Info feature - Manage your account details');
    });

    // Modal controls
    elements.modalClose.addEventListener('click', closeModal);

    // Recharge amount selection
    document.querySelectorAll('.recharge-option').forEach(button => {
        button.addEventListener('click', (e) => {
            // Remove selected class from all options
            document.querySelectorAll('.recharge-option').forEach(btn => btn.classList.remove('selected'));
            // Add selected class to clicked option
            e.target.classList.add('selected');
            // Store selected amount
            selectedAmount = parseFloat(e.target.getAttribute('data-amount'));
            // Clear custom amount input
            document.getElementById('customAmount').value = '';
        });
    });

    // Custom amount input
    document.getElementById('customAmount').addEventListener('input', (e) => {
        // Remove selected class from preset options
        document.querySelectorAll('.recharge-option').forEach(btn => btn.classList.remove('selected'));
        selectedAmount = parseFloat(e.target.value) || 0;
    });

    // Payment method selection
    document.querySelectorAll('.payment-method').forEach(button => {
        button.addEventListener('click', (e) => {
            // Remove selected class from all methods
            document.querySelectorAll('.payment-method').forEach(btn => btn.classList.remove('selected'));
            // Add selected class to clicked method
            const btn = e.currentTarget;
            btn.classList.add('selected');
            // Store selected payment method
            selectedPaymentMethod = btn.getAttribute('data-method');
        });
    });

    // Confirm recharge
    elements.confirmRecharge.addEventListener('click', () => {
        if (selectedAmount > 0) {
            rechargeAccount(selectedAmount);
        } else {
            alert('Please select or enter an amount');
        }
    });

    // Close modal on outside click
    elements.rechargeModal.addEventListener('click', (e) => {
        if (e.target === elements.rechargeModal) {
            closeModal();
        }
    });
}

// ==========================================
// INITIALIZATION
// ==========================================

function init() {
    console.log('Initializing Energy Meter Dashboard...');

    // Trigger initial animations
    triggerInitialAnimations();

    // Setup Firebase listeners
    setupFirebaseListeners();

    // Setup event listeners
    setupEventListeners();

    // Mark initial load as complete after 2 seconds
    setTimeout(() => {
        isInitialLoad = false;
        console.log('Dashboard ready');
    }, 2000);
}

// Start the application when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ==========================================
// DEMO MODE (Optional - for testing without Firebase)
// ==========================================

// Uncomment the following function to test animations without Firebase
/*
function demoMode() {
    console.log('Running in DEMO mode');
    
    // Simulate initial data
    setTimeout(() => {
        handleBalanceUpdate(150.50);
        handleRelayStateUpdate('ON');
        handleVoltageUpdate(230);
        handleCurrentUpdate(5.2);
        handlePowerUpdate(1196);
        handleEnergyUpdate(12.45);
        isInitialLoad = false;
    }, 2000);
    
    // Simulate balance decrease every 10 seconds
    setInterval(() => {
        const currentBalance = parseFloat(elements.balanceValue.textContent);
        if (currentBalance > 0) {
            handleBalanceUpdate(Math.max(0, currentBalance - 5));
        }
    }, 10000);
    
    // Simulate relay toggle every 30 seconds
    setInterval(() => {
        const currentState = elements.relayText.textContent;
        handleRelayStateUpdate(currentState === 'ON' ? 'OFF' : 'ON');
    }, 30000);
}

// Uncomment to enable demo mode
// demoMode();
*/
