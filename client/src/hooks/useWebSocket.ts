import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket(onMessage?: (message: WebSocketMessage) => void) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Add a small delay to ensure window.location is properly set
    const connectWebSocket = () => {
      // Always use backend port for WebSocket connection
      const host = 'localhost:3000';
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${host}/ws`;
      
      console.log('WebSocket: Connecting to backend at:', wsUrl);
      
      // Validate URL before creating WebSocket
      try {
        new URL(wsUrl);
      } catch (error) {
        console.error('WebSocket: Invalid URL, skipping connection:', wsUrl, error);
        return;
      }
      
      try {
        ws.current = new WebSocket(wsUrl);
        
        ws.current.onopen = () => {
          setIsConnected(true);
        };

        ws.current.onclose = () => {
          setIsConnected(false);
        };

        ws.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            onMessage?.(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
      } catch (error) {
        console.error('WebSocket: Failed to create WebSocket:', error);
        return;
      }
    };

    // Connect immediately if window.location is ready, otherwise wait
    if (window.location.host) {
      connectWebSocket();
    } else {
      const timeoutId = setTimeout(connectWebSocket, 100);
      return () => clearTimeout(timeoutId);
    }

    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [onMessage]);

  const sendMessage = (message: WebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { isConnected, sendMessage };
}
