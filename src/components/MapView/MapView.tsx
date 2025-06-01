import React, { useEffect, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/map';
import TileLayer from 'ol/layer/tile';
import { View, Geolocation, Feature, Overlay } from 'ol';
import CircleStyle from 'ol/style/Circle.js';
import { OGCMapTile, OSM, Vector } from 'ol/source';
import { useInterval } from '../../hooks/UseInterval/useInterval';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { LineString, Point } from 'ol/geom';
import { transform } from 'ol/proj';
import LayerGroup from 'ol/layer/Group';
import Layer from 'ol/layer/Layer';
import Icon from 'ol/style/Icon';
import lg from '../../assets/react.svg';
import PositionLayer from '../../layers/PositionLayer/positionLayer';
const MapView = () => {
  const [position, setPosition] = useState([0, 0]);
  const vectorLayer = new PositionLayer({color:'black', position:[...position]}).getPositionLayer();
  const vectorLayer2 = new PositionLayer({color:'red', position:[0,0]}).getPositionLayer();
  const rasterLayer = new TileLayer({
    source: new OSM(),
  });
  const view = new View({
    center: [...position],
    zoom: 10,
  });
  const map = new Map({
    target: 'map',
    layers: [rasterLayer, vectorLayer, vectorLayer2],
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
      console.log(position);
      setPosition(pos);
    }
  });
    geolocation.setTracking(true);

  return <div id="map" style={{ width: '100%', height: '100vh' }} />;
};

export default MapView;
