import { useEffect, useRef } from 'react';
import maplibregl, { GeolocateControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Feature, Polygon } from 'geojson';

// Haversine-ish destination point: given lon, lat (deg), bearing (deg), distance (m)
function destinationPoint(
  lon: number,
  lat: number,
  bearingDeg: number,
  distanceMeters: number,
) {
  const R = 6371e3;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const θ = (bearingDeg * Math.PI) / 180;
  const δ = distanceMeters / R;

  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);

  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  return [(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI] as [number, number];
}

// Calculate initial bearing from start -> end (degrees 0..360, 0 = north)
function bearingBetweenPoints(start: [number, number], end: [number, number]) {
  const [lon1, lat1] = start.map((v) => (v * Math.PI) / 180);
  const [lon2, lat2] = end.map((v) => (v * Math.PI) / 180);

  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

// Build a small pyramid-like polygon (triangle) footprint oriented by `bearing`.
// center: [lon, lat]
// sizeMeters: distance from center to tip
// baseWidthMeters: distance from center to each base corner (controls footprint width)
function buildPyramidPolygon(
  center: [number, number],
  bearingDeg: number,
  sizeMeters = 250,
  baseWidthMeters = 120,
) {
  const [lon, lat] = center;

  // tip: forward
  const tip = destinationPoint(lon, lat, bearingDeg, sizeMeters);

  // rear center: a bit behind the center to form a pyramid base
  const rearCenter = destinationPoint(
    lon,
    lat,
    (bearingDeg + 180) % 360,
    sizeMeters * 0.45,
  );

  // left & right base corners around the rear center (perpendicular offsets)
  const leftBase = destinationPoint(
    rearCenter[0],
    rearCenter[1],
    bearingDeg - 90,
    baseWidthMeters,
  );
  const rightBase = destinationPoint(
    rearCenter[0],
    rearCenter[1],
    bearingDeg + 90,
    baseWidthMeters,
  );

  // Close polygon
  const coords: [number, number][] = [
    [tip[0], tip[1]],
    [leftBase[0], leftBase[1]],
    [rightBase[0], rightBase[1]],
    [tip[0], tip[1]],
  ];

  // Return geojson polygon geometry
  return coords;
}

const ReliableMap = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);

  // Example users: each has coords and optional visual properties
  let users = [
    {
      id: 'alice',
      name: 'Alice',
      coords: [12.4964, 41.9028],
      color: '#FF6A00',
      sizeMeters: 30,
      heightMeters: 90,
    }, // Rome
    {
      id: 'bob',
      name: 'Bob',
      coords: [-0.1276, 51.5074],
      color: '#007AFF',
      sizeMeters: 28,
      heightMeters: 75,
    }, // London
    {
      id: 'charlie',
      name: 'Charlie',
      coords: [2.3522, 48.8566],
      color: '#32D74B',
      sizeMeters: 26,
      heightMeters: 80,
    }, // Paris
  ];

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const style: maplibregl.StyleSpecification = {
      version: 8,
      projection: { type: 'globe' },

      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          attribution: '&copy; OpenStreetMap contributors & OpenFreeMap',
          maxzoom: 11,
          minzoom: 0,
        },
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
        },
      ],
    };

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: [-3.436, 55.3781],
      zoom: 5.3,
      pitch: 55,
      bearing: -10,
      maxPitch: 65,
      maxZoom: 13,
      minZoom: 2,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    const geolocate = new GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    });
    map.current.addControl(geolocate);
    geolocate.on('trackuserlocationend', (pos) => {
      console.log("POSITION", pos)
      const user = users.find((user) => user.id === 'rk');
      if (!user) {
        users.push({
          id: 'charlie',
          name: 'Charlie',
          coords: [2.3522, 48.8566],
          color: '#32D74B',
          sizeMeters: 26,
          heightMeters: 80,
        });
      }else{
        user.coords = pos
      }
      console.log('A trackuserlocationend event has occurred.');
    });
    map.current.on('load', () => {
      // Compose a multi-feature GeoJSON: one polygon per user
      const features: Feature<Polygon, any>[] = users.map((user, idx) => {
        const center = user.coords as [number, number];
        // target is the next user in the array (wrap-around)
        const next = users[(idx + 1) % users.length].coords as [number, number];
        const bearing = bearingBetweenPoints(center, next);

        const polygonCoords = buildPyramidPolygon(center, bearing, 2500, 1200);

        return {
          type: 'Feature',
          properties: {
            id: user.id,
            name: user.name,
            color: 'yellow',
            height: user.heightMeters,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [polygonCoords],
          },
        } as Feature<Polygon, any>;
      });

      const pyramidGeoJSON: FeatureCollection = {
        type: 'FeatureCollection',
        features,
      };

      // Add geojson source and extrusion layer
      if (!map.current!.getSource('pyramids')) {
        map.current!.addSource('pyramids', {
          type: 'geojson',
          data: pyramidGeoJSON,
        });
      } else {
        (
          map.current!.getSource('pyramids') as maplibregl.GeoJSONSource
        ).setData(pyramidGeoJSON);
      }

      // Extrusion layer: use 'fill-extrusion' with per-feature color/height
      if (!map.current!.getLayer('pyramid-extrusion')) {
        map.current!.addLayer({
          id: 'pyramid-extrusion',
          type: 'fill-extrusion',
          source: 'pyramids',
          paint: {
            // Use property-driven height and color
            'fill-extrusion-base': 4900,
            'fill-extrusion-height': 5000, // 👈 Total height above ground
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-opacity': 0.95,
          },
        });
      }

      // Add a simple 2D circle layer to mark the user center points (optional)
      /*if (!map.current!.getSource('user-points')) {
        map.current!.addSource('user-points', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: users.map((u) => ({
              type: 'Feature',
              properties: { name: u.name, color: u.color },
              geometry: { type: 'Point', coordinates: u.coords },
            })),
          },
        });

        map.current!.addLayer({
          id: 'user-points-layer',
          type: 'circle',
          source: 'user-points',
          paint: {
            'circle-radius': 6,
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });
      }*/

      // Trigger geolocate control so the browser may ask permission (optional)
      try {
        geolocate.trigger();
      } catch (e) {
        // some browsers may throw if geolocation isn't allowed - ignore
      }
    });

    map.current.on('error', (e) => console.error('MapLibre error:', e));

    // Clean up on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // run once

  return (
    <div
      ref={mapContainer}
      style={{ width: '100%', height: '100vh', minHeight: '400px' }}
    />
  );
};

export default ReliableMap;
