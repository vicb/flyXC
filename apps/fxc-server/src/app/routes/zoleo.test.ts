import { parseMessage } from './zoleo';

describe('Valid messages', () => {
  it('should parse IMEI', () => {
    expect(
      parseMessage({
        IMEI: '123456789012345',
        partnerDeviceID: '12345678-1234-1234-1234-123456789012',
      }),
    ).toEqual({
      id: '12345678-1234-1234-1234-123456789012',
      imei: '123456789012345',
      type: 'imei',
    });
  });

  it('should parse check-in with location', () => {
    expect(
      parseMessage({
        MessageId: '2517146674703719999',
        MessageType: 'CheckIn',
        DeviceIMEI: '123456789012345',
        DeviceId: '12345678-1234-1234-1234-123456789012',
        ReceivedAtServer: '2023-06-24T19:02:40Z',
        SentFromDevice: '2023-06-24T19:02:09.628Z',
        Location: { Latitude: 12.3456789, Longitude: -23.456789 },
        Properties: { EpochMiliseconds: '1687633329628', TimeZoneId: 'Pacific Standard Time', Source: 'Satellite' },
      }),
    ).toEqual({
      altitudeM: 0,
      batteryPercent: 100,
      id: '12345678-1234-1234-1234-123456789012',
      imei: '123456789012345',
      lat: 12.34568,
      lon: -23.45679,
      message: 'Check-In',
      speedKph: 0,
      timeMs: 1687633329628,
      type: 'msg',
    });
  });

  it('should parse check-in with location with Speed, Altitude, and Battery', () => {
    expect(
      parseMessage({
        MessageId: '2517146674703719999',
        MessageType: 'CheckIn',
        DeviceIMEI: '123456789012345',
        DeviceId: '12345678-1234-1234-1234-123456789012',
        ReceivedAtServer: '2023-06-24T19:02:40Z',
        SentFromDevice: '2023-06-24T19:02:09.628Z',
        Location: { Latitude: 12.3456789, Longitude: -23.456789, Speed: 12.34, Altitude: 123 },
        Properties: {
          EpochMiliseconds: '1687633329628',
          TimeZoneId: 'Pacific Standard Time',
          Source: 'Satellite',
          Battery: '96',
        },
      }),
    ).toEqual({
      altitudeM: 123,
      batteryPercent: 96,
      id: '12345678-1234-1234-1234-123456789012',
      imei: '123456789012345',
      lat: 12.34568,
      lon: -23.45679,
      message: 'Check-In',
      speedKph: 12,
      timeMs: 1687633329628,
      type: 'msg',
    });
  });

  it('should parse check-in without location', () => {
    expect(
      parseMessage({
        MessageId: '2517146674703719999',
        MessageType: 'CheckIn',
        DeviceIMEI: '123456789012345',
        DeviceId: '12345678-1234-1234-1234-123456789012',
        ReceivedAtServer: '2023-06-24T19:02:40Z',
        SentFromDevice: '2023-06-24T19:02:09.628Z',
        Location: {},
        Properties: { EpochMiliseconds: '1687633329628', TimeZoneId: 'Pacific Standard Time', Source: 'Satellite' },
      }),
    ).toBeNull();
  });

  it('should parse location start', () => {
    expect(
      parseMessage({
        MessageId: '2517146673567929999',
        MessageType: 'LS_start',
        DeviceIMEI: '123456789012345',
        DeviceId: '12345678-1234-1234-1234-123456789012',
        ReceivedAtServer: '2023-06-24T19:04:11Z',
        SentFromDevice: '2023-06-24T19:04:03.207Z',
        Location: { Latitude: 37.38762283325195, Longitude: -122.02716333333335 },
        Properties: { EpochMiliseconds: '1687633443207', TimeZoneId: 'Pacific Standard Time', Source: 'Cellular' },
      }),
    ).toEqual({
      altitudeM: 0,
      batteryPercent: 100,
      id: '12345678-1234-1234-1234-123456789012',
      imei: '123456789012345',
      lat: 37.38762,
      lon: -122.02716,
      speedKph: 0,
      timeMs: 1687633443207,
      type: 'msg',
    });
  });

  it('should parse location updates', () => {
    expect(
      parseMessage({
        MessageId: '2517146669679839999',
        MessageType: 'LS_location',
        DeviceIMEI: '123456789012345',
        DeviceId: '12345678-1234-1234-1234-123456789012',
        ReceivedAtServer: '2023-06-24T19:10:40Z',
        SentFromDevice: '2023-06-24T19:10:32.016Z',
        Location: { Latitude: 37.38831329345703, Longitude: -122.02929666666667 },
        Properties: { EpochMiliseconds: '1687633832016', TimeZoneId: 'Pacific Standard Time', Source: 'Cellular' },
      }),
    ).toEqual({
      altitudeM: 0,
      batteryPercent: 100,
      id: '12345678-1234-1234-1234-123456789012',
      imei: '123456789012345',
      lat: 37.38831,
      lon: -122.0293,
      speedKph: 0,
      timeMs: 1687633832016,
      type: 'msg',
    });
  });

  it('should parse check-in with location', () => {
    expect(
      parseMessage({
        MessageId: '2517146663509059999',
        MessageType: 'LS_end',
        DeviceIMEI: '123456789012345',
        DeviceId: '12345678-1234-1234-1234-123456789012',
        ReceivedAtServer: '2023-06-24T19:21:00Z',
        SentFromDevice: '2023-06-24T19:20:49.094Z',
        Location: { Latitude: 37.38532257080078, Longitude: -122.02786666666668 },
        Properties: { EpochMiliseconds: '1687634449094', TimeZoneId: 'Pacific Standard Time', Source: 'Cellular' },
      }),
    ).toEqual({
      altitudeM: 0,
      batteryPercent: 100,
      id: '12345678-1234-1234-1234-123456789012',
      imei: '123456789012345',
      lat: 37.38532,
      lon: -122.02787,
      speedKph: 0,
      timeMs: 1687634449094,
      type: 'msg',
    });
  });

  it('should parse SOS', () => {
    expect(
      parseMessage({
        MessageId: '2517414252596569999',
        MessageType: 'SOSInitiated',
        DeviceIMEI: '123456789012345',
        DeviceId: '12345678-1234-1234-1234-123456789012',
        ReceivedAtServer: '2022-08-19T02:19:33Z',
        SentFromDevice: '2022-08-19T02:19:00.343Z',
        Location: {
          Latitude: 43.62469,
          Longitude: -79.505033,
        },
        Properties: {
          EpochMiliseconds: '1660875540343',
          TimeZoneId: 'SE Asia Standard Time',
          Source: 'Cellular',
        },
      }),
    ).toEqual({
      altitudeM: 0,
      batteryPercent: 100,
      emergency: true,
      id: '12345678-1234-1234-1234-123456789012',
      imei: '123456789012345',
      lat: 43.62469,
      lon: -79.50503,
      message: 'SOS',
      speedKph: 0,
      timeMs: 1660875540343,
      type: 'msg',
    });
  });

  it('should parse PingLocation', () => {
    expect(
      parseMessage({
        MessageId: '2517146674703719999',
        MessageType: 'PingLocation',
        DeviceIMEI: '123456789012345',
        DeviceId: '12345678-1234-1234-1234-123456789012',
        ReceivedAtServer: '2025-06-20T16:20:06Z',
        SentFromDevice: '2025-06-20T16:18:39Z',
        Location: { Latitude: 45.12345, Longitude: 6.54321, Speed: 15, Altitude: 1500 },
        Properties: { EpochMiliseconds: '1687633329628', Battery: '85' },
      }),
    ).toEqual({
      altitudeM: 1500,
      batteryPercent: 85,
      id: '12345678-1234-1234-1234-123456789012',
      imei: '123456789012345',
      lat: 45.12345,
      lon: 6.54321,
      speedKph: 15,
      timeMs: 1687633329628,
      type: 'msg',
    });
  });

  it('should parse SOSCancelled', () => {
    expect(
      parseMessage({
        MessageId: '2517414252596569999',
        MessageType: 'SOSCancelled',
        DeviceIMEI: '123456789012345',
        DeviceId: '12345678-1234-1234-1234-123456789012',
        ReceivedAtServer: '2025-06-20T16:43:20Z',
        SentFromDevice: '2025-06-20T16:42:06Z',
        Location: { Latitude: 43.62469, Longitude: -79.505033 },
        Properties: { EpochMiliseconds: '1660875540343' },
      }),
    ).toEqual({
      altitudeM: 0,
      batteryPercent: 100,
      emergency: false,
      id: '12345678-1234-1234-1234-123456789012',
      imei: '123456789012345',
      lat: 43.62469,
      lon: -79.50503,
      message: 'SOS Cancelled',
      speedKph: 0,
      timeMs: 1660875540343,
      type: 'msg',
    });
  });

  it('should return null for EmailMessage and unknown message types', () => {
    expect(
      parseMessage({
        MessageId: '2516131960493289999',
        MessageType: 'EmailMessage',
        DeviceIMEI: '123456789012345',
        DeviceId: '12345678-1234-1234-1234-123456789012',
        RecipientEmailAddress: 'zoleo@flyxc.app',
        Message: 'Test message',
        ReceivedAtServer: '2026-09-11T05:32:34Z',
        SentFromDevice: '2026-09-11T05:32:30.671Z',
        Location: { Latitude: 43.62469, Longitude: -79.505033 },
        Properties: { EpochMiliseconds: '1789104750671', Source: 'Cellular' },
      }),
    ).toBeNull();

    expect(
      parseMessage({
        MessageType: 'SomeFutureMessageType',
        DeviceIMEI: '123456789012345',
        DeviceId: '12345678-1234-1234-1234-123456789012',
        Location: { Latitude: 43.62469, Longitude: -79.505033 },
        Properties: { EpochMiliseconds: '1660875540343' },
      }),
    ).toBeNull();
  });

  it('should return null when DeviceId is missing', () => {
    expect(
      parseMessage({
        MessageId: '2517146674703719999',
        MessageType: 'CheckIn',
        DeviceIMEI: '123456789012345',
        ReceivedAtServer: '2023-06-24T19:02:40Z',
        SentFromDevice: '2023-06-24T19:02:09.628Z',
        Location: { Latitude: 12.3456789, Longitude: -23.456789 },
        Properties: { EpochMiliseconds: '1687633329628', TimeZoneId: 'Pacific Standard Time', Source: 'Satellite' },
      }),
    ).toBeNull();
  });
});
