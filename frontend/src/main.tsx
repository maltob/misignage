import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import axios from 'axios';

// Configure global axios interceptor for JWT
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
