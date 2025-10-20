import { useEffect, useRef } from 'react';
import maplibregl, { GeolocateControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Feature, Point } from 'geojson';

const ReliableMap = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const users = [
    { name: 'Alice', coords: [12.4964, 41.9028] }, // Rome
    { name: 'Bob', coords: [-0.1276, 51.5074] }, // London
    { name: 'Charlie', coords: [2.3522, 48.8566] }, // Paris
  ];

  const userGeoJSON: FeatureCollection<Point, { name: string }> = {
    type: 'FeatureCollection',
    features: users.map<Feature<Point, { name: string }>>((user) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: user.coords,
      },
      properties: {
        name: user.name,
      },
    })),
  };
  useEffect(() => {
    // Prevent double initialization
    if (!mapContainer.current || map.current) return;

    const style: maplibregl.StyleSpecification = {
      version: 8,
      projection: {
        type: 'globe',
      },
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap Contributors',
          maxzoom: 13,
          minzoom: 3,
        },
        'aws-terrain': {
          type: 'raster-dem',
          tiles: [
            'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
          ],
          maxzoom: 11,
          minzoom: 8,
          encoding: 'terrarium',
          tileSize: 256,
        },
        'aws-hillshade': {
          type: 'raster-dem',
          tiles: [
            'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
          ],
          maxzoom: 11,
          minzoom: 8,
          encoding: 'terrarium',
          tileSize: 256,
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

    // Create map instance
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: [-3.436, 55.3781], // UK
      zoom: 9,
      pitch: 60,
      bearing: 0,
      maxPitch: 65,
      maxZoom: 13,
      minZoom: 3, // prevent zooming out past 2
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

    // A small base64-encoded PNG marker

    map.current.on('load', async () => {
      geolocate.trigger();
      map.current?.addSource('users', {
        type: 'geojson',
        data: userGeoJSON,
      });

      // Add a circle layer instead of a marker image
      map.current?.addLayer({
        id: 'users-layer',
        type: 'circle',
        source: 'users',
        paint: {
          'circle-radius': 6,
          'circle-color': '#007AFF',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      });
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
