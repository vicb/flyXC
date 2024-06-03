import type { AprsPosition} from './aprs';
import { generateAprsPosition, parseAprsPosition } from './aprs';

describe('parseAprsPosition', () => {
  it('return null if malformed position', () => {
    expect(parseAprsPosition('')).toBeNull();
  });

  it('parse time', () => {
    // May 2, 2023 22:30:00
    const nowSec = 1683066600;
    expect(parseAprsPosition('223000h0000.00N/00000.00E/', nowSec)).toMatchObject({
      timeSec: nowSec,
    });
    expect(parseAprsPosition('222950h0000.00N/00000.00E/', nowSec)).toMatchObject({
      timeSec: nowSec - 10,
    });
    expect(parseAprsPosition('222900h0000.00N/00000.00E/', nowSec)).toMatchObject({
      timeSec: nowSec - 60,
    });
    expect(parseAprsPosition('213000h0000.00N/00000.00E/', nowSec)).toMatchObject({
      timeSec: nowSec - 3600,
    });

    // Tuesday, May 2, 2023 00:01:00
    const earlySec = 1682985660;
    expect(parseAprsPosition('000100h0000.00N/00000.00E/', nowSec)).toMatchObject({
      timeSec: earlySec,
    });
    expect(parseAprsPosition('235900h0000.00N/00000.00E/', nowSec)).toMatchObject({
      timeSec: earlySec - 120,
    });
  });

  it('parse latitude', () => {
    expect(parseAprsPosition('123456h0000.00N/00000.00E/')).toMatchObject({
      lat: 0,
    });
    expect(parseAprsPosition('123456h4500.00N/00000.00E/')).toMatchObject({
      lat: 45,
    });
    expect(parseAprsPosition('123456h4500.00S/00000.00E/')).toMatchObject({
      lat: -45,
    });
    expect(parseAprsPosition('123456h9000.00N/00000.00E/')).toMatchObject({
      lat: 90,
    });
    expect(parseAprsPosition('123456h9000.00S/00000.00E/')).toMatchObject({
      lat: -90,
    });

    expect(parseAprsPosition('123456h1006.00N/00000.00E/')).toMatchObject({
      lat: 10.1,
    });
    expect(parseAprsPosition('123456h1006.06N/00000.00E/')).toMatchObject({
      lat: 10.101,
    });
    expect(parseAprsPosition('123456h1000.00N/00000.00E/ !W60!')).toMatchObject({
      lat: 10.0001,
    });
  });

  it('parse longitude', () => {
    expect(parseAprsPosition('123456h0000.00N/00000.00E/')).toMatchObject({
      lon: 0,
    });

    expect(parseAprsPosition('123456h0000.00N/09000.00E/')).toMatchObject({
      lon: 90,
    });
    expect(parseAprsPosition('123456h0000.00N/09000.00W/')).toMatchObject({
      lon: -90,
    });
    expect(parseAprsPosition('123456h0000.00N/18000.00E/')).toMatchObject({
      lon: 180,
    });
    expect(parseAprsPosition('123456h0000.00N/18000.00W/')).toMatchObject({
      lon: -180,
    });

    expect(parseAprsPosition('123456h0000.00N/01006.00E/')).toMatchObject({
      lon: 10.1,
    });
    expect(parseAprsPosition('123456h0000.00N/01006.06E/')).toMatchObject({
      lon: 10.101,
    });
    expect(parseAprsPosition('123456h0000.00N/01000.00E/ !W06!')).toMatchObject({
      lon: 10.0001,
    });
  });

  it('parse course', () => {
    expect(parseAprsPosition('123456h0000.00N/00000.00E/')).toMatchObject({
      course: 0,
    });
    expect(parseAprsPosition('123456h0000.00N/00000.00E/123/100')).toMatchObject({
      course: 123,
    });
  });

  it('parse speed', () => {
    expect(parseAprsPosition('123456h0000.00N/00000.00E/')).toMatchObject({
      speed: 0,
    });
    expect(parseAprsPosition('123456h0000.00N/00000.00E/000/100')).toMatchObject({
      speed: 185,
    });
  });

  it('parse altitude', () => {
    expect(parseAprsPosition('123456h0000.00N/00000.00E/')).toMatchObject({
      alt: 0,
    });
    expect(parseAprsPosition('123456h0000.00N/00000.00E//A=000300')).toMatchObject({
      alt: 91,
    });
  });

  it('parse comment', () => {
    expect(parseAprsPosition('123456h0000.00N/00000.00E/')).toMatchObject({
      comment: undefined,
    });
    expect(parseAprsPosition('123456h0000.00N/00000.00E/ comment')).toMatchObject({
      comment: 'comment',
    });
  });
});

describe('generateAprsPosition', () => {
  let position: AprsPosition;

  beforeEach(() => {
    position = {
      lat: 0,
      lon: 0,
      timeSec: 0,
      alt: 0,
      speed: 0,
      course: 0,
    };
  });

  it('generate time', () => {
    position.timeSec = Math.round(new Date('Tue May 02 2023 12:34:56 GMT-0000').getTime() / 1000);
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/123456h0000.00N/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.timeSec = Math.round(new Date('Tue May 02 2023 01:02:03 GMT-0000').getTime() / 1000);
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/010203h0000.00N/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
  });

  it('generate latitude', () => {
    position.lat = 0;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.lat = 45;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h4500.00N/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.lat = -45;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h4500.00S/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.lat = 90;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h9000.00N/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.lat = -90;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h9000.00S/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );

    position.lat = 10.1;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h1006.00N/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.lat = 10.101;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h1006.06N/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.lat = 10.0001;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h1000.00N/00000.00Eg000/000/A=000000 !W60! id1E123ABC',
    );
  });

  it('generate longitude', () => {
    position.lon = 0;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.lon = 90;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/09000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.lon = -90;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/09000.00Wg000/000/A=000000 !W00! id1E123ABC',
    );
    position.lon = 180;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/18000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.lon = -180;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/18000.00Wg000/000/A=000000 !W00! id1E123ABC',
    );

    position.lon = 10.1;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/01006.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.lon = 10.101;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/01006.06Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.lon = 10.0001;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/01000.00Eg000/000/A=000000 !W06! id1E123ABC',
    );
  });

  it('generate course', () => {
    position.course = 0;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.course = 123;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg123/000/A=000000 !W00! id1E123ABC',
    );
    position.course = 123.456;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg123/000/A=000000 !W00! id1E123ABC',
    );
    position.course = 362;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg002/000/A=000000 !W00! id1E123ABC',
    );
  });

  it('generate speed', () => {
    position.speed = 0;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.speed = 185;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg000/100/A=000000 !W00! id1E123ABC',
    );
    position.speed = 185.123;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg000/100/A=000000 !W00! id1E123ABC',
    );
    position.speed = 2000;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg000/999/A=000000 !W00! id1E123ABC',
    );
  });

  it('generate altitude', () => {
    position.alt = 0;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.alt = -100;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg000/000/A=000000 !W00! id1E123ABC',
    );
    position.alt = 91;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg000/000/A=000299 !W00! id1E123ABC',
    );
    position.alt = 91.123;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg000/000/A=000299 !W00! id1E123ABC',
    );
    position.alt = 1000000;
    expect(generateAprsPosition(position, '123ABC')).toEqual(
      'FXC123ABC>FXCAPP:/000000h0000.00N/00000.00Eg000/000/A=999999 !W00! id1E123ABC',
    );
  });

  it('generate comment', () => {
    position.comment = 'comment';
    expect(generateAprsPosition(position, 'abcdef')).toEqual(
      'FXCABCDEF>FXCAPP:/000000h0000.00N/00000.00Eg000/000/A=000000 !W00! id1EABCDEF comment',
    );
  });
});
