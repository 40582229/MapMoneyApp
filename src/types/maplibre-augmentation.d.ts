import "maplibre-gl";

declare module "maplibre-gl" {
  interface MapOptions {
    /**
     * Map projection type.
     * 'mercator' is default; 'globe' enables 3D globe view.
     */
    projection?: "mercator" | "globe";
  }
}