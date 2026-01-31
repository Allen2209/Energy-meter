import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, onValue, get, set } from 'firebase/database';

export default function EcoEnergyDashboard() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [balance, setBalance] = useState(1186.32);
  const [voltage, setVoltage] = useState(228.6);
  const [current, setCurrent] = useState(5.6);
  const [power, setPower] = useState(1281);
  const [energy, setEnergy] = useState(24.9);
  const [monthlyEnergy, setMonthlyEnergy] = useState(420);
  const [relayState, setRelayState] = useState('OFF');
  const [faultStatus, setFaultStatus] = useState('No');
  const [theftStatus, setTheftStatus] = useState('No');
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  const [userInfo] = useState({
    name: 'John Doe',
    address: '123 Solar Street, Green City, 560001',
    meterId: 'EM-2023-8899-X7'
  });

  const [transactions] = useState([
    { id: 1, date: '2023-10-25', desc: 'Recharge - UPI', amount: 500, type: 'credit', status: 'Success' },
    { id: 2, date: '2023-10-24', desc: 'Daily Usage', amount: 24.50, type: 'debit', status: 'Completed' },
    { id: 3, date: '2023-10-23', desc: 'Daily Usage', amount: 22.10, type: 'debit', status: 'Completed' },
    { id: 4, date: '2023-10-20', desc: 'Recharge - Card', amount: 200, type: 'credit', status: 'Success' },
    { id: 5, date: '2023-10-19', desc: 'Daily Usage', amount: 18.30, type: 'debit', status: 'Completed' },
  ]);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [animateBalance, setAnimateBalance] = useState('');
  const [floatingSymbols, setFloatingSymbols] = useState([]);

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 100);

    const meterRef = ref(database, 'live');

    // Listen for data changes
    const unsubscribe = onValue(meterRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Firebase Data Received:', data); // Debugging Log

      if (data) {
        setConnectionStatus('Connected');
        if (data.balance !== undefined) setBalance(Number(data.balance));
        if (data.voltage !== undefined) setVoltage(Number(data.voltage));
        if (data.current !== undefined) setCurrent(Number(data.current));
        if (data.power !== undefined) setPower(Number(data.power));
        if (data.energy !== undefined) setEnergy(Number(data.energy));
        if (data.relayState !== undefined) setRelayState(data.relayState === true || data.relayState === 'ON' ? 'ON' : 'OFF');
        if (data.faultDetected !== undefined) setFaultStatus(data.faultDetected ? 'Yes' : 'No');
        if (data.theftDetected !== undefined) setTheftStatus(data.theftDetected ? 'Yes' : 'No');
      } else {
        setConnectionStatus('No Data');
        console.warn('Firebase connected but no data found at path energyMeter/meterData');
      }
    }, (error) => {
      console.error('Firebase Error:', error);
      setConnectionStatus('Error: ' + error.message);
    });

    return () => unsubscribe();
  }, []);

  const handleRecharge = () => {
    const amount = customAmount || selectedAmount;
    if (!amount || amount <= 0) {
      alert('Please select or enter an amount');
      return;
    }
    if (!selectedPayment) {
      alert('Please select a payment method');
      return;
    }

    const rechargeAmount = parseFloat(amount);
    const balanceRef = ref(database, 'live/balance');

    get(balanceRef).then((snapshot) => {
      const currentBalance = parseFloat(snapshot.val()) || 0;
      const newBalance = currentBalance + rechargeAmount;

      return set(balanceRef, newBalance);
    }).then(() => {
      console.log('Balance updated in Firebase');

      setAnimateBalance('float-up');

      const symbols = Array.from({ length: 5 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100 - 50,
        y: Math.random() * 50 - 25
      }));
      setFloatingSymbols(symbols);

      setTimeout(() => {
        setAnimateBalance('');
        setFloatingSymbols([]);
      }, 2000);

      setShowModal(false);
      setSelectedAmount(null);
      setCustomAmount('');
      setSelectedPayment(null);
    }).catch((error) => {
      console.error('Recharge failed:', error);
      alert('Could not update database.');
    });
  };

  const simulateBalanceDecrease = () => {
    if (balance > 0) {
      const newBalance = Math.max(0, balance - 50);
      setBalance(newBalance);
      if (newBalance === 0) {
        setAnimateBalance('zero-drop');
      } else {
        setAnimateBalance('sinking');
      }
      setTimeout(() => setAnimateBalance(''), 1200);
    }
  };

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: 'linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)',
      minHeight: '100vh',
      color: '#FFFFFF'
    }}>
      {/* Floating Currency Symbols */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
        {floatingSymbols.map(symbol => (
          <div
            key={symbol.id}
            style={{
              position: 'absolute',
              left: `calc(50% + ${symbol.x}px)`,
              top: `calc(50% + ${symbol.y}px)`,
              fontSize: '2.5rem',
              color: '#22C55E',
              fontWeight: 'bold',
              animation: 'floatAway 2s ease-out forwards'
            }}
          >
            ₹
          </div>
        ))}
      </div>

      {/* Top Navigation */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '70px',
        background: '#1F1F1F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        zIndex: 1000,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.8rem' }}>⚡</span>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>EcoEnergy Dashboard</h1>
        </div>
        <div style={{ flex: 1 }}></div>
      </nav>

      <div style={{ display: 'flex', marginTop: '70px' }}>
        {/* Sidebar */}
        <aside style={{
          width: '260px',
          background: '#2D2D2D',
          padding: '2rem 1.5rem',
          position: 'fixed',
          left: 0,
          top: '70px',
          bottom: 0,
          overflowY: 'auto',
          boxShadow: '2px 0 10px rgba(0,0,0,0.3)',
          animation: isLoaded ? 'slideInFromLeft 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
          transform: isLoaded ? 'translateX(0)' : 'translateX(-100%)',
          opacity: isLoaded ? 1 : 0
        }}>
          {/* Controls Section */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              marginBottom: '1.2rem',
              paddingBottom: '0.8rem',
              borderBottom: '1px solid #3A3A3A'
            }}>
              <span>⚙️</span>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Controls</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'Recharge', icon: '₹', color: '#4169E1', action: () => setShowModal(true) },
                { label: 'Settings', icon: '⚙️', color: '#8B5CF6', action: () => setShowSettingsModal(true) },
                { label: 'History', icon: '📜', color: '#F59E0B', action: () => setShowHistoryModal(true) },
                { label: 'Help', icon: '❓', color: '#10B981', action: () => setShowHelpModal(true) },
                { label: 'User Info', icon: '👤', color: '#6366F1', action: () => setShowUserModal(true) }
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={btn.action}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.2rem',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'white',
                    background: btn.color,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <span>{btn.label}</span>
                  <span style={{
                    width: '28px',
                    height: '28px',
                    background: 'rgba(255,255,255,0.3)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem'
                  }}>{btn.icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status Section */}
          <div style={{
            background: 'rgba(0,0,0,0.2)',
            padding: '1.5rem',
            borderRadius: '10px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              marginBottom: '1.2rem',
              paddingBottom: '0.8rem',
              borderBottom: '1px solid #3A3A3A'
            }}>
              <span>ℹ️</span>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Status</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'Fault:', value: faultStatus },
                { label: 'Theft:', value: theftStatus },
                { label: 'Connection:', value: connectionStatus }
              ].map(status => (
                <div key={status.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#A0A0A0' }}>{status.label}</span>
                  <span style={{
                    fontWeight: 600,
                    color: status.value === 'No' || status.value === 'Connected' ? '#22C55E' : (status.value === 'Connecting...' ? '#F59E0B' : '#DC2626')
                  }}>{status.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Demo Button */}
          <button
            onClick={simulateBalanceDecrease}
            style={{
              width: '100%',
              marginTop: '1.5rem',
              padding: '0.75rem',
              background: 'rgba(255,165,0,0.2)',
              border: '1px solid #FFA500',
              borderRadius: '8px',
              color: '#FFA500',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🎬 Simulate Usage
          </button>
        </aside>

        {/* Main Content */}
        <main style={{
          marginLeft: '260px',
          padding: '2rem',
          flex: 1,
          width: 'calc(100% - 260px)'
        }}>
          {/* Dashboard Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1.5rem'
          }}>
            {/* Balance Card */}
            <div
              className={animateBalance}
              style={{
                background: 'linear-gradient(135deg, #4169E1 0%, #5B7FD8 100%)',
                borderRadius: '16px',
                padding: '1.8rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                animation: isLoaded ? `fallIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards 0.2s` : 'none',
                transform: isLoaded ? 'translateY(0)' : 'translateY(-100vh)',
                opacity: isLoaded ? 1 : 0
              }}
            >
              <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '2.5rem', opacity: 0.3 }}>₹</div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 500, opacity: 0.9, marginBottom: '1rem' }}>Current Balance</h3>
              <div style={{ fontSize: '2.8rem', fontWeight: 700, margin: '1rem 0 1.5rem' }}>
                ₹ {balance.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <span style={{ opacity: 0.7 }}>Last Updated:</span>
                  <span style={{ opacity: 0.9 }}>12:45 PM</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ opacity: 0.7 }}>Auto-renewal</span>
                  <span style={{ opacity: 0.9 }}>enabled</span>
                </div>
              </div>
            </div>

            {/* Other Cards */}
            {[
              { title: 'Voltage', value: voltage, unit: 'V', icon: '⚡', color: '#22C55E', delay: 0.3, bar: 99 },
              { title: 'Current', value: current, unit: 'A', icon: '🔌', color: '#A855F7', delay: 0.4, bar: 56 },
              { title: 'Power', value: power, unit: 'W', icon: '💡', color: '#6B7280', delay: 0.5, bar: null }
            ].map(card => (
              <div key={card.title} style={{
                background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}dd 100%)`,
                borderRadius: '16px',
                padding: '1.8rem',
                position: 'relative',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                animation: isLoaded ? `fallIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards ${card.delay}s` : 'none',
                transform: isLoaded ? 'translateY(0)' : 'translateY(-100vh)',
                opacity: isLoaded ? 1 : 0
              }}>
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '2.5rem', opacity: 0.3 }}>{card.icon}</div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 500, opacity: 0.9, marginBottom: '1rem' }}>{card.title}</h3>
                <div style={{ fontSize: '2.5rem', fontWeight: 700, margin: '1rem 0' }}>
                  {card.value} {card.unit}
                </div>
                {card.bar ? (
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: 'rgba(255,255,255,0.2)',
                    borderRadius: '10px',
                    marginTop: '1.5rem'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${card.bar}%`,
                      background: 'rgba(255,255,255,0.7)',
                      borderRadius: '10px'
                    }}></div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '1.5rem'
                  }}>
                    <span style={{
                      background: relayState === 'ON' ? 'rgba(34,197,94,0.3)' : 'rgba(0,0,0,0.3)',
                      padding: '0.4rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}>{relayState}</span>
                    <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Consumption Rate</span>
                  </div>
                )}
              </div>
            ))}

            {/* Energy Card */}
            <div style={{
              background: 'linear-gradient(135deg, #5B7FD8 0%, #4169E1 100%)',
              borderRadius: '16px',
              padding: '1.8rem',
              position: 'relative',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              gridColumn: 'span 2',
              animation: isLoaded ? `fallIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards 0.6s` : 'none',
              transform: isLoaded ? 'translateY(0)' : 'translateY(-100vh)',
              opacity: isLoaded ? 1 : 0
            }}>
              <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '2.5rem', opacity: 0.3 }}>📊</div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 500, opacity: 0.9, marginBottom: '1rem' }}>Energy Consumed</h3>
              <div style={{ fontSize: '3rem', fontWeight: 700, margin: '1rem 0' }}>
                {energy} kWh
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1.5rem',
                fontSize: '0.9rem'
              }}>
                <span style={{ opacity: 0.8 }}>Today</span>
                <span style={{ opacity: 0.8 }}>Month: {monthlyEnergy} kWh</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Recharge Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(8px)'
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: '#2F3849',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '500px',
            padding: '2rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            animation: 'modalSlideIn 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Recharge Energy Meter</h2>
              <button onClick={() => setShowModal(false)} style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '2rem',
                cursor: 'pointer',
                width: '35px',
                height: '35px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>×</button>
            </div>

            {/* Select Amount */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '1rem', fontWeight: 500, marginBottom: '1rem', color: '#E5E7EB' }}>
                Select Amount
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                {[50, 100, 200].map(amount => (
                  <button
                    key={amount}
                    onClick={() => {
                      setSelectedAmount(amount);
                      setCustomAmount('');
                    }}
                    style={{
                      padding: '1.2rem',
                      background: selectedAmount === amount ? '#4169E1' : 'rgba(65,105,225,0.15)',
                      border: '2px solid #4169E1',
                      borderRadius: '12px',
                      color: selectedAmount === amount ? 'white' : '#4169E1',
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    ₹{amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <input
              type="number"
              placeholder="Or enter custom amount"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedAmount(null);
              }}
              style={{
                width: '100%',
                padding: '1rem 1.2rem',
                background: 'rgba(255,255,255,0.05)',
                border: '2px solid #4B5563',
                borderRadius: '10px',
                color: 'white',
                fontSize: '1rem',
                marginBottom: '1.5rem'
              }}
            />

            {/* Payment Method */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '1rem', fontWeight: 500, marginBottom: '1rem', color: '#E5E7EB' }}>
                Payment Method
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem'
              }}>
                {[
                  { id: 'visa', icon: '💳', label: 'Visa' },
                  { id: 'master', icon: '💳', label: 'Master' },
                  { id: 'gpay', icon: '📱', label: 'Google Pay' }
                ].map(method => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPayment(method.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '1rem',
                      background: selectedPayment === method.id ? 'rgba(65,105,225,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${selectedPayment === method.id ? '#4169E1' : '#4B5563'}`,
                      borderRadius: '10px',
                      color: 'white',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>{method.icon}</span>
                    <span>{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleRecharge}
              style={{
                width: '100%',
                padding: '1.2rem',
                background: '#22C55E',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontSize: '1.1rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = '#16A34A';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = '#22C55E';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Confirm Recharge
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInFromLeft {
          0% { transform: translateX(-100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes fallIn {
          0% { transform: translateY(-100vh) rotate(-5deg); opacity: 0; }
          60% { transform: translateY(20px) rotate(2deg); opacity: 1; }
          80% { transform: translateY(-10px) rotate(-1deg); }
          100% { transform: translateY(0) rotate(0deg); opacity: 1; }
        }
        @keyframes floatAway {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-300px) scale(1.5); opacity: 0; }
        }
        @keyframes sink {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(15px) rotate(-2deg); opacity: 0.85; }
        }
        @keyframes zeroDrop {
          0% { transform: translateY(0) rotate(0deg); }
          70% { transform: translateY(80px) rotate(-8deg) scale(0.95); }
          100% { transform: translateY(60px) rotate(-5deg) scale(0.96); opacity: 0.7; }
        }
        @keyframes floatUp {
          0% { transform: translateY(60px) rotate(-5deg) scale(0.96); opacity: 0.7; }
          50% { transform: translateY(-30px) rotate(3deg) scale(1.02); opacity: 1; }
          70% { transform: translateY(10px) rotate(-1deg) scale(0.99); }
          100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes modalSlideIn {
          from { transform: translateY(-50px) scale(0.9); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .sinking { animation: sink 1s cubic-bezier(0.33, 0, 0.67, 1) forwards; }
        .zero-drop { animation: zeroDrop 1.2s cubic-bezier(0.6, 0.04, 0.98, 0.34) forwards; }
        .float-up { animation: floatUp 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      `}</style>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(8px)'
        }} onClick={() => setShowSettingsModal(false)}>
          <div style={{
            background: '#2F3849',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '500px',
            padding: '2rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            animation: 'modalSlideIn 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>System Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '2rem',
                cursor: 'pointer',
                width: '35px',
                height: '35px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>×</button>
            </div>

            {/* Energy Meter Control */}
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.3rem' }}>Energy Meter Status</h3>
                  <p style={{ fontSize: '0.9rem', color: '#A0A0A0' }}>Control the main power relay manually.</p>
                </div>
                <div style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  background: relayState === 'ON' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(220, 38, 38, 0.2)',
                  color: relayState === 'ON' ? '#22C55E' : '#EF4444',
                  fontWeight: 600,
                  border: `1px solid ${relayState === 'ON' ? '#22C55E' : '#EF4444'}`
                }}>
                  {relayState}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <button
                  onClick={() => {
                    const relayRef = ref(database, 'live/relayState');
                    set(relayRef, true).then(() => {
                      console.log('Relay turned ON in Firebase');
                    }).catch((error) => {
                      console.error('Failed to update relay:', error);
                      alert('Could not update relay state.');
                    });
                  }}
                  style={{
                    padding: '1rem',
                    background: relayState === 'ON' ? '#22C55E' : 'rgba(255,255,255,0.05)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    opacity: relayState === 'ON' ? 1 : 0.7
                  }}
                >
                  Turn ON
                </button>
                <button
                  onClick={() => {
                    const relayRef = ref(database, 'live/relayState');
                    set(relayRef, false).then(() => {
                      console.log('Relay turned OFF in Firebase');
                    }).catch((error) => {
                      console.error('Failed to update relay:', error);
                      alert('Could not update relay state.');
                    });
                  }}
                  style={{
                    padding: '1rem',
                    background: relayState === 'OFF' ? '#EF4444' : 'rgba(255,255,255,0.05)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    opacity: relayState === 'OFF' ? 1 : 0.7
                  }}
                >
                  Turn OFF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {
        showHistoryModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(8px)'
          }} onClick={() => setShowHistoryModal(false)}>
            <div style={{
              background: '#2F3849',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '700px',
              padding: '2rem',
              boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
              animation: 'modalSlideIn 0.3s ease-out',
              maxHeight: '80vh',
              overflowY: 'auto'
            }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Transaction History</h2>
                <button onClick={() => setShowHistoryModal(false)} style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  width: '35px',
                  height: '35px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>×</button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ textAlign: 'left', padding: '1rem', color: '#A0A0A0', fontWeight: 500 }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '1rem', color: '#A0A0A0', fontWeight: 500 }}>Description</th>
                      <th style={{ textAlign: 'right', padding: '1rem', color: '#A0A0A0', fontWeight: 500 }}>Amount</th>
                      <th style={{ textAlign: 'right', padding: '1rem', color: '#A0A0A0', fontWeight: 500 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '1rem' }}>{tx.date}</td>
                        <td style={{ padding: '1rem' }}>{tx.desc}</td>
                        <td style={{
                          padding: '1rem',
                          textAlign: 'right',
                          color: tx.type === 'credit' ? '#22C55E' : '#FFFFFF',
                          fontWeight: 600
                        }}>
                          {tx.type === 'credit' ? '+' : '-'} ₹{tx.amount.toFixed(2)}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '20px',
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#22C55E',
                            fontSize: '0.85rem',
                            fontWeight: 500
                          }}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      }
      {/* Help Modal */}
      {showHelpModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(8px)'
        }} onClick={() => setShowHelpModal(false)}>
          <div style={{
            background: '#2F3849',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '500px',
            padding: '2rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            animation: 'modalSlideIn 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Help & Validation</h2>
              <button onClick={() => setShowHelpModal(false)} style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '2rem',
                cursor: 'pointer',
                width: '35px',
                height: '35px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>×</button>
            </div>

            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📞</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.5rem', color: '#A0A0A0' }}>Customer Support</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4169E1', marginBottom: '1.5rem' }}>+91 1800-123-4567</p>

              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                <p style={{ fontSize: '0.9rem', color: '#A0A0A0', marginBottom: '0.5rem' }}>Email Support</p>
                <p style={{ fontWeight: 600 }}>support@ecoenergy.com</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Info Modal */}
      {showUserModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(8px)'
        }} onClick={() => setShowUserModal(false)}>
          <div style={{
            background: '#2F3849',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '500px',
            padding: '2rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            animation: 'modalSlideIn 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>User Information</h2>
              <button onClick={() => setShowUserModal(false)} style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '2rem',
                cursor: 'pointer',
                width: '35px',
                height: '35px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ fontSize: '0.9rem', color: '#A0A0A0', marginBottom: '0.4rem' }}>Name</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{userInfo.name}</div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ fontSize: '0.9rem', color: '#A0A0A0', marginBottom: '0.4rem' }}>Address</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 500, lineHeight: 1.5 }}>{userInfo.address}</div>
              </div>

              <div style={{
                background: 'rgba(65, 105, 225, 0.1)',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid #4169E1'
              }}>
                <div style={{ fontSize: '0.9rem', color: '#4169E1', marginBottom: '0.4rem', fontWeight: 500 }}>Energy Meter Unique Number</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '1px' }}>{userInfo.meterId}</div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
