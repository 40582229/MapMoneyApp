import React, { useEffect, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import { View, Geolocation,  } from 'ol';
import { OSM } from 'ol/source';

import PositionLayer from '../../layers/PositionLayer/positionLayer';
let  ws = new WebSocket('wss://wild-otters-search.loca.lt');
ws.binaryType = 'arraybuffer';
const MapView = () => {
    const [position, setPosition] = useState([0, 0]);
    
    const vectorLayer = new PositionLayer({color:'black'}).getPositionLayer(position);
    useEffect(() => {
      ws.onopen = () => {
        console.log('WebSocket connected');
        // Optional: send queued messages here if you keep any
      };
    }, []);


  const rasterLayer = new TileLayer({
    source: new OSM(),
  });
  const view = new View({
    center: [...position],
    zoom: 10,
  });
  const map = new Map({
    target: 'map',
    layers: [rasterLayer, vectorLayer],
    view,
  });

  const geolocation = new Geolocation({
    tracking: true,
    // enableHighAccuracy must be set to true to have the heading value.
    trackingOptions: {
      enableHighAccuracy: true,
    },
    projection: view.getProjection(),
  });
  geolocation.on('change:position', () => {
    const pos = geolocation.getPosition();
    if (pos) {
      if(ws.readyState === ws.OPEN){
        ws.send(JSON.stringify(pos))
      }
      console.log(pos);
      setPosition(pos);
    }
  });
    geolocation.setTracking(true);
    
    ws.addEventListener('message',(msg)=>{
      const text = new TextDecoder("utf-8").decode(msg.data)
      let cords = JSON.parse(text);
      if(map.getAllLayers().length !== 3){
          const vectorLayer2 = new PositionLayer({color:'red'}).getPositionLayer(cords);
          console.log(cords);
          map.addLayer(vectorLayer2)
      }
      ///setPosition2([lat,lon]);
      
    })
  return <div id="map" style={{ width: '100%', height: '100vh' }} />;
};

export default MapView;
