import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { GeolocateControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Feature, Polygon } from 'geojson';
import useSocketConnect from '../../hooks/Socket/useSocketConnect';
import type { Geometry, GeoJsonProperties } from 'geojson';
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
export type User = {
  id: string;
  name: string;
  coords: [number, number];
  color: string;
  sizeMeters: number;
  heightMeters: number;
};

const ReliableMap = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [users, setUsers] = useState<User[]>([
    // initial users
    {
      id: 'alice',
      name: 'Alice',
      coords: [12.4964, 41.9028],
      color: '#FF6A00',
      sizeMeters: 30,
      heightMeters: 90,
    },
  ]);
  const [plane, setPlane] = useState<User>();
  const updateUser = useCallback((newUser: User) => {
    setUsers((prev) => {
      const exists = prev.find((u) => u.id === newUser.id);
      if (exists) {
        return prev.map((u) => (u.id === newUser.id ? newUser : u));
      } else {
        return [...prev, newUser];
      }
    });
  }, []);
  const [userFeatures, setUserFeatures] = useState<
    Feature<Geometry, GeoJsonProperties>[]
  >([]);

  const fts = useRef<Feature<Geometry, GeoJsonProperties>[]>([]);

  const pyramidGeoJSON = useRef<FeatureCollection>({
    type: 'FeatureCollection' as const,
    features: fts.current,
    /*users.map((user, idx) => {
          const center = user.coords;
          const next = users[(idx + 1) % users.length]?.coords || center;
          const bearing = bearingBetweenPoints(center, next);

          return {
            type: 'Feature',
            properties: {
              id: user.id,
              name: user.name,
              color: user.color,
              height: user.heightMeters - user.sizeMeters + 300,
              base: user.heightMeters - user.sizeMeters,
            },
            geometry: {
              type: 'Polygon',
              coordinates: [
                buildPyramidPolygon(
                  center,
                  bearing,
                  user.sizeMeters,
                  user.sizeMeters,
                ),
              ],
            },
          } as Feature<Polygon, any>;
        }),*/
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

  // Example users: each has coords and optional visual properties
  /*let users = [
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
  ];*/

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
        'aws-terrain': {
          type: 'raster-dem',
          tiles: [
            'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
          ],
          maxzoom: 18,
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

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: [-3.436, 55.3781],
      zoom: 5.3,
      pitch: 55,
      bearing: -10,
      maxPitch: 65,
      maxZoom: 18,
      minZoom: 2,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(
      new maplibregl.TerrainControl({
        source: 'aws-terrain',
        exaggeration: 6,
      }),
    );
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

      updateUser({
        id: 'rk',
        name: 'ROKAS',
        coords, // important: [lon, lat] array
        color: '#32D74B',
        sizeMeters: 5,
        heightMeters: 80,
      });

      console.log('Updated user coordinates:', coords);
    });

    map.current.on('load', () => {
      // Compose a multi-feature GeoJSON: one polygon per use

      // Extrusion layer: use 'fill-extrusion' with per-fe
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
        //geolocate.trigger();
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

  useEffect(() => {
    if (!map.current) return;
    // Wait for the map to finish loading its style
    const handleLoad = () => {
      if (!map.current!.getSource('pyramids')) {
        map.current!.addSource('pyramids', {
          type: 'geojson',
          data: pyramidGeoJSON?.current,
        });
        map.current!.addLayer({
          id: 'pyramid-layer',
          type: 'fill-extrusion',
          source: 'pyramids',
          paint: {
            'fill-extrusion-base': ['get', 'base'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-opacity': 0.95,
          },
        });
      } else {
        const source = map.current!.getSource(
          'pyramids',
        ) as maplibregl.GeoJSONSource;

        if (pyramidGeoJSON.current) source.setData(pyramidGeoJSON.current);
      }
    };
    //console.log(source._data.features as maplibregl.GeoJSONFeature);
    if (map.current.loaded()) {
      handleLoad();
    } else {
      map.current.on('load', handleLoad);
    }
    // Also update whenever users change after map loaded
    return () => {
      map.current?.off('load', handleLoad);
    };
  }, []);

  useEffect(() => {
    if (!plane) return;
    const existingPlane: Feature<Geometry, GeoJsonProperties> | undefined =
      fts.current.find((feature) => feature.properties?.id === plane.id);

    console.log(fts);
    if (existingPlane) {
      const bearing = bearingBetweenPoints(plane.coords, [200, 200]);
      const newPLaneGeometry: Geometry = {
        type: 'Polygon',
        coordinates: [
          buildPyramidPolygon(
            plane.coords,
            bearing,
            plane.sizeMeters,
            plane.sizeMeters,
          ),
        ],
      };
      existingPlane.geometry = newPLaneGeometry;
    } else {
      const bearing = 50; //bearingBetweenPoints(plane.coords, [200, 200]);
      const newFeature = {
        type: 'Feature',
        properties: {
          id: plane.id,
          name: plane.name,
          color: plane.color,
          height: plane.heightMeters - plane.sizeMeters + 300,
          base: plane.heightMeters - plane.sizeMeters,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            buildPyramidPolygon(
              plane.coords,
              bearing,
              plane.sizeMeters,
              plane.sizeMeters,
            ),
          ],
        },
      } as Feature<Polygon, any>;
      fts.current.push(newFeature);
      //pyramidGeoJSON.features.push(newFeature);
    }
    const source = map.current!.getSource(
      'pyramids',
    ) as maplibregl.GeoJSONSource;
    if (pyramidGeoJSON?.current && source)
      source.setData(pyramidGeoJSON.current);
  }, [plane]);

  return (
    <div
      ref={mapContainer}
      style={{ width: '100%', height: '100vh', minHeight: '400px' }}
    />
  );
};

export default ReliableMap;
