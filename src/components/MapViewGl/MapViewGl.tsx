import { useEffect, useRef } from 'react';
import maplibregl, { GeolocateControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const ReliableMap = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const usersGeo: any = { type: 'FeatureCollection', features: [] };

  useEffect(() => {
    // Prevent double initialization
    if (!mapContainer.current || map.current) return;

    const style: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap Contributors',
        },
        'aws-terrain': {
          type: 'raster-dem',
          tiles: [
            'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
          ],
          encoding: 'terrarium',
          tileSize: 256,
        },
        'aws-hillshade':{
          type:'raster-dem',
          tiles: [
            'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
          ],
          encoding: 'terrarium',
          tileSize: 256,
        }
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
        },
        {
          id: 'hills',
          type: 'hillshade',
          source: 'aws-hillshade',
          layout: { visibility: 'visible' },
          paint: { 'hillshade-shadow-color': '#473B24' },
        },
      ],
    };

    // Create map instance
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: [-3.436, 55.3781], // UK
      zoom: 10,
      pitch: 70,
      bearing: 20,
      maxPitch: 85,
      maxZoom: 18,
      minZoom: 0,
    });
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.addControl(
      new maplibregl.TerrainControl({
        source: 'aws-terrain',
        exaggeration: 3,
      }),
    );
    /*map.current.addSource('users', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.current.addLayer({
      id: 'users-layer',
      type: 'circle',
      source: 'users',
      paint: {
        'circle-radius': 6,
        'circle-color': ['get', 'color'], // or fixed color
      },
    });*/

    // example in-memory store


    // user = { id, lng, lat, ...props }

    // Initialize the geolocate control.
    let geolocate = new GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
    });
    // Add the control to the map.
    map.current.addControl(geolocate);
    // Set an event listener that fires
    // when a trackuserlocationend event occurs.
    geolocate.on('trackuserlocationend', (pos) => {
      console.log('A trackuserlocationend event has occurred.');
    });

    map.current.on('load', () => {
      geolocate.trigger();
      console.log('Map loaded successfully!');
    });

    map.current.on('error', (e) => console.error('MapLibre error:', e));

    // Clean up properly
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={mapContainer}
      style={{ width: '100%', height: '100vh', minHeight: '400px' }}
    />
  );
};

export default ReliableMap;
