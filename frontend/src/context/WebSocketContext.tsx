import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
    lastSlideUpdate: number;
    connected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token, isAuthenticated } = useAuth();
    const [lastSlideUpdate, setLastSlideUpdate] = useState<number>(0);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<any>(null);

    const connect = () => {
        if (!token) return;

        // Determine WS protocol (ws or wss) based on current page protocol
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws?token=${token}`;

        console.log("Connecting to WebSocket...");
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("WebSocket connected");
            setConnected(true);
            // Clear any reconnect timeout if we successfully connected
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'slide_created' || data.type === 'slide_updated' || data.type === 'slide_deleted') {
                    console.log("Received slide update:", data);
                    setLastSlideUpdate(Date.now());
                }
            } catch (e) {
                console.error("Failed to parse WS message", e);
            }
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected");
            setConnected(false);
            wsRef.current = null;

            // Attempt reconnect after 5 seconds
            if (isAuthenticated && !reconnectTimeoutRef.current) {
                reconnectTimeoutRef.current = setTimeout(() => {
                    reconnectTimeoutRef.current = null;
                    connect();
                }, 5000);
            }
        };

        ws.onerror = (err) => {
            console.error("WebSocket error", err);
            ws.close();
        };

        wsRef.current = ws;
    };

    useEffect(() => {
        if (isAuthenticated && token) {
            connect();
        } else {
            if (wsRef.current) {
                wsRef.current.close();
            }
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [isAuthenticated, token]);

    return (
        <WebSocketContext.Provider value={{ lastSlideUpdate, connected }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};
