/**
 * Main entry point for Robotics Module (IIFE bundle)
 *
 * In development/standalone mode, renders the app to #root.
 * In production, the IIFE bundle registers via window.__NKZ__.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import RoboticsApp from './App';
import './index.css';

// Check if we're running standalone (not as federated module)
const rootElement = document.getElementById('root');

if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <RoboticsApp />
        </React.StrictMode>
    );
}
