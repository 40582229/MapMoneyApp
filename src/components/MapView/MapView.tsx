import { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import { View, Geolocation, Feature } from 'ol';
import { OSM } from 'ol/source';
import UsersLocationLayer from '../../layers/PositionLayer/UsersLocationLayer';
import Control from 'ol/control/Control';
import { LineString, Point } from 'ol/geom';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import CircleStyle from 'ol/style/Circle';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import XYZ from 'ol/source/XYZ';
import GeoJSON from 'ol/format/GeoJSON'; // ✅ for future use if needed

let deviceId = '0';
const newDevcId = localStorage.getItem('dId');
if (newDevcId) {
  deviceId = newDevcId;
} else {
  deviceId = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('dId', deviceId);
}

const hillshade = new TileLayer({
  source: new XYZ({
    url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
  }),
  opacity: 0.3,
});

const satShade = new TileLayer({
  source: new XYZ({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  }),
  opacity: 1,
});

const rasterLayer = new TileLayer({
  source: new OSM(),
});

const getDistance = (coord1: Array<number>, coord2: Array<number>) => {
  const R = 6371e3; // Earth radius in meters
  const [lon1, lat1] = coord1.map((x) => (x * Math.PI) / 180);
  const [lon2, lat2] = coord2.map((x) => (x * Math.PI) / 180);

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
};

const websocketApiUrl = import.meta.env.VITE_APP_WEBSOCET_CONNECTION_URL || '';
let ws = new WebSocket(websocketApiUrl);
ws.binaryType = 'arraybuffer';

const MapView = () => {
  const positionRef = useRef([0, 0]);
  const userLocationLayer = useRef<UsersLocationLayer>(
    new UsersLocationLayer(),
  );
  const viewRef = useRef<View>(
    new View({ zoom: 10, center: positionRef.current }),
  );
  const mapRef = useRef<HTMLDivElement>(null);

  // ✅ Path layer and source refs
  const pathSource = useRef<VectorSource>(new VectorSource());
  const pathLayer = useRef<VectorLayer>(
    new VectorLayer({
      source: pathSource.current,
      style: new Style({
        stroke: new Stroke({
          color: '#ff6600',
          width: 3,
        }),
      }),
    }),
  );

  useEffect(() => {
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
  }, []);

  useEffect(() => {
    if (!viewRef.current || !userLocationLayer) return;

    const btn = (getPos: () => number[]) => {
      const button = document.createElement('button');
      button.innerHTML = '📍';
      button.className = 'ol-custom-button';
      button.title = 'Center Map';

      button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        viewRef.current.setCenter([...getPos()]);
      });

      const element = document.createElement('div');
      element.className = 'ol-unselectable ol-control';
      element.appendChild(button);

      return new Control({ element });
    };

    const geolocation = new Geolocation({
      tracking: true,
      trackingOptions: {
        enableHighAccuracy: true,
      },
      projection: viewRef.current.getProjection(),
    });

    const map = new Map({
      controls: [btn(() => positionRef.current)],
      target: mapRef.current!,
      layers: [
        satShade,
        hillshade,
        userLocationLayer.current.getUsersLocationLayer(),
        pathLayer.current, // ✅ add the path layer
      ],
      view: viewRef.current,
    });

    // ✅ Handle map click for destination selection
    map.on('click', async (e) => {
      const userPos = positionRef.current;
      const dest = e.coordinate;

      if (!userPos || userPos[0] === 0) {
        console.warn('User position not ready');
        return;
      }

      // Clear old route
      pathSource.current.clear();

      // Convert OpenLayers coordinates (EPSG:3857) to lon/lat (EPSG:4326)
      const toLonLat = (coords: number[]) => {
        const [x, y] = coords;
        const lon = (x / 20037508.34) * 180;
        let lat = (y / 20037508.34) * 180;
        lat =
          (180 / Math.PI) *
          (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
        return [lon, lat];
      };

      const startLonLat = toLonLat(userPos);
      const destLonLat = toLonLat(dest);

      // Fetch walking route from ORS
      try {
        const apiKey = import.meta.env.VITE_ORS_API_KEY;
        const url =
          'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            coordinates: [startLonLat],
            options: { round_trip: { length: 5 * 1000, points: 30 } },

          }),
        });

        if (!response.ok) throw new Error('Failed to fetch route');

        const data = await response.json();

        // Parse GeoJSON and add to path source
        const geojsonFormat = new GeoJSON();
        const features = geojsonFormat.readFeatures(data, {
          featureProjection: viewRef.current.getProjection(),
        });

        pathSource.current.addFeatures(features);

        // Optional: add start/end markers
        pathSource.current.addFeature(
          new Feature({ geometry: new Point(userPos) }),
        );
        pathSource.current.addFeature(
          new Feature({ geometry: new Point(dest) }),
        );
      } catch (err) {
        console.error(err);
        alert('Error fetching walking route.');
      }
    });

    // ✅ Geolocation handling
    geolocation.on('change:position', () => {
      const pos = geolocation.getPosition();
      const accuracy = geolocation.getAccuracy();
      if (pos && userLocationLayer) {
        const newPos = pos;
        const userObject = {
          deviceId,
          pos: newPos,
          color: userLocationLayer.current.imageUrl(),
        };

        if (accuracy && accuracy < 25) {
          if (getDistance(positionRef.current, newPos) > 3) {
            userLocationLayer.current.setUserLocation(
              deviceId,
              pos,
              userLocationLayer.current.imageUrl(),
            );

            positionRef.current = pos;

            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify(userObject));
            }
            console.log(pos);
          }
        }
      }
    });

    ws.addEventListener('message', (msg) => {
      const text = new TextDecoder('utf-8').decode(msg.data);
      let cords = JSON.parse(text);
      if (cords && userLocationLayer) {
        userLocationLayer.current.setUserLocation(
          cords.deviceId,
          cords.pos,
          cords.color,
        );
      }
    });

    return () => {
      map.setTarget(undefined);
    };
  }, []);

  return <div ref={mapRef} style={{ width: '100%', height: '100vh' }} />;
};

export default MapView;
