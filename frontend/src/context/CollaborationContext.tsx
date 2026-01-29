import React, { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useProject } from './ProjectContext';

interface PresenceUser {
    userId: string;
    username: string;
}

interface CollaborationContextType {
    users: PresenceUser[];
    sendCursor: (x: number, y: number) => void;
    isConnected: boolean;
}

const CollaborationContext = createContext<CollaborationContextType | undefined>(undefined);

export const CollaborationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { currentProject } = useProject();
    const [users, setUsers] = useState<PresenceUser[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    const wsUrl = useMemo(() => {
        const base = import.meta.env.VITE_WS_URL || 'ws://localhost:5000/ws';
        if (!user?.token || !currentProject?._id) return null;
        const url = new URL(base);
        url.searchParams.set('token', user.token);
        url.searchParams.set('projectId', currentProject._id);
        return url.toString();
    }, [user?.token, currentProject?._id]);

    useEffect(() => {
        if (!wsUrl) {
            setUsers([]);
            setIsConnected(false);
            return;
        }

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => setIsConnected(true);
        ws.onclose = () => setIsConnected(false);

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'presence') {
                    setUsers(message.users || []);
                }
            } catch {
                // ignore malformed messages
            }
        };

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [wsUrl]);

    const sendCursor = (x: number, y: number) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({ type: 'cursor', x, y }));
    };

    return (
        <CollaborationContext.Provider value={{ users, sendCursor, isConnected }}>
            {children}
        </CollaborationContext.Provider>
    );
};

export const CollaborationContextInstance = CollaborationContext;
