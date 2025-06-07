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
}
class PositionLayer {
  #color: string;

  constructor({ color }: PositionLayerProps) {
    this.#color = color;
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

  #getIconFeature(position:Array<number>) {
    const iconFeature = new Feature({
      geometry: new Point([...position]),
    });
    iconFeature.setStyle(this.#getIconStyle());
    return iconFeature;
  }
  
  getPositionLayer(position:Array<number>) {
    const iconFeature = this.#getIconFeature(position);
    const vectorSource = new VectorSource({
      features: [iconFeature],
    });
    return new VectorLayer({
      source: vectorSource,
    });
  }
}

export default PositionLayer;