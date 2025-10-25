import { useEffect } from 'react';
import useStore from '../../store/userStore';

const websocketApiUrl = import.meta.env.VITE_APP_WEBSOCET_CONNECTION_URL || '';
let ws = new WebSocket(websocketApiUrl);
ws.binaryType = 'arraybuffer';

const useSocketConnect = () => {
  let ws = new WebSocket(websocketApiUrl);
  ws.binaryType = 'arraybuffer';
  useEffect(() => {
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
  }, []);
  ws.addEventListener('message', (msg) => {
    const text = new TextDecoder('utf-8').decode(msg.data);
    let cords = JSON.parse(text);
    if (cords) {
      const upsertUser = useStore((s)=> s.upsertUser);
      cords
    }
  });
};

export default useSocketConnect;
