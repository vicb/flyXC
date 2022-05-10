// import { getFlyMeId } from 'flyxc/fetcher/src/trackers/flyme';
// import request from 'superagent';

// jest.mock('superagent');

// describe('Fetch FlyMe id', () => {
//   it('should return an existing user id', async () => {
//     (request as any).__setMockResponse({ ok: true, body: 'ok: 123' });
//     const id = await getFlyMeId('foo');
//     expect(request.get).toHaveBeenCalled();
//     expect(id).toBe('123');
//   });

//   it('should return undefined when the user does not exist', async () => {
//     (request as any).__setMockResponse({ ok: true, body: 'invalid username' });
//     await expect(async () => await getFlyMeId('foo')).rejects.toThrow(/can not be found/);
//   });

//   it('should throw on server error', async () => {
//     (request as any).then.mockImplementation(() => {
//       throw new Error('Mock Error');
//     });
//     await expect(async () => await getFlyMeId('foo')).rejects.toThrow(/Flyme server error/i);
//   });

//   it('should throw when the status code is not 200', async () => {
//     (request as any).__setMockResponse({ status: 500, ok: false });
//     await expect(async () => await getFlyMeId('foo')).rejects.toThrow(/Flyme server error/);
//   });
// });
