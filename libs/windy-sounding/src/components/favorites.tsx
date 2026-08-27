import type { Fav, LatLon } from '@windy/interfaces';
import { useState } from 'preact/hooks';

import { getAvailableModels, getFavLabel, latLon2Str } from '../util/utils';

export type FavoriteProps = {
  favorites: Fav[];
  location: LatLon;
  locationLabel: string;
  isMobile: boolean;
  onSelected: (location: LatLon) => void;
  onSelectModel?: (model: string) => void;
  modelName: string;
};

export function Favorites({
  favorites,
  location,
  locationLabel,
  isMobile,
  onSelected,
  onSelectModel,
  modelName,
}: FavoriteProps) {
  const locationStr = latLon2Str(location);
  const [isModelExpanded, setIsModelExpanded] = useState(false);
  const [isLocationExpanded, setIsLocationExpanded] = useState(false);

  function toggleModelSelect() {
    const expanded = !isModelExpanded;
    if (expanded) {
      setIsLocationExpanded(false);
    }
    setIsModelExpanded(expanded);
  }

  function toggleLocationSelect() {
    const expanded = !isLocationExpanded;
    if (expanded) {
      setIsModelExpanded(false);
    }
    setIsLocationExpanded(expanded);
  }

  if (isMobile) {
    const models: string[] = getAvailableModels(location);

    return (
      <>
        <section id="wsp-favorite">
          <div
            className={`select ${isModelExpanded ? 'active' : ''}`}
            data-icon="w"
            data-icon-after="g"
            onClick={toggleModelSelect}
          >
            <small className="size-m">{W.products[modelName]?.modelName ?? modelName}</small>
          </div>
          <div
            className={`select ${isLocationExpanded ? 'active' : ''}`}
            data-icon="D"
            data-icon-after="g"
            onClick={toggleLocationSelect}
          >
            <small className="size-m">{locationLabel}</small>
          </div>
          <a style={{ margin: '0 10px 3px 5px' }} href="https://buymeacoffee.com/vic.b" target="_blank">
            ☕️
          </a>
        </section>

        {isModelExpanded && (
          <div className="options">
            {models.map((model: string) => (
              <span
                key={model}
                className={model == modelName ? 'selected' : ''}
                onClick={() => {
                  onSelectModel?.(model);
                  setIsModelExpanded(false);
                }}
              >
                {W.products[model]?.modelName ?? model}
              </span>
            ))}
          </div>
        )}

        {isLocationExpanded && (
          <div className="options">
            {favorites.length === 0 ? (
              <p>You do not have any favorites</p>
            ) : (
              favorites.map((favorite: Fav) => (
                <span
                  key={latLon2Str(favorite)}
                  className={latLon2Str(favorite) == locationStr ? 'selected' : ''}
                  onClick={() => {
                    onSelected({ lat: favorite.lat, lon: favorite.lon });
                  }}
                >
                  {getFavLabel(favorite)}
                </span>
              ))
            )}
          </div>
        )}
      </>
    );
  }

  if (favorites.length == 0) {
    return (
      <div id="wsp-flyto" className="size-m">
        <span data-icon="m" className="fg-icons"></span> Add favorites to windy to quickly check different locations.
      </div>
    );
  }

  return (
    <div id="wsp-flyto" className="size-m">
      {favorites.map((favorite: Fav) => {
        return (
          <>
            <div
              className={`button button--transparent ${latLon2Str(favorite) == locationStr ? 'selected' : ''}`}
              onClick={() => onSelected({ lat: favorite.lat, lon: favorite.lon })}
            >
              {getFavLabel(favorite)}
            </div>
          </>
        );
      })}
    </div>
  );
}
