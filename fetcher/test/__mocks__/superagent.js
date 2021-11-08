// https://gist.github.com/gbalbuena/3ec499535d435712ce16c1eced9f5502

let mockDelay;
let mockError;
let mockResponse = {
  get: jest.fn(),
  ok: true,
  status: 200,
  toError: jest.fn(),
};

let mockResponseBodies;
let responseBodiesIndex;

const Request = {
  __setMockDelay(boolValue) {
    mockDelay = boolValue;
  },
  __setMockError(mockErr) {
    mockError = mockErr;
  },
  __setMockResponse(mockRes) {
    mockResponse = mockRes;
  },
  __setMockResponseBodies(bodies) {
    mockResponseBodies = bodies;
    responseBodiesIndex = -1;
  },
  __setMockResponseBody(body) {
    mockResponse.body = body;
    responseBodiesIndex = undefined;
  },
  accept: jest.fn().mockReturnThis(),
  buffer: jest.fn().mockReturnThis(),
  parse: jest.fn().mockReturnThis(),
  catch: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  end: jest.fn().mockImplementation((callback) => {
    if (mockDelay) {
      this.delayTimer = setTimeout(callback, 0, mockError, mockResponse);

      return;
    }

    callback(mockError, mockResponse);
  }),
  field: jest.fn().mockReturnThis(),
  get: jest.fn().mockReturnThis(),
  head: jest.fn().mockReturnThis(),
  patch: jest.fn().mockReturnThis(),
  post: jest.fn().mockReturnThis(),
  put: jest.fn().mockReturnThis(),
  query: jest.fn().mockReturnThis(),
  redirects: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  retry: jest.fn().mockReturnThis(),
  then: jest.fn().mockImplementation((callback) => {
    return new Promise((resolve, reject) => {
      if (mockError) {
        return reject(mockError);
      }
      return resolve(callback(mockResponse));
    });
  }),
  timeout: jest.fn().mockReturnThis(),
  type: jest.fn().mockReturnThis(),
};

export default Request;
