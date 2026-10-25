/**
 * Standalone dev entry (vite dev server); the platform loads src/Module.tsx.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import RoboticsApp from './App';

// Check if we're running standalone (not as federated module)
const rootElement = document.getElementById('root');

if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <RoboticsApp />
        </React.StrictMode>
    );
}
