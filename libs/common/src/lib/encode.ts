/**
 * Encode/Decode protobuf format.
 * Code from ol/format/Polyline (https://github.com/openlayers/openlayers)
 */

/**
 * Encode a list of n-dimensional points and return an encoded string
 *
 * Attention: This function will modify the passed array!
 *
 * @param {Array<number>} numbers A list of n-dimensional points.
 * @param {number} stride The number of dimension of the points in the list.
 * @param {number} [factor] The factor by which the numbers will be
 *     multiplied. The remaining decimal places will get rounded away.
 *     Default is `1e5`.
 * @return {string} The encoded string.
 * @api
 */
export function encodeDeltas(numbers: number[], stride: number, factor = 1e5): string {
  let d;

  const lastNumbers = new Array(stride);
  for (d = 0; d < stride; ++d) {
    lastNumbers[d] = 0;
  }

  for (let i = 0, ii = numbers.length; i < ii; ) {
    for (d = 0; d < stride; ++d, ++i) {
      const num = numbers[i];
      const delta = num - lastNumbers[d];
      lastNumbers[d] = num;

      numbers[i] = delta;
    }
  }

  return encodeFloats(numbers, factor);
}

/**
 * Decode a list of n-dimensional points from an encoded string
 *
 * @param {string} encoded An encoded string.
 * @param {number} stride The number of dimension of the points in the
 *     encoded string.
 * @param {number} [factor] The factor by which the resulting numbers will
 *     be divided. Default is `1e5`.
 * @return {Array<number>} A list of n-dimensional points.
 * @api
 */
export function decodeDeltas(encoded: string, stride: number, factor = 1e5): number[] {
  let d;

  /** @type {Array<number>} */
  const lastNumbers = new Array(stride);
  for (d = 0; d < stride; ++d) {
    lastNumbers[d] = 0;
  }

  const numbers = decodeFloats(encoded, factor);

  for (let i = 0, ii = numbers.length; i < ii; ) {
    for (d = 0; d < stride; ++d, ++i) {
      lastNumbers[d] += numbers[i];

      numbers[i] = lastNumbers[d];
    }
  }

  return numbers;
}

/**
 * Encode a list of floating point numbers and return an encoded string
 *
 * Attention: This function will modify the passed array!
 *
 * @param {Array<number>} numbers A list of floating point numbers.
 * @param {number} [factor] The factor by which the numbers will be
 *     multiplied. The remaining decimal places will get rounded away.
 *     Default is `1e5`.
 * @return {string} The encoded string.
 * @api
 */
export function encodeFloats(numbers: number[], factor: number): string {
  factor = factor ? factor : 1e5;
  for (let i = 0, ii = numbers.length; i < ii; ++i) {
    numbers[i] = Math.round(numbers[i] * factor);
  }

  return encodeSignedIntegers(numbers);
}

/**
 * Decode a list of floating point numbers from an encoded string
 *
 * @param {string} encoded An encoded string.
 * @param {number} [factor] The factor by which the result will be divided.
 *     Default is `1e5`.
 * @return {Array<number>} A list of floating point numbers.
 * @api
 */
export function decodeFloats(encoded: string, factor: number): number[] {
  factor = factor ? factor : 1e5;
  const numbers = decodeSignedIntegers(encoded);
  for (let i = 0, ii = numbers.length; i < ii; ++i) {
    numbers[i] /= factor;
  }
  return numbers;
}

/**
 * Encode a list of signed integers and return an encoded string
 *
 * Attention: This function will modify the passed array!
 *
 * @param {Array<number>} numbers A list of signed integers.
 * @return {string} The encoded string.
 */
export function encodeSignedIntegers(numbers: number[]): string {
  for (let i = 0, ii = numbers.length; i < ii; ++i) {
    const num = numbers[i];
    numbers[i] = num < 0 ? ~(num << 1) : num << 1;
  }
  return encodeUnsignedIntegers(numbers);
}

/**
 * Decode a list of signed integers from an encoded string
 *
 * @param {string} encoded An encoded string.
 * @return {Array<number>} A list of signed integers.
 */
export function decodeSignedIntegers(encoded: string): number[] {
  const numbers = decodeUnsignedIntegers(encoded);
  for (let i = 0, ii = numbers.length; i < ii; ++i) {
    const num = numbers[i];
    numbers[i] = num & 1 ? ~(num >> 1) : num >> 1;
  }
  return numbers;
}

/**
 * Encode a list of unsigned integers and return an encoded string
 *
 * @param {Array<number>} numbers A list of unsigned integers.
 * @return {string} The encoded string.
 */
export function encodeUnsignedIntegers(numbers: number[]): string {
  let encoded = '';
  for (let i = 0, ii = numbers.length; i < ii; ++i) {
    encoded += encodeUnsignedInteger(numbers[i]);
  }
  return encoded;
}

/**
 * Decode a list of unsigned integers from an encoded string
 *
 * @param {string} encoded An encoded string.
 * @return {Array<number>} A list of unsigned integers.
 */
export function decodeUnsignedIntegers(encoded: string): number[] {
  const numbers = [];
  let current = 0;
  let shift = 0;
  for (let i = 0, ii = encoded.length; i < ii; ++i) {
    const b = encoded.charCodeAt(i) - 63;
    current |= (b & 0x1f) << shift;
    if (b < 0x20) {
      numbers.push(current);
      current = 0;
      shift = 0;
    } else {
      shift += 5;
    }
  }
  return numbers;
}

/**
 * Encode one single unsigned integer and return an encoded string
 *
 * @param {number} num Unsigned integer that should be encoded.
 * @return {string} The encoded string.
 */
export function encodeUnsignedInteger(num: number): string {
  let value,
    encoded = '';
  while (num >= 0x20) {
    value = (0x20 | (num & 0x1f)) + 63;
    encoded += String.fromCharCode(value);
    num >>= 5;
  }
  value = num + 63;
  encoded += String.fromCharCode(value);
  return encoded;
}
