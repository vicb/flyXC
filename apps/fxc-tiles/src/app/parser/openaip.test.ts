import { parse } from './openaip';

describe('parse', () => {
  describe('errors', () => {
    // empty
  });

  describe('airspace', () => {
    it('should parse "P14 Grenoble"', () => {
      expect(
        parse({
          _id: '64428ef30fa6f452525ea752',
          name: 'P14 GRENOBLE',
          dataIngestion: true,
          type: 3,
          icaoClass: 8,
          activity: 0,
          onDemand: false,
          onRequest: false,
          byNotam: false,
          specialAgreement: false,
          requestCompliance: false,
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [5.69, 45.22210199575141],
                [5.68939837780444, 45.22209533723523],
                [5.688797349759701, 45.22207536826249],
                // ...
                [5.69060162219556, 45.22209533723523],
                [5.69, 45.22210199575141],
              ],
            ],
          },
          country: 'FR',
          upperLimit: {
            value: 4000,
            unit: 1,
            referenceDatum: 1,
          },
          lowerLimit: {
            value: 0,
            unit: 1,
            referenceDatum: 0,
          },
          hoursOfOperation: {
            operatingHours: [
              {
                dayOfWeek: 0,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
              {
                dayOfWeek: 1,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
              {
                dayOfWeek: 2,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
              {
                dayOfWeek: 3,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
              {
                dayOfWeek: 4,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
              {
                dayOfWeek: 5,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
              {
                dayOfWeek: 6,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
            ],
          },
          createdAt: '2023-04-21T13:26:11.363Z',
          updatedAt: '2023-04-21T13:26:11.363Z',
          frequencies: [],
          createdBy: 'OPONcQnzWGOLiJSceNaf8pvx1fA2',
          updatedBy: 'OPONcQnzWGOLiJSceNaf8pvx1fA2',
        }),
      ).toMatchInlineSnapshot(`
        {
          "activity": 0,
          "country": "FR",
          "floorLabel": "GND",
          "floorM": 0,
          "floorRefGnd": true,
          "icaoClass": 8,
          "name": "P14 GRENOBLE",
          "polygon": [
            [
              [
                5.69,
                45.222102,
              ],
              [
                5.689398,
                45.222095,
              ],
              [
                5.688797,
                45.222075,
              ],
              [
                5.690602,
                45.222095,
              ],
              [
                5.69,
                45.222102,
              ],
            ],
          ],
          "topLabel": "4000ft MSL",
          "topM": 1219,
          "topRefGnd": false,
          "type": 3,
        }
      `);
    });

    it('should parse "R196A1 EST GAP (NOTAM) FANNY"', () => {
      expect(
        parse({
          _id: '64428f1d0fa6f452525ebdd7',
          name: 'R196A1 EST GAP (NOTAM) FANNY ',
          dataIngestion: true,
          type: 1,
          icaoClass: 8,
          activity: 0,
          onDemand: false,
          onRequest: false,
          byNotam: false,
          specialAgreement: false,
          requestCompliance: false,
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [5.983611111111111, 45.01555555555556],
                [5.983611111111111, 44.528888888888886],
                [5.983611111111111, 44.528888888888886],
                // ...
                [6.745555555555556, 45.010555555555555],
                [5.983611111111111, 45.01555555555556],
              ],
            ],
          },
          country: 'FR',
          upperLimit: {
            value: 195,
            unit: 6,
            referenceDatum: 2,
          },
          lowerLimit: {
            value: 3300,
            unit: 1,
            referenceDatum: 0,
          },
          frequencies: [
            {
              value: '127.975',
              primary: false,
              unit: 2,
              _id: '64428f1d0fa6f452525ebdd8',
            },
          ],

          hoursOfOperation: {
            operatingHours: [
              {
                dayOfWeek: 0,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
              {
                dayOfWeek: 1,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
              {
                dayOfWeek: 2,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
              {
                dayOfWeek: 3,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
              {
                dayOfWeek: 4,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
              {
                dayOfWeek: 5,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
              {
                dayOfWeek: 6,
                startTime: '00:00',
                endTime: '00:00',
                byNotam: false,
                sunrise: false,
                sunset: false,
                publicHolidaysExcluded: false,
              },
            ],
          },
          createdAt: '2023-04-21T13:26:53.576Z',
          updatedAt: '2023-04-21T13:26:53.576Z',
          createdBy: 'OPONcQnzWGOLiJSceNaf8pvx1fA2',
          updatedBy: 'OPONcQnzWGOLiJSceNaf8pvx1fA2',
        }),
      ).toMatchInlineSnapshot(`
        {
          "activity": 0,
          "country": "FR",
          "floorLabel": "3300ft GND",
          "floorM": 1006,
          "floorRefGnd": true,
          "icaoClass": 8,
          "name": "R196A1 EST GAP (NOTAM) FANNY ",
          "polygon": [
            [
              [
                5.983611,
                45.015556,
              ],
              [
                5.983611,
                44.528889,
              ],
              [
                5.983611,
                44.528889,
              ],
              [
                6.745556,
                45.010556,
              ],
              [
                5.983611,
                45.015556,
              ],
            ],
          ],
          "topLabel": "FL 195",
          "topM": 5944,
          "topRefGnd": false,
          "type": 1,
        }
      `);
    });
  });
});
