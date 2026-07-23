import type { LatLon } from '@windy/interfaces.d';
import type { WebcamArchiveInterval, WebcamImageSize } from '@windy/webcams';
/**
 * Returns URL for webcam detail by id
 *
 * @param id Webcam id
 * @returns URL for getting the webcam
 * @ignore
 */
export declare const getWebcamDetailUrl: (id: string | number, imageSize: WebcamImageSize) => string;
/**
 * Returns URL for webcam list nearby lat and lon
 *
 * @param latLon Object with `lat` and `lon` properties
 * @returns URL for getting list of webcams nearby lat and lon
 * @ignore
 */
export declare const getWebcamsListUrl: <
  T extends LatLon & {
    limit?: number;
  },
>(
  { lat, lon, limit }: T,
  imageSize?: WebcamImageSize,
) => string;
/**
 * Returns URL for webcam archive by id
 *
 * @param id Webcam id
 * @param imageSize Size of the webcam image in archive
 * @param archiveType Type of the webcam archive (day, month, year, lifetime)
 * @returns URL for getting webcam archive
 * @ignore
 */
export declare const getWebcamArchiveUrl: (
  id: string | number,
  imageSize: WebcamImageSize,
  archiveType: WebcamArchiveInterval,
) => string;
/**
 * Returns URL for webcam hourly archive by id
 * All images are in 'thumbnail' size
 *
 * @param id Webcam id
 * @returns URL for getting webcam hourly archive
 * @ignore
 */
export declare const getWebcamHourlyArchiveUrl: (id: string | number) => string;
/**
 * Returns URL for webcam metric. It increases counter for the ID on backend.
 *
 * @param id Webcam id
 * @returns URL for ping webcam metrics
 * @ignore
 */
export declare const getWebcamMetricsUrl: (id: string | number) => string;
