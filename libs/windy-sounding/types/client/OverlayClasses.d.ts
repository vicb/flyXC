import { Overlay } from '@windy/Overlay';
import type { DirectionFunction } from '@windy/format.d';
import type { Overlays } from '@windy/rootScope.d';
import type { RGBNumValues } from '@windy/interpolatorTypes';
import type { LoadedTranslations } from '@windy/types';
export declare class CurrentOverlay<I extends Overlays = Overlays> extends Overlay<I> {
  hidePickerElevation: boolean;
  createPickerHTML(values: RGBNumValues, formatDir: DirectionFunction): string;
}
export declare class WaveOverlay<I extends Overlays = Overlays> extends Overlay<I> {
  hidePickerElevation: boolean;
  createPickerHTML(values: RGBNumValues, formatDir: DirectionFunction): string;
}
export declare class AwpOverlay<I extends Overlays = Overlays> extends Overlay<I> {
  labels: {
    [value: number]: keyof LoadedTranslations;
  };
  createPickerHTML(values: RGBNumValues): string;
}
export declare class FwiOverlay<I extends Overlays = Overlays> extends Overlay<I> {
  labels: {
    [value: number]: keyof LoadedTranslations;
  };
  createPickerHTML(values: RGBNumValues): string;
}
export declare class RainPtypeOverlay<I extends Overlays = Overlays> extends Overlay<I> {
  hidePickerElevation: boolean;
  createPickerHTML(values: RGBNumValues): string;
}
export declare class CloudsOverlay<I extends Overlays = Overlays> extends Overlay<I> {
  hidePickerElevation: boolean;
  createPickerHTML(values: RGBNumValues): string;
}
