/**
 * Preprocessor `#define` flags that are dynamically injected into the
 * tile-layer fragment shaders via the `#pragma tileLayer_defines` placeholder.
 *
 * Each flag controls a compile-time branch (`#ifdef`) in shaders such as
 * `tileLayerPreprocess.frag`. The set of active defines is determined
 * per-layer by `getDefines()` / `getMultiShaderDefines()` in
 * `TileLayerPreprocessorStandalone.ts`.
 *
 * @see {@link src/shaders/webgl1/tileLayerPreprocess.frag}
 * @see {@link src/tileCache/TileLayerPreprocessorStandalone.ts}
 */
export type ShaderDefine =
    /**
     * Enable bicubic (Hermite) interpolation using a 4×4 (16-tap) kernel
     * instead of the default bilinear 2×2 sampling. Produces smoother
     * gradients at the cost of additional texture lookups.
     */
    | 'BICUBIC'
    /**
     * Use the **blue channel** (`s.b`) for the bicubic interpolation pass
     * instead of the default red channel. This is required for wave-related
     * layers (e.g. swell, sea) where the meaningful scalar is encoded in
     * the blue channel of the data tile.
     */
    | 'USE_BLUE_CHANNEL'
    /**
     * Apply **bilinear** interpolation to the alpha / transparency mask
     * instead of the default nearest-neighbour (min/max) approach. This
     * gives smoother edges at tile-data boundaries at the risk of slight
     * bleeding.
     */
    | 'BILINEAR_ALPHA'
    /**
     * Activate the **cloud-cover-level** (CCL) pattern-overlay logic.
     * The green channel is decoded into discrete cloud-type categories
     * which are then used to mask pattern textures, producing hatching /
     * stipple effects on top of the base gradient colour.
     * Requires `PATT` to also be defined.
     */
    | 'CCL'
    /**
     * Enable the **cloud** rendering path. A secondary gradient texture
     * (`u_channel3`) is sampled and composited over the base colour using
     * a pattern-based alpha test, producing the characteristic cloud
     * overlay appearance. Requires `PATT` to also be defined.
     */
    | 'CLOUDS'
    /**
     * Apply a **logarithmic** transform to the decoded red-channel value:
     * `r = pow(2, r) + offset`. Used for layers whose source data is
     * encoded in log-space (e.g. rain accumulation via `rainLog` and
     * similar transforms).
     */
    | 'LOG'
    /**
     * **Passthrough** mode — skip the gradient-texture lookup entirely and
     * output the raw normalised data value as a greyscale pixel
     * (`vec4(v, v, v, a)`). The value is linearly mapped to [0, 1] using
     * `u_pars1.xy` (mul / add). Used by layers that need the numeric
     * value downstream (e.g. flight-danger compositing) rather than a
     * coloured visualisation.
     */
    | 'PASSTHROUGH'
    /**
     * Bind and sample the **primary pattern** texture (`u_channel4`) at
     * the pattern UV coordinates. The sampled RGBA is used by the CCL,
     * CLOUDS, and RAIN branches to create hatching / stipple effects.
     */
    | 'PATT'
    /**
     * Bind and sample the **secondary pattern** texture (`u_channel5`).
     * Currently used exclusively by the RAIN branch for a second set of
     * precipitation-type overlays (e.g. freezing rain, hail).
     */
    | 'PATT2'
    /**
     * Indicates the source data tile is a **PNG with an alpha channel**.
     * Changes how the transparency mask (`a`) is computed: alpha is
     * derived from the tile's `.a` component instead of from `.b`
     * (the default for non-PNG protobuf tiles).
     */
    | 'PNG'
    /**
     * Activate the **rain / precipitation-type** overlay logic. The green
     * channel is decoded into discrete precipitation categories (rain,
     * freezing rain, sleet, snow, hail, etc.) which are then masked with
     * both the primary (`PATT`) and secondary (`PATT2`) pattern textures,
     * tinting the base colour per category. Requires `PATT` and `PATT2`.
     */
    | 'RAIN'
    /**
     * Enable **vector-size** interpolation: the green channel is also
     * decoded and interpolated (bilinear or bicubic), then the displayed
     * gradient value is the 2-D vector magnitude `length(r, g)` instead
     * of the scalar red channel alone. Used for wind, current, and other
     * vector-field layers.
     */
    | 'VECTOR_SIZE';
