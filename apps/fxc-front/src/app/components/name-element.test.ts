import { modalController } from '@ionic/core/components';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NameElement } from './name-element';

vi.mock('@ionic/core/components', async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    modalController: {
      create: vi.fn().mockResolvedValue({
        present: vi.fn().mockResolvedValue(undefined),
      }),
    },
  };
});

describe('NameElement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('instantiates NameElement', () => {
    const el = new NameElement();
    expect(el).toBeInstanceOf(NameElement);
  });

  it('renders nothing and hides host when no track is active', async () => {
    const el = new NameElement();
    el.hasTrack = false;
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('div')).toBeNull();
    expect(el.hidden).toBe(true);
    expect(el.style.display).toBe('none');
    el.remove();
  });

  it('hides host when name is missing even if hasTrack is true', async () => {
    const el = new NameElement();
    el.hasTrack = true;
    el.name = '';
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('div')).toBeNull();
    expect(el.hidden).toBe(true);
    expect(el.style.display).toBe('none');
    el.remove();
  });

  it('renders name, color, and displays host when track is active', async () => {
    const el = new NameElement();
    el.hasTrack = true;
    el.name = 'John Doe';
    el.color = 'rgb(255, 0, 0)';
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.hidden).toBe(false);
    expect(el.style.display).toBe('block');

    const text = el.shadowRoot?.textContent;
    expect(text).toContain('John Doe');

    const icon = el.shadowRoot?.querySelector('i.las');
    expect(icon?.getAttribute('style')).toContain('color: rgb(255, 0, 0)');
    el.remove();
  });

  it('opens track-modal on click for runtime track', async () => {
    const el = new NameElement();
    el.hasTrack = true;
    el.name = 'John Doe';
    el.isLive = false;
    document.body.appendChild(el);
    await el.updateComplete;

    const clickableDiv = el.shadowRoot?.querySelector('div');
    clickableDiv?.click();

    expect(modalController.create).toHaveBeenCalledWith({
      component: 'track-modal',
    });
    el.remove();
  });

  it('opens live-modal on click for live track', async () => {
    const el = new NameElement();
    el.hasTrack = true;
    el.name = 'Live Pilot';
    el.isLive = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const clickableDiv = el.shadowRoot?.querySelector('div');
    clickableDiv?.click();

    expect(modalController.create).toHaveBeenCalledWith({
      component: 'live-modal',
    });
    el.remove();
  });
});
