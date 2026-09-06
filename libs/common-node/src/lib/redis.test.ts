import type { RedisClientMultiCmd } from './redis';
import { pushListCap } from './redis';

describe('pushListCap', () => {
  let mockPipeline: {
    lPush: ReturnType<typeof vi.fn>;
    lTrim: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPipeline = {
      lPush: vi.fn().mockReturnThis(),
      lTrim: vi.fn().mockReturnThis(),
    };
  });

  it('should not push or trim when the list is empty', () => {
    const result = pushListCap(mockPipeline as unknown as RedisClientMultiCmd, 'test_key', [], 10);
    expect(result).toBe(mockPipeline);
    expect(mockPipeline.lPush).not.toHaveBeenCalled();
    expect(mockPipeline.lTrim).not.toHaveBeenCalled();
  });

  it('should not push or trim when capacity is <= 0', () => {
    const result = pushListCap(mockPipeline as unknown as RedisClientMultiCmd, 'test_key', ['item1'], 0);
    expect(result).toBe(mockPipeline);
    expect(mockPipeline.lPush).not.toHaveBeenCalled();
    expect(mockPipeline.lTrim).not.toHaveBeenCalled();
  });

  it('should push elements and trim list to capacity', () => {
    pushListCap(mockPipeline as unknown as RedisClientMultiCmd, 'test_key', ['a', 'b', 'c'], 5);
    expect(mockPipeline.lPush).toHaveBeenCalledWith('test_key', ['a', 'b', 'c']);
    expect(mockPipeline.lTrim).toHaveBeenCalledWith('test_key', 0, 4);
  });

  it('should only keep the last `capacity` elements when list is larger than capacity', () => {
    pushListCap(mockPipeline as unknown as RedisClientMultiCmd, 'test_key', ['a', 'b', 'c', 'd', 'e'], 3);
    expect(mockPipeline.lPush).toHaveBeenCalledWith('test_key', ['c', 'd', 'e']);
    expect(mockPipeline.lTrim).toHaveBeenCalledWith('test_key', 0, 2);
  });

  it('should truncate elements longer than maxLength', () => {
    pushListCap(mockPipeline as unknown as RedisClientMultiCmd, 'test_key', ['abcdefghij'], 5, 4);
    expect(mockPipeline.lPush).toHaveBeenCalledWith('test_key', ['abcd']);
  });

  it('should convert numbers to strings', () => {
    pushListCap(mockPipeline as unknown as RedisClientMultiCmd, 'test_key', [123, 456], 5);
    expect(mockPipeline.lPush).toHaveBeenCalledWith('test_key', ['123', '456']);
  });
});
