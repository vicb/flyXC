import type { LiveTrackEntity } from '@flyxc/common';
import { AccountFormModel } from '@flyxc/common';
import { describe, expect, it } from 'vitest';

import { updateLiveTrackEntityFromModel } from './live-track-entity';

describe('updateLiveTrackEntityFromModel', () => {
  it('should preserve zoleo account and device_id from existing entity', () => {
    const existingEntity = {
      email: 'pilot@example.com',
      google_id: 'google-123',
      name: 'Pilot Name',
      share: true,
      enabled: true,
      zoleo: {
        enabled: true,
        account: '300434064660820',
        device_id: 'c5acc06a-c6f0-40c2-8987-e1a5ac53f6d9',
      },
    } as unknown as LiveTrackEntity;

    const accountModel = AccountFormModel.createEmptyValue();
    accountModel.name = 'Updated Name';
    accountModel.enabled = true;
    accountModel.zoleo = {
      enabled: false,
      account: '',
      device_id: '',
    };

    const updated = updateLiveTrackEntityFromModel(existingEntity, accountModel, 'pilot@example.com', 'google-123');

    expect(updated.name).toBe('Updated Name');
    expect(updated.zoleo?.enabled).toBe(false);
    expect(updated.zoleo?.account).toBe('300434064660820');
    expect(updated.zoleo?.device_id).toBe('c5acc06a-c6f0-40c2-8987-e1a5ac53f6d9');
  });

  it('should handle undefined existing zoleo entity', () => {
    const existingEntity = {
      email: 'pilot@example.com',
      google_id: 'google-123',
      name: 'Pilot Name',
      share: true,
      enabled: true,
    } as unknown as LiveTrackEntity;

    const accountModel = AccountFormModel.createEmptyValue();
    accountModel.name = 'Pilot Name';
    accountModel.zoleo = {
      enabled: true,
      account: 'dummy-ignored',
    };

    const updated = updateLiveTrackEntityFromModel(existingEntity, accountModel, 'pilot@example.com', 'google-123');

    expect(updated.zoleo?.enabled).toBe(true);
    expect(updated.zoleo?.account).toBe('');
    expect(updated.zoleo?.device_id).toBe('');
  });

  it('should initialize a new entity when existingEntity is undefined', () => {
    const accountModel = AccountFormModel.createEmptyValue();
    accountModel.name = 'New Pilot';
    accountModel.enabled = true;
    accountModel.zoleo = {
      enabled: true,
      account: 'dummy-ignored',
      device_id: 'dummy-ignored-id',
    };

    const updated = updateLiveTrackEntityFromModel(undefined, accountModel, 'new@example.com', 'google-456');

    expect(updated.email).toBe('new@example.com');
    expect(updated.google_id).toBe('google-456');
    expect(updated.created).toBeInstanceOf(Date);
    expect(updated.updated).toBeInstanceOf(Date);
    expect(updated.name).toBe('New Pilot');
    expect(updated.zoleo?.enabled).toBe(true);
    expect(updated.zoleo?.account).toBe('');
    expect(updated.zoleo?.device_id).toBe('');
  });
});
