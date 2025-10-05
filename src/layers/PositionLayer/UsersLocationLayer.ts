import { Feature } from 'ol';
import { Geometry, LineString, Point } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import { Source } from 'ol/source';
import VectorSource from 'ol/source/Vector';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';

class UsersLocationLayer extends VectorLayer {
  #usersLocationsSource: VectorSource<Feature<any>>;
  #usersLocationLayer: VectorLayer;
  constructor() {
    super();
    this.#usersLocationsSource = new VectorSource();
    this.#usersLocationLayer = new VectorLayer({
      source: this.#usersLocationsSource,
    });
  }

  imageUrl = () => {
    return (
      '#' +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, '0')
    ); //thisnis for now will eba color will cahneg laters
  };

  #setPonterStyle = (color: string) => {
    return new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: color }),
        stroke: new Stroke({ color: 'white', width: 2 }),
      }),
    });
  };

  #setLineStyle = () => {
    return new Style({
      stroke: new Stroke({
        color: 'red',
        width: 3,
      }),
    });
  };

  setUserLocation = (userId: string, coords: number[], color: string) => {
    const point = new Point([...coords]);
    let feature = this.#usersLocationsSource.getFeatureById(userId);
    let lineFeature = this.#usersLocationsSource.getFeatureById(userId + 'd69');
    if(lineFeature){
      lineFeature.getGeometry()?.appendCoordinate(coords);
    }else{
      const newLineFeature = new Feature(new LineString([]));
      newLineFeature.setStyle(this.#setLineStyle());
      newLineFeature.setId(userId + 'd69');
      newLineFeature.getGeometry()?.appendCoordinate(coords);
      this.#usersLocationsSource.addFeature(newLineFeature)
    }
    if (feature) {
      feature.setGeometry(point);
    } else {
      const newFeature = new Feature({
        geometry: point,
      });
      newFeature.setStyle(this.#setPonterStyle(color));
      newFeature.setId(userId); // <-- set ID here
      this.#usersLocationsSource.addFeature(newFeature);
    }
  };

  getUsersLocationLayer = () => {
    return this.#usersLocationLayer;
  };
}

export default UsersLocationLayer;
