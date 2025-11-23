import { useEffect } from "react";
import { User } from "../../components/MapViewGl/MapViewGl";
import type { Feature, Geometry, GeoJsonProperties, Polygon, FeatureCollection } from 'geojson';

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

interface UpdatePlaneProps{
    newPlane: User | undefined,
    planesList: React.RefObject<Feature<Geometry, GeoJsonProperties>[]>,
    map: React.RefObject<maplibregl.Map | null>,
    planesGEO: React.RefObject<FeatureCollection<Geometry, GeoJsonProperties>>
}
export const useUpdatePlane = ({newPlane, planesList, map, planesGEO}: UpdatePlaneProps) =>{
      useEffect(() => {
    if (!newPlane) return;
    const existingPlane: Feature<Geometry, GeoJsonProperties> | undefined =
      planesList.current.find((feature) => feature.properties?.id === newPlane.id);

    console.log(planesList);
    if (existingPlane) {
      const bearing = bearingBetweenPoints(newPlane.coords, [200, 200]);
      const newPLaneGeometry: Geometry = {
        type: 'Polygon',
        coordinates: [
          buildPyramidPolygon(
            newPlane.coords,
            bearing,
            newPlane.sizeMeters,
            newPlane.sizeMeters,
          ),
        ],
      };
      existingPlane.geometry = newPLaneGeometry;
    } else {
      const bearing = 50; //bearingBetweenPoints(plane.coords, [200, 200]);
      const newFeature = {
        type: 'Feature',
        properties: {
          id: newPlane.id,
          name: newPlane.name,
          color: newPlane.color,
          height: newPlane.heightMeters - newPlane.sizeMeters + 300,
          base: newPlane.heightMeters - newPlane.sizeMeters,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            buildPyramidPolygon(
              newPlane.coords,
              bearing,
              newPlane.sizeMeters,
              newPlane.sizeMeters,
            ),
          ],
        },
      } as Feature<Polygon, any>;
      planesList.current.push(newFeature);
      //pyramidGeoJSON.features.push(newFeature);
    }
    const source = map.current!.getSource(
      'pyramids',
    ) as maplibregl.GeoJSONSource;
    if (planesGEO?.current && source)
      source.setData(planesGEO.current);

  }, [newPlane]);
}