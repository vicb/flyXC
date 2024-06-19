import { setModelName, SUPPORTED_MODEL_PREFIXES } from '../actions/sounding';
import { getStore } from '../util/store.js';
import { PureComponent } from './pure.js';

const windyStore = W.store;
const windyUtils = W.utils;
const windyModels = W.models;

function label(favorite: any) {
  return favorite.title || favorite.name;
}

function handleFavoriteChanged(e: any, onSelected: any) {
  if (e.target.value) {
    const [lat, lon] = e.target.value.split('#').map((str: any) => Number(str));
    onSelected({ lat, lon }, e);
  }
}

function handleModelChanged(name: any) {
  getStore().dispatch(setModelName(name));
  windyStore.set('product', name);
}

export class Favorites extends PureComponent {
  render({ favorites, location, isMobile, onSelected }: any) {
    favorites.sort((a: any, b: any) => (label(a) > label(b) ? 1 : -1));

    if (isMobile) {
      const currentModel = windyStore.get('product');
      const models = windyModels
        .getAllPointProducts(windyUtils.str2latLon(location))
        .filter((model: any) => SUPPORTED_MODEL_PREFIXES.some((prefix) => model.startsWith(prefix)));

      models.sort();

      return (
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px">
          <select
            id="wsp-select-fav"
            onChange={(e: any) => handleFavoriteChanged(e, onSelected)}
            style="max-width: 60%"
          >
            <option>Pick a favorite</option>
            {favorites.map((f: any) => {
              return (
                <option value={`${f.lat}#${f.lon}`} selected={windyUtils.latLon2str(f) == location}>
                  {label(f)}
                </option>
              );
            })}
          </select>
          <select
            id="wsp-select-model"
            onChange={(e: any) => handleModelChanged(e.target.value)}
            style="max-width: 35%"
          >
            {models.map((p: any) => {
              return (
                <option value={p} selected={p == currentModel}>
                  {p}
                </option>
              );
            })}
          </select>
        </div>
      );
    }

    if (favorites.length == 0) {
      return (
        <div id="fly-to" className="size-s">
          <span data-icon="m">Add favorites to enable fly to.</span>
        </div>
      );
    }

    return (
      <div id="fly-to" className="size-s">
        {favorites.map((f: any) => {
          return (
            <span
              className={'location' + (windyUtils.latLon2str(f) == location ? ' selected' : '')}
              onClick={(e: any) => onSelected(f, e)}
            >
              {label(f)}
            </span>
          );
        })}
      </div>
    );
  }
}
