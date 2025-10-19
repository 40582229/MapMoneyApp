import 'maplibre-gl';

declare module 'maplibre-gl' {
  interface MapOptions {
    /**
     * Map projection type.
     * 'mercator' is the default; 'globe' enables 3D globe view.
     */
    projection?: 'mercator' | 'globe' | any;
  }
}
