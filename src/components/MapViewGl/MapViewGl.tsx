import { useEffect, useRef, useState } from 'react';
import maplibregl, { GeolocateControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Feature, Polygon } from 'geojson';
import useSocketConnect from '../../hooks/Socket/useSocketConnect';
import type { GeoJsonProperties } from 'geojson';
import { useAdd32Plane, useRenderPlanes, useUpdatePlane } from '../../hooks';
// Haversine-ish destination point: given lon, lat (deg), bearing (deg), distance (m)

export interface User {
  id: string;
  name: string;
  coords: [number, number];
  color: string;
  sizeMeters: number;
  heightMeters: number;
}

const ReliableMap = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [plane, setPlane] = useState<User>();

  const planesList = useRef<Feature<Polygon, GeoJsonProperties>[]>([]);

  const planesGEO = useRef<FeatureCollection>({
    type: 'FeatureCollection' as const,
    features: planesList.current,
  });

  useSocketConnect(setPlane);
  // Catch uncaught JS errors
  window.onerror = function (message, source, lineno, colno, error) {
    alert(`Error: ${message}\nSource: ${source}:${lineno}:${colno}`);
    console.error('Caught by window.onerror:', {
      message,
      source,
      lineno,
      colno,
      error,
    });
  };

  // Catch unhandled promise rejections
  window.onunhandledrejection = function (event) {
    alert(`Unhandled Promise Rejection: ${event.reason}`);
    console.error('Caught by window.onunhandledrejection:', event.reason);
  };

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
          maxzoom: 18,
          minzoom: 0,
        },
        /*'aws-terrain': {
          type: 'raster-dem',
          tiles: [
            'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
          ],
          maxzoom: 18,
          minzoom: 8,
          encoding: 'terrarium',
          tileSize: 256,
        },*/
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
      style:'https://tiles.openfreemap.org/styles/bright' ,
      center: [-3.436, 55.3781],
      zoom: 5.3,
      pitch: 55,
      bearing: -10,
      maxPitch: 65,
      maxZoom: 18,
      minZoom: 2,
      canvasContextAttributes: { antialias: true },
    });
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    /*map.current.addControl(
      new maplibregl.TerrainControl({
        source: 'aws-terrain',
        exaggeration: 3,
      }),
    );*/

    const geolocate = new GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: false, // Disable the blue location marker
      showAccuracyCircle: false, // Optionally, disable the accuracy circle
    });

    map.current.addControl(geolocate);

    geolocate.on('geolocate', (pos) => {
      if (!pos?.coords) return;

      const coords: [number, number] = [
        pos.coords.longitude,
        pos.coords.latitude,
      ];

      console.log('Updated user coordinates:', coords);
    });

    map.current.on('load', () => {
      try {
        if(!map.current) return;
            map.current.setProjection({ type: 'globe' });

      } catch (e) {
        // some browsers may throw if geolocation isn't allowed - ignore
      }
    });
    map.current.on('style.load',()=>{
        useAdd32Plane(map);

    })
    map.current.on('error', (e) => console.error('MapLibre error:', e));

    // Clean up on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // run once

  //render planes on map(for now planes are green triangles)
  useRenderPlanes({ map, planesGEO });
  // this will update position of the plane
  useUpdatePlane({ newPlane: plane, planesList, map, planesGEO });

  return (
    <div
      ref={mapContainer}
      style={{ width: '100%', height: '100vh', minHeight: '400px' }}
    />
  );
};

export default ReliableMap;
