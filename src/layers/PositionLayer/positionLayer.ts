import { Feature } from 'ol';
import { Point } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';

export interface PositionLayerProps {
  color: string;
  position: Array<number>;
}
class PositionLayer {
  #color: string;
  #position: Array<number>;

  constructor({ color, position }: PositionLayerProps) {
    this.#color = color;
    this.#position = position;
  }

  #getIconStyle() {
    const iconStyle = new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({
          color: this.#color,
        }),
        stroke: new Stroke({
          color: '#fff',
          width: 2,
        }),
      }),
    });

    return iconStyle;
  }

  #getIconFeature() {
    const iconFeature = new Feature({
      geometry: new Point([...this.#position]),
    });
    iconFeature.setStyle(this.#getIconStyle());
    return iconFeature;
  }
  
  getPositionLayer() {
    const iconFeature = this.#getIconFeature();
    const vectorSource = new VectorSource({
      features: [iconFeature],
    });
    return new VectorLayer({
      source: vectorSource,
    });
  }
}

export default PositionLayer;