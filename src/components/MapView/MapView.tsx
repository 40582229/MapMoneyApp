import { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import { View, Geolocation } from 'ol';
import { OSM } from 'ol/source';
import UsersLocationLayer from '../../layers/PositionLayer/UsersLocationLayer';

const deviceId = Math.random().toString(36).substring(2, 15);

const rasterLayer = new TileLayer({
  source: new OSM(),
});

let ws = new WebSocket('wss://cold-ways-live.loca.lt');
ws.binaryType = 'arraybuffer';
const MapView = () => {
  const [position, setPosition] = useState([0,0]);
  const userLocationLayer = useRef<UsersLocationLayer>(new UsersLocationLayer());
  const viewRef = useRef<View>(new View({zoom:10, center:[...position]}));
  const mapRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      setPosition([position.coords.latitude, position.coords.longitude]);
    });
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
  }, []);

  useEffect(() => {
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
  }, []);

  useEffect(() => {

    viewRef.current.setCenter([...position]);
    
    
  }, [position]);

  useEffect(() => {
    if(!viewRef.current || !userLocationLayer) return;

    const map = new Map({
      target: mapRef.current!,
      layers: [rasterLayer, userLocationLayer.current.getUsersLocationLayer()],
      view:viewRef.current,
    });
    const geolocation = new Geolocation({
      tracking: true,
      trackingOptions: {
        enableHighAccuracy: true,
      },
      projection: viewRef.current.getProjection(),
    });

    geolocation.on('change:position', () => {
      const pos = geolocation.getPosition();

      if (pos && userLocationLayer) {
        const userObject = { deviceId, pos, color: userLocationLayer.current.imageUrl()};
        userLocationLayer.current.setUserLocation(deviceId, pos, userLocationLayer.current.imageUrl());
        setPosition(pos);
        
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(userObject));
        }
        console.log(pos);
      }
    });

    ws.addEventListener('message', (msg) => {
      const text = new TextDecoder('utf-8').decode(msg.data);
      let cords = JSON.parse(text);
      if (cords && userLocationLayer) {
        userLocationLayer.current.setUserLocation(cords.deviceId, cords.pos, cords.color);
      }
    });

    return () => {
      map.setTarget(undefined); // cleanup on unmount
    };

  }, []);

  return <div ref={mapRef} style={{ width: '100%', height: '100vh' }} />;
};

export default MapView;
