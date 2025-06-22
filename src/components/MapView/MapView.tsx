import { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import { View, Geolocation } from 'ol';
import { OSM } from 'ol/source';
import UsersLocationLayer from '../../layers/PositionLayer/UsersLocationLayer';
import Control from 'ol/control/Control';

let deviceId = '0';
const newDevcId =localStorage.getItem('dId')
if(newDevcId){
  deviceId = newDevcId;
}else{
  deviceId = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('dId', deviceId);
}

const rasterLayer = new TileLayer({
  source: new OSM(),
});
const websocketApiUrl = process.env.VITE_APP_WEBSOCET_CONNECTION_URL || '';
let ws = new WebSocket(websocketApiUrl);
ws.binaryType = 'arraybuffer';
const MapView = () => {
  const positionRef = useRef([0,0]);
  const userLocationLayer = useRef<UsersLocationLayer>(new UsersLocationLayer());
  const viewRef = useRef<View>(new View({zoom:10, center:positionRef.current}));
  const mapRef = useRef<HTMLDivElement>(null);
  

  useEffect(() => {
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
  }, []);


  useEffect(() => {
    if(!viewRef.current || !userLocationLayer) return;

    const btn = (getPos: () => number[])=>{
      const button = document.createElement('button');
      button.innerHTML = '📍';
      button.className = 'ol-custom-button';
      button.title = 'Center Map';

      button.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent map interactions
        e.preventDefault();
        viewRef.current.setCenter([...getPos()]); // Center map
      });

      const element = document.createElement('div');
      element.className = 'ol-unselectable ol-control';
      element.appendChild(button);

      return new Control({ element });
  }

    const geolocation = new Geolocation({
      tracking: true,
      trackingOptions: {
        enableHighAccuracy: true,
      },
      projection: viewRef.current.getProjection(),
    });

    const map = new Map({
      controls:[btn(()=>positionRef.current)],
      target: mapRef.current!,
      layers: [rasterLayer, userLocationLayer.current.getUsersLocationLayer()],
      view:viewRef.current,
    });

   

    geolocation.on('change:position', () => {
      const pos = geolocation.getPosition();

      if (pos && userLocationLayer) {
        const userObject = { deviceId, pos, color: userLocationLayer.current.imageUrl()};
        userLocationLayer.current.setUserLocation(deviceId, pos, userLocationLayer.current.imageUrl());
        positionRef.current = pos;
        
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
