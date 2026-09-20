import { Overlay } from '@windy/Overlay';
import type { DirectionFunction } from '@windy/format.d';
import type { RGBNumValues } from '@windy/interpolatorTypes';
import type { LoadedTranslations } from '@windy/types';
export declare class CurrentOverlay extends Overlay {
    hidePickerElevation: boolean;
    createPickerHTML(values: RGBNumValues, formatDir: DirectionFunction): string;
}
export declare class WaveOverlay extends Overlay {
    hidePickerElevation: boolean;
    initProperties(): void;
    createPickerHTML(values: RGBNumValues, formatDir: DirectionFunction): string;
}
export declare class AwpOverlay extends Overlay {
    createPickerHTML(values: RGBNumValues): string;
}
export declare class FwiOverlay extends Overlay {
    createPickerHTML(values: RGBNumValues): string;
}
export declare class RainPtypeOverlay extends Overlay {
    hidePickerElevation: boolean;
    createPickerHTML(values: RGBNumValues): string;
}
export declare class CloudsOverlay extends Overlay {
    hidePickerElevation: boolean;
    createPickerHTML(values: RGBNumValues): string;
}
export declare class AqiOverlay extends Overlay {
    hidePickerElevation: boolean;
    labels: {
        [value: number]: keyof LoadedTranslations;
    };
    getAirQLabel(aqi: number): string;
    createPickerHTML(values: RGBNumValues): string;
}
export declare class RadarOverlay extends Overlay {
    hidePickerElevation: boolean;
    createPickerHTML(values: RGBNumValues): string;
    /**
     * https://kody.windy.com/windy/satellite/rs-server/-/blob/master/doc/radar.md?ref_type=heads#radar2composite201806061345342ptypepng
     * @param value - pType value encoded in 0-255 range
     */
    private categorizePrecipitationValue;
}
export declare class SatelliteOverlay extends Overlay {
    hidePickerElevation: boolean;
    createPickerHTML(values: RGBNumValues): string;
}
