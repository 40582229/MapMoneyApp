import React, { useEffect } from 'react';
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';

interface RenderPlanesProps {
  map: React.RefObject<maplibregl.Map | null>;
  planesGEO: React.RefObject<FeatureCollection<Geometry, GeoJsonProperties>>;
}

export const useRenderPlanes = ({ map, planesGEO }: RenderPlanesProps) => {
  useEffect(() => {
    if (!map.current) return;
    // Wait for the map to finish loading its style
    const handleLoad = () => {
      if (!map.current!.getSource('pyramids')) {
        map.current!.addSource('pyramids', {
          type: 'geojson',
          data: planesGEO?.current,
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

        if (planesGEO.current) source.setData(planesGEO.current);
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
};
