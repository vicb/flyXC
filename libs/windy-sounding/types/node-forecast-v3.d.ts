/**
 * Main data types for node-forecast v3.0 endpoint, which serves forecast data for land points.
 * @see [NODE_FORECAST2 Documentation](./NODE_FORECAST2.md)
 */

import { Weekday } from '@windy/Calendar';
import { PointProducts } from '@windy/rootScope.d';
import { Hours, ISODateString, NumValue, Timestamp, type TimeRangeMs } from '@windy/types.d';

import { Celestial, IsDay } from '@windy/interfaces.d';
import type { RowIdents } from '@plugins/shared/detail-render/classes/Row';

export const enum WeatherConditionIcon {
    Clear = 1,
    MostlyClear = 2,
    PartlyCloudy = 3,
    Overcast = 4,
    MostlyClearRain = 5,
    PartlyCloudyRain = 6,
    OvercastRain = 7,
    MostlyClearSnow = 8,
    PartlyCloudySnow = 9,
    OvercastSnow = 10,
    MostlyClearRainWithSnow = 11,
    PartlyCloudyRainWithSnow = 12,
    OvercastRainWithSnow = 13,
    OvercastThunderstormRain = 14,
    OvercastThunderstormSnow = 15,
    OvercastThunderstormRainWithSnow = 16,
    Fog = 17,
    MostlyClearShowers = 18,
    PartlyCloudyShowers = 19,
    OvercastShowers = 20,
    PartlyCloudyThunderstormRain = 21,
    ClearFog = 22,
    ThunderstormOvercast = 23,
    ThunderstormPartlyCloudy = 24,
}

export const enum MoonPhase {
    NewMoon = 1,
    WaxingCrescent = 2,
    FirstQuarter = 3,
    WaxingGibbous = 4,
    FullMoon = 5,
    WaningGibbous = 6,
    LastQuarter = 7,
    WaningCrescent = 8,
}

export const enum PrecipitationType {
    None = 0,
    Rain = 1,
    FreezingRain = 2,
    MixedIce = 3,
    Snow = 4,
    WetSnow = 5,
    RainWithSnow = 6,
}

export type WindyMeteogramLevels =
    | 'surface'
    | '950h'
    | '925h'
    | '900h'
    | '850h'
    | '800h'
    | '700h'
    | '600h'
    | '500h'
    | '400h'
    | '300h'
    | '200h'
    | '150h'
    | '1000h';

export type MLMMeteogramLevels =
    | 'surface'
    | '1060h'
    | '1040h'
    | '1020h'
    | '1000h'
    | '980h'
    | '975h'
    | '960h'
    | '950h'
    | '940h'
    | '925h'
    | '920h'
    | '900h'
    | '880h'
    | '875h'
    | '860h'
    | '850h'
    | '840h'
    | '820h'
    | '800h'
    | '780h'
    | '760h'
    | '750h'
    | '740h'
    | '720h'
    | '700h'
    | '680h'
    | '660h'
    | '650h'
    | '640h'
    | '620h'
    | '600h'
    | '580h'
    | '560h'
    | '550h'
    | '540h'
    | '520h'
    | '500h'
    | '480h'
    | '460h'
    | '450h'
    | '440h'
    | '420h'
    | '400h'
    | '380h'
    | '360h'
    | '350h'
    | '340h'
    | '320h'
    | '300h'
    | '280h'
    | '260h'
    | '250h'
    | '240h'
    | '220h'
    | '200h'
    | '180h'
    | '160h'
    | '150h'
    | '140h';

export type AnyMeteogramLevels = WindyMeteogramLevels | MLMMeteogramLevels;

/**
 * node-forecast2 debug data
 */
export interface NodeForecastDebugData {
    /**
     * Source of served data.
     */
    cache: 'direct' | 'nearbyHit' | 'proximityHit' | 'miss';

    /**
     * How fast the MLM BE is (if applicable)
     */
    mlmResponseTime?: TimeRangeMs;
}

/**
 * node-forecast2 header object
 */
export interface NodeForecastHeader2 {
    /**
     * Levels available for rendering of airgram and meteogram
     */
    availableLevels: (WindyMeteogramLevels | MLMMeteogramLevels)[];

    /**
     * UTC offset used in this forecast
     */
    utcOffset: number;

    /**
     * At the selected point a sea forecast is also available, so we can display waves data
     */
    hasWaves: boolean;

    /**
     * Number of available days in this model
     */
    daysAvail: number;

    /**
     * Served model (important if we query a default model, that can return MLM or other model)
     */
    model: PointProducts;

    /**
     * Update time of weather model (undefined for MLM responses)
     */
    update?: ISODateString;

    /**
     * Reference time
     */
    refTime?: ISODateString;

    /**
     * Elevation above sea level (in meters)
     */
    elevation: number;

    /**
     * If defined, resulted data table consist of two merged models together
     */
    merged?: {
        /**
         * Which model was merged with previous
         * Although some ident is provided it IS NOT a model identifier, we use in client
         */
        mergedModel: string;

        /**
         * Human readable merged model name
         */
        mergedModelName: string;

        /**
         * A time where the merged model starts
         */
        mergedModelStart: ISODateString;

        /**
         * Index at which the merged model starts in resulted data arrays
         * (so we can mark them, split them or remove them
         */
        mergedModelStartIndex: number;
    };

    /**
     * Elevation of model grid (if applicable)
     */
    modelElevation?: number;

    /**
     * Surface sea temperature (if applicable) in K
     */
    sst?: number;
}

export interface TimedData {
    /**
     * Timestamp of the beginning of segment
     */
    ts: Timestamp[];
}

/**
 * Common data props, to display detail forecast no matter of sea/land/air etc
 */
export interface CommonDataProps extends IsDay, TimedData {
    /**
     * Local time Hour of day (0-23) for each time step
     */
    hour: Hours[];
}

/**
 * Main data object returned by node-forecast2 endpoint for land forecast
 */
export interface DataHash2 extends CommonDataProps {
    /**
     * Weather condition icon code for each time step
     */
    icon: WeatherConditionIcon[];

    /**
     * Moon phase code for each time step
     */
    moonPhase: MoonPhase[];

    /**
     * Total amount of precipitation (in mm) for each time step (which is either 1h or 3h).
     */
    precipAmount: NumValue[];

    /**
     * Total amount of precipitation of snow (in mm) for each time step (which is either 1h or 3h)
     */
    precipSnowAmount: NumValue[];

    /**
     * Total amount of convective precipitation (in mm) for each time step (which is either 1h or 3h)
     */
    precipConvectiveAmount: NumValue[];

    /**
     * Type of precipitation for each time step, encoded as a bitmask with the following values:
     */
    precipType: PrecipitationType[];

    /**
     * Temp in K
     */
    temperature: NumValue[];

    /**
     * Apparent temperature in K
     */
    feelTemperature: NumValue[];

    /**
     * Wind force in m/s
     */
    wind: NumValue[];

    /**
     * Wind gusts in m/s
     */
    windGust: NumValue[];

    /**
     * Wind direction in degrees (true, not magnetic)
     */
    windDir: NumValue[];

    /**
     * Surface air pressure in Pa
     */
    pressure: NumValue[];
}

export interface PollenDataHash2 {
    /**
     * Concentration of Alder pollen.
     */
    pollenAlder?: NumValue[];
    /**
     * Concentration of Birch pollen.
     */
    pollenBirch?: NumValue[];
    /**
     * Concentration of Grass pollen.
     */
    pollenGrass?: NumValue[];
    /**
     * Concentration of Mugwort pollen.
     */
    pollenMugwort?: NumValue[];
    /**
     * Concentration of Olive pollen.
     */
    pollenOlive?: NumValue[];
    /**
     * Concentration of Ragweed pollen.
     */
    pollenRagweed?: NumValue[];
}

export interface AirQDataHash2 extends CommonDataProps, PollenDataHash2 {
    /**
     * Timestamp of beginning of segment
     */
    ts: Timestamp[];

    /**
     * Local Time hour for given place in 24h format
     */
    hour: Hours[];

    /**
     * CAMS airq properties
     */
    aqiUs: NumValue[];
    /**
     * Concentration of carbon monoxide (CO) in the air.
     */
    chemsCosc: NumValue[];
    /**
     * Concentration of dust particles (coarse particulate matter) in the air.
     */
    chemsDustsm: NumValue[];
    /**
     * Concentration of sulfur dioxide (SO2) in the air.
     */
    chemsSo2sm: NumValue[];
    /**
     * Ground-level ozone (O3) concentration.
     */
    go3: NumValue[];
    /**
     * Nitrogen dioxide (NO2) concentration.
     */
    no2: NumValue[];
    /**
     * Particulate matter with a diameter of 10 micrometers or less.
     */
    pm10: NumValue[];
    /**
     * Particulate matter with a diameter of 2.5 micrometers or less.
     */
    pm2p5: NumValue[];
}

/**
 * A data object that enhances regular DataHash with properties needed for meteogram rendering.
 */
export type MeteogramDataHash2 = TimedData & {
    /**
     * DewPoint in K
     */
    dewPoint: NumValue[];

    /**
     * Cloud base in meters (if available).
     */
    cloudBase?: NumValue[];
} & {
    /**
     * Cloudiness as 0 - 100 value at each pressure level
     */
    [K in AnyMeteogramLevels as `cloud-${K}`]: NumValue[];
} & {
    /**
     * Geopotential height in meters at each pressure level
     */
    [K in AnyMeteogramLevels as `gh-${K}`]: NumValue[];
};

/**
 * A data object that can be used to render Airgram
 */
export type AirgramDataHash2 = TimedData & {
    /**
     * Temperature at each pressure level in K
     */
    [K in AnyMeteogramLevels as `temp-${K}`]: NumValue[];
} & {
    /**
     * Wind force at each pressure level in m/s
     */
    [K in AnyMeteogramLevels as `wind-${K}`]: NumValue[];
} & {
    /**
     * Wind direction (true, not magnetic) at each pressure level in degrees
     */
    [K in AnyMeteogramLevels as `windDir-${K}`]: NumValue[];
};

export type SoundingDataHash2 = MeteogramDataHash2 &
    AirgramDataHash2 & {
        /**
         * Relative humidity at each pressure level in %
         */
        [K in AnyMeteogramLevels as `rh-${K}`]: NumValue[];
    } & {
        /**
         * Dew point at each pressure level in K
         */
        [K in AnyMeteogramLevels as `dewPoint-${K}`]: NumValue[];
    };

export type WavesDataHash2 = DataHash2 & {
    waves: NumValue[];
    wavesDir: NumValue[];
    wavesPeriod: NumValue[];
    wavesPower: NumValue[];

    swell?: NumValue[];
    swellDir?: NumValue[];
    swellPeriod?: NumValue[];

    swell1: NumValue[];
    swell1Dir: NumValue[];
    swell1Period: NumValue[];

    swell2: NumValue[];
    swell2Dir: NumValue[];
    swell2Period: NumValue[];
};

/**
 * Summary of day of a forecast
 */
export interface SummaryDay2 {
    /**
     * Day of the month (starting with 1)
     */
    day: number;

    /**
     * Timestamp of midnight when the segment starts
     */
    timestamp: Timestamp;

    /**
     * Translation string for weekday
     */
    weekday: Weekday;

    /**
     * Weather icon identifier
     */
    icon: WeatherConditionIcon;

    /**
     * At which index, in the data table, the day starts
     */
    index: number;

    /**
     * How many segments, in the data table, the forecast has
     */
    segments: number;

    /**
     * Max temp in K
     */
    tempMax: NumValue;

    /**
     * Min temp in K
     */
    tempMin: NumValue;
}

/**
 * Summary enhanced with predictability for the day
 */
export interface SummaryDayWithPredictability extends SummaryDay2 {
    /**
     * Predictability of the day, in percentage (0-100) if availa
     */
    predictability?: NumValue;
}

type MergedModelProp = {
    /**
     * Marks merged model start in data arrays, so we can split them, mark them or remove them
     */
    [K in RowIdents as `${K}:mergedModelName`]?: (null | string)[];
};

/**
 * node-forecast2 returned data payload
 */
export interface WeatherDataPayload2<
    K extends DataHash2 | AirQDataHash2 | WavesDataHash2 = DataHash2,
> {
    /**
     * Always included, main data object with time series data
     */
    data: K & MergedModelProp;

    /**
     * All these props are optionally included, depending on `include` query parameter
     */
    debug?: NodeForecastDebugData;
    header: NodeForecastHeader2;
    celestial: Celestial;
    summary: SummaryDayWithPredictability[];
    meteogram?: MeteogramDataHash2;
    airgram?: AirgramDataHash2;
    sounding?: SoundingDataHash2;
}

/**
 * A data object used to render small 5 days weather fragment
 */
export interface DataFragment extends TimedData {
    /**
     * Total amount of precipitation (in mm) for each time step (which is either 1h or 3h).
     */
    precipAmount: NumValue[];

    /**
     * Total amount of precipitation of snow (in mm) for each time step (which is either 1h or 3h)
     */
    precipSnowAmount: NumValue[];

    /**
     * Total amount of convective precipitation (in mm) for each time step (which is either 1h or 3h)
     */
    precipConvectiveAmount: NumValue[];

    /**
     * Temp in K
     */
    temperature: NumValue[];

    /**
     * Wind force in m/s
     */
    wind: NumValue[];
}

/**
 * Weather nowcasting data returned by node-forecast2 endpoint
 */
export interface WeatherNow {
    /**
     * Name of model that served nowcasting data.
     */
    providedBy: PointProducts;

    /**
     * Weather condition icon code for each time step
     */
    icon: WeatherConditionIcon;

    /**
     * Total amount of precipitation (in mm/h) for each time step (which is either 1h or 3h).
     */
    precipAmount: NumValue;

    /**
     * Total amount of precipitation of snow (in mm/h) for each time step (which is either 1h or 3h)
     */
    precipSnowAmount: NumValue;

    /**
     * Total amount of convective precipitation (in mm/h) for each time step (which is either 1h or 3h)
     */
    precipConvectiveAmount: NumValue;

    /**
     * Temp in K
     */
    temperature: NumValue;

    /**
     * Wind force in m/s
     */
    wind: NumValue;

    /**
     * Wind gusts in m/s
     */
    windGust: NumValue;

    /**
     * Wind direction in degrees (true, not magnetic)
     */
    windDir: NumValue;

    /**
     * DewPoint in K
     */
    dewPoint: NumValue;

    /**
     * Surface air pressure in Pa
     */
    pressure: NumValue;

    /**
     * Surface visibility in meters
     */
    visibility: NumValue;

    /**
     * Cloud base in meters, if applicable.
     */
    cloudBase: NumValue;

    /**
     * Feeling temperature in K
     */
    feelTemperature?: NumValue;

    /**
     * Moon phase code
     */
    moonPhase: MoonPhase;

    /**
     * Is it day at the moment of observation
     */
    isDay: boolean;
}

/**
 * node-forecast2 returned data payload for fragment
 */
export interface FragmentDataPayload {
    /**
     * Always included, main data object with time series data
     */
    data: DataFragment;

    /**
     * All these props are optionally included, depending on `include` query parameter
     * yet we mark them as always included for simplicity of typing
     */
    summary: SummaryDay2[];
    debug: NodeForecastDebugData;
    header: NodeForecastHeader2;
    now: WeatherNow;
}

/**
 * node-forecast2 returned data payload for weather now
 */
export interface NowcastDataPayload {
    debug?: NodeForecastDebugData;
    header: NodeForecastHeader2;
    now: WeatherNow;
}

export type DataAndMeteogramHash2 = DataHash2 & MeteogramDataHash2;

/**
 * All combinations of possible data hashes together
 */
export type AllPossibleDataHashes2 =
    | DataHash2
    | AirQDataHash2
    | DataAndMeteogramHash2
    | WavesDataHash2
    | (DataAndMeteogramHash2 & AirgramDataHash2);

/**
 * A new object indicating which props should be insluded in paylod of v3.0 API endpoint
 */
export type IncludeInQueryString = {
    header?: boolean;
    celestial?: boolean;
    meteogram?: boolean;
    summary?: boolean;
    debug?: boolean;
    airgram?: boolean;
    sounding?: boolean;
};

/**
 * A new object indicating which props should be insluded in paylod of v3.0 API endpoint
 */
export type IncludeInFragmentQueryString = {
    header?: boolean;
    summary?: boolean;
    debug?: boolean;
    now?: boolean;
};
