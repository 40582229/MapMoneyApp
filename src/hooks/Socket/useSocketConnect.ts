import { useEffect } from 'react';
import { User } from '../../components/MapViewGl/MapViewGl';

const websocketApiUrl = import.meta.env.VITE_APP_WEBSOCET_CONNECTION_URL || '';

const useSocketConnect = (updateUser: (newUser: User) => void) => {
  useEffect(() => {
    const ws = new WebSocket('wss://exports-olive-hourly-saying.trycloudflare.com');
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('✅ WebSocket connected:', websocketApiUrl);
    };

    ws.onerror = (err) => {
      console.error('❌ WebSocket error:', err);
    };

    ws.onmessage = (msg) => {
      try {
        const user = JSON.parse(msg.data);
        //console.log('📡 Received:', user);
        if (user) updateUser(user);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(); // Close the connection
        console.log('🔌 WebSocket disconnected');
      }
    };
  }, [updateUser]);
};

export default useSocketConnect;
