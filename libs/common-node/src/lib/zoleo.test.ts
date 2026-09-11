import { parseMessage } from './zoleo';

describe('parseMessage', () => {
  const device = {
    DeviceIMEI: '123456789012345',
    DeviceId: '12345678-1234-1234-1234-123456789012',
  };
  const properties = { EpochMiliseconds: '1687633329628' };

  it('parses an IMEI consent message', () => {
    expect(parseMessage({ IMEI: '123456789012345', partnerDeviceID: device.DeviceId })).toEqual({
      id: device.DeviceId,
      imei: '123456789012345',
      type: 'imei',
    });
  });

  it('parses a check-in location with default values', () => {
    expect(
      parseMessage({
        MessageType: 'CheckIn',
        ...device,
        Location: { Latitude: 12.3456789, Longitude: -23.456789 },
        Properties: properties,
      }),
    ).toEqual({
      altitudeM: 0,
      batteryPercent: 100,
      id: device.DeviceId,
      imei: device.DeviceIMEI,
      lat: 12.34568,
      lon: -23.45679,
      message: 'Check-In',
      timeMs: 1687633329628,
      type: 'location',
    });
  });

  it('parses altitude and battery values', () => {
    expect(
      parseMessage({
        MessageType: 'CheckIn',
        ...device,
        Location: { Latitude: 12.3456789, Longitude: -23.456789, Altitude: 123 },
        Properties: { ...properties, Battery: '96' },
      }),
    ).toMatchObject({ altitudeM: 123, batteryPercent: 96 });
  });

  it('rejects a location message without coordinates', () => {
    expect(parseMessage({ MessageType: 'CheckIn', ...device, Location: {}, Properties: properties })).toBeNull();
  });

  it.each(['LS_start', 'LS_location', 'LS_end', 'PingLocation'])('parses %s as a location message', (MessageType) => {
    expect(
      parseMessage({
        MessageType,
        ...device,
        Location: { Latitude: 37.38762283325195, Longitude: -122.02716333333335 },
        Properties: properties,
      }),
    ).toMatchObject({
      id: device.DeviceId,
      lat: 37.38762,
      lon: -122.02716,
      timeMs: 1687633329628,
      type: 'location',
    });
  });

  it.each([
    ['SOSInitiated', 'SOS', true],
    ['SOSCancelled', 'SOS Cancelled', false],
  ])('parses %s emergency state', (MessageType, message, emergency) => {
    expect(
      parseMessage({
        MessageType,
        ...device,
        Location: { Latitude: 43.62469, Longitude: -79.505033 },
        Properties: properties,
      }),
    ).toMatchObject({ emergency, message, type: 'location' });
  });

  it('parses an EmailMessage without a location', () => {
    expect(
      parseMessage({
        MessageType: 'EmailMessage',
        ...device,
        Message: 'Test message',
        Location: {},
        Properties: { EpochMiliseconds: '1789104750671' },
      }),
    ).toEqual({
      batteryPercent: 100,
      id: device.DeviceId,
      imei: device.DeviceIMEI,
      message: 'Test message',
      timeMs: 1789104750671,
      type: 'message',
    });
  });

  it('parses an EmailMessage with a location', () => {
    expect(
      parseMessage({
        MessageType: 'EmailMessage',
        ...device,
        Message: 'Test message',
        Location: { Latitude: 43.62469, Longitude: -79.505033 },
        Properties: properties,
      }),
    ).toEqual({
      altitudeM: 0,
      batteryPercent: 100,
      id: device.DeviceId,
      imei: device.DeviceIMEI,
      lat: 43.62469,
      lon: -79.50503,
      message: 'Test message',
      timeMs: 1687633329628,
      type: 'message',
    });
  });

  it('truncates an EmailMessage longer than 200 characters', () => {
    expect(
      parseMessage({
        MessageType: 'EmailMessage',
        ...device,
        Message: 'x'.repeat(201),
        Location: {},
        Properties: properties,
      }),
    ).toMatchObject({ message: 'x'.repeat(200), type: 'message' });
  });

  it('rejects unknown message types, missing IDs, and malformed payloads', () => {
    expect(
      parseMessage({
        MessageType: 'SomeFutureMessageType',
        ...device,
        Location: { Latitude: 43.62469, Longitude: -79.505033 },
        Properties: properties,
      }),
    ).toBeNull();
    expect(
      parseMessage({
        MessageType: 'EmailMessage',
        ...device,
        Message: 'Test message',
        Location: {},
        Properties: {},
      }),
    ).toBeNull();
    expect(
      parseMessage({
        MessageType: 'CheckIn',
        DeviceIMEI: device.DeviceIMEI,
        Location: { Latitude: 12.3456789, Longitude: -23.456789 },
        Properties: properties,
      }),
    ).toBeNull();
    expect(
      parseMessage({
        MessageType: 'CheckIn',
        ...device,
        Location: { Latitude: 12.3456789, Longitude: -23.456789, Altitude: 'bad-altitude' },
        Properties: properties,
      }),
    ).toBeNull();
  });
});
