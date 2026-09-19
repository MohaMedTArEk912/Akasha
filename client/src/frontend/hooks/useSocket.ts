import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
const API_PORT = (import.meta as any).env?.VITE_API_PORT || "3001";

function getSocketUrl(): string {
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return `http://localhost:${API_PORT}`;
    }
    return window.location.origin;
  }
  return "";
}

let _socket: Socket | null = null;
let _token = "";

export function useSocket(token: string): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(() => {
    if (token && _socket && _token === token) return _socket;
    return null;
  });

  useEffect(() => {
    if (!token) return;

    if (_socket && _token === token) {
      setSocket(_socket);
      return;
    }

    if (_socket) {
      _socket.disconnect();
      _socket = null;
    }

    _token = token;
    const s = io(getSocketUrl(), {
      auth: { token },
      transports: ["websocket"],
    });

    _socket = s;
    setSocket(s);
  }, [token]);

  return socket;
}
