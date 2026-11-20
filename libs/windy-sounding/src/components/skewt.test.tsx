import * as math from '../util/math';
import { Clouds } from './skewt';

describe('Clouds component', () => {
  // Pressure scale from 500 hPa (y=0) to 1000 hPa (y=500)
  const pressureToPxScale = math.scaleLinear([500, 1000], [0, 500]);
  const width = 300;
  const surfacePressure = 1000;
  const cloudLevels = [300, 400, 500, 700, 850, 1000];

  it('renders cloud column starting at y=0 when there is no upper cloud (even with showUpperClouds=true)', () => {
    // No upper cloud (levels <= 500 hPa have 0 cover), but local cloud at 700-850 hPa
    const clouds = [0, 0, 0, 60, 80, 0];

    const vnode = Clouds({
      width,
      cloudLevels,
      clouds,
      pressureToPxScale,
      surfacePressure,
      showUpperClouds: true,
    });

    expect(vnode).not.toBeNull();
    const children = (vnode as any).props.children;

    // Should NOT contain the upper cloud rect or upper boundary line
    const upperRect = children.find((el: any) => el?.key === 'upper');
    expect(upperRect).toBeUndefined();

    const upperLine = children.find((el: any) => el?.key === 'upper-line');
    expect(upperLine).toBeUndefined();

    // The cloud column should start at y=0, NOT y=30
    const cloudColumn = children.find((el: any) => el?.key === 'cloud-column');
    expect(cloudColumn).toBeDefined();
    expect(cloudColumn.props.y).toBe(0);
    expect(cloudColumn.props.height).toBe(500);
  });

  it('renders upper band and offsets cloud column to y=30 when high clouds are present', () => {
    // Upper cloud at 300 hPa (cover = 50%), and local cloud at 700-850 hPa
    const clouds = [50, 0, 0, 60, 80, 0];

    const vnode = Clouds({
      width,
      cloudLevels,
      clouds,
      pressureToPxScale,
      surfacePressure,
      showUpperClouds: true,
    });

    expect(vnode).not.toBeNull();
    const children = (vnode as any).props.children;

    // Should contain the upper cloud rect and boundary line
    const upperRect = children.find((el: any) => el?.key === 'upper');
    expect(upperRect).toBeDefined();
    expect(upperRect.props.y).toBe(0);
    expect(upperRect.props.height).toBe(30);

    const upperLine = children.find((el: any) => el?.key === 'upper-line');
    expect(upperLine).toBeDefined();

    // The cloud column should start at y=30
    const cloudColumn = children.find((el: any) => el?.key === 'cloud-column');
    expect(cloudColumn).toBeDefined();
    expect(cloudColumn.props.y).toBe(30);
    expect(cloudColumn.props.height).toBe(500 - 30);
  });

  it('does not render upper band when showUpperClouds is false', () => {
    // Upper cloud at 300 hPa, but showUpperClouds is false (not zoomed in)
    const clouds = [50, 0, 0, 60, 80, 0];

    const vnode = Clouds({
      width,
      cloudLevels,
      clouds,
      pressureToPxScale,
      surfacePressure,
      showUpperClouds: false,
    });

    expect(vnode).not.toBeNull();
    const children = (vnode as any).props.children;

    const upperRect = children.find((el: any) => el?.key === 'upper');
    expect(upperRect).toBeUndefined();

    const cloudColumn = children.find((el: any) => el?.key === 'cloud-column');
    expect(cloudColumn).toBeDefined();
    expect(cloudColumn.props.y).toBe(0);
  });
});
