# EcoEnergy Dashboard

A modern, responsive React application for monitoring prepaid energy meter data. This dashboard integrates with Firebase Realtime Database for live updates.

## Prerequisites

- **Node.js**: Ensure you have Node.js installed (version 14.x or higher recommended).
- **npm**: Comes bundled with Node.js.

## Installation

1.  **Clone/Navigate to the project directory**:
    ```bash
    cd d:/energy_meter
    ```

2.  **Install Dependencies**:
    Run the following command to install React, Vite, and Firebase dependencies:
    ```bash
    npm install
    ```

## Running the Application

1.  **Start the Development Server**:
    ```bash
    npm run dev
    ```

2.  **Open the App**:
    The terminal will show a local URL, usually:
    [http://localhost:5173/](http://localhost:5173/)
    Open this link in your browser.

## Features

- **Live Monitoring**: Real-time updates for Balance, Voltage, Current, Power, and Energy.
- **Recharge**: Cloud-based recharge functionality with payment simulation.
- **Settings**: Toggle the Energy Meter (Relay) ON/OFF remotely.
- **History**: View transaction history.
- **User Info**: View account details.
- **Help**: Contact support information.

## Tech Stack

- **Frontend**: React, Vite
- **Styling**: Vanilla CSS (with animations)
- **Backend**: Firebase Realtime Database

## Project Structure

- `src/App.jsx`: Main application logic and UI.
- `src/firebase.js`: Firebase configuration.
- `src/main.jsx`: Entry point.
- `styles.css`: Global styles and animations.
