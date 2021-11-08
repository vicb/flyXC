import { getElevationUrl, parseElevationResponse } from 'flyxc/fetcher/src/elevation/arcgis';

describe('getElevationUrl', () => {
  it('should encode the points', () => {
    const url = new URL(
      getElevationUrl([
        { lat: 1.001, lon: 101.001 },
        { lat: 2.001, lon: 102.001 },
        { lat: -3.001, lon: -103.001 },
      ]),
    );

    const params = url.searchParams;

    expect(params.has('InputLineFeatures')).toEqual(true);

    const geometry = JSON.parse(params.get('InputLineFeatures') as string);

    expect(geometry.features[0].geometry.paths).toEqual([
      [
        [101.001, 1.001],
        [-15, -15],
        [102.001, 2.001],
        [-15, -15],
        [-103.001, -3.001],
        [-15, -15],
      ],
    ]);
  });
});

describe('parseElevationResponse', () => {
  it('parse the output', () => {
    const points = [
      { lon: -118.29, lat: 36.57 },
      { lon: 6.86, lat: 45.83 },
    ];

    const output = {
      results: [
        {
          paramName: 'OutputProfile',
          dataType: 'GPFeatureRecordSetLayer',
          value: {
            displayFieldName: '',
            hasZ: true,
            geometryType: 'esriGeometryPolyline',
            spatialReference: {
              wkid: 4326,
              latestWkid: 4326,
            },
            fields: [],
            features: [
              {
                attributes: {},
                geometry: {
                  hasZ: true,
                  paths: [
                    [
                      [-118.29256296157814, 36.578299473962772, 4400.2636000000057],
                      [-15, -15, 0],
                      [6.8651783474269337, 45.832679109920036, 4785.0957999999955],
                      [-15, -15, 0],
                    ],
                  ],
                },
              },
            ],
            exceededTransferLimit: false,
          },
        },
      ],
      messages: [],
    };

    expect(parseElevationResponse(output, points)).toEqual([4400, 4785]);
  });

  it('throws if the output location does not match the input', () => {
    const points = [
      { lon: -118.29, lat: 36.57 },
      { lon: 6.86, lat: 45.83 },
    ];

    const output = {
      results: [
        {
          paramName: 'OutputProfile',
          dataType: 'GPFeatureRecordSetLayer',
          value: {
            displayFieldName: '',
            hasZ: true,
            geometryType: 'esriGeometryPolyline',
            spatialReference: {
              wkid: 4326,
              latestWkid: 4326,
            },
            fields: [],
            features: [
              {
                attributes: {},
                geometry: {
                  hasZ: true,
                  paths: [
                    [
                      [-118.29256296157814, 36.578299473962772, 4400.2636000000057],
                      [-15, -15, 0],
                      [5.8651783474269337, 45.832679109920036, 4785.0957999999955],
                      [-15, -15, 0],
                    ],
                  ],
                },
              },
            ],
            exceededTransferLimit: false,
          },
        },
      ],
      messages: [],
    };

    expect(() => parseElevationResponse(output, points)).toThrow('Invalid response');
  });
});
