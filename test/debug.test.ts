import mock from '../src';

const noop = () => {};

const fetchXHR = (url, opts: any = {}) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const requestUpload = xhr.upload;
    const assert = opts.assert || noop;

    const handleLoadStart = evt => {
      assert({
        payload: evt,
        state: 'START'
      });
    };

    const handleProgress = evt => {
      assert({
        payload: evt,
        state: 'PROGRESS'
      });
    };

    let xhrError;
    let response;
    const createCommonErrorHandler = errMsg => errOverride => {
      const err = errOverride || new Error(errMsg);

      assert({
        payload: err,
        state: 'REJECTED'
      });

      xhrError = err;
    };
    const handleErrorAbort = createCommonErrorHandler('ABORTED');
    const handleErrorError = createCommonErrorHandler('ERROR');
    const handleErrorTimeout = createCommonErrorHandler('TIMEOUT');

    const handleLoad = evt => {
      response = evt.target.responseText;

      assert({
        payload: response,
        state: 'FULFILLED'
      });

      response = evt.target.responseText;
    };

    const handleLoadEnd = () => {
      assert({
        payload: undefined,
        state: 'END'
      });

      if (xhrError) {
        reject(xhrError);
      } else if (response) {
        resolve(response);
      }

      cleanUp();
    };

    const cleanUp = () => {
      requestUpload.removeEventListener('progress', handleProgress);
      xhr.removeEventListener('abort', handleErrorAbort);
      xhr.removeEventListener('error', handleErrorError);
      xhr.removeEventListener('load', handleLoad);
      xhr.removeEventListener('loadend', handleLoadEnd);
      xhr.removeEventListener('loadstart', handleLoadStart);
      xhr.removeEventListener('timeout', handleErrorTimeout);
    };

    requestUpload.addEventListener('progress', handleProgress);
    xhr.addEventListener('abort', handleErrorAbort);
    xhr.addEventListener('error', handleErrorError);
    xhr.addEventListener('load', handleLoad);
    xhr.addEventListener('loadend', handleLoadEnd);
    xhr.addEventListener('loadstart', handleLoadStart);
    xhr.addEventListener('timeout', handleErrorTimeout);

    xhr.open(opts.method || 'GET', url, true);

    for (const keyHeader in opts.headers || {}) {
      xhr.setRequestHeader(keyHeader, opts.headers[keyHeader]);
    }

    xhr.withCredentials = opts.credentials === 'include';
    xhr.send(opts.body);
  });

describe('debug', () => {
  const URL_API = 'http://localhost/api';
  beforeEach(() => {
    mock.setup();
  });

  beforeEach(() => {
    mock.reset();
  });

  afterEach(() => {
    mock.teardown();
  });

  it('Progress should work, but does not', async () => {
    mock.post(URL_API, (req, res) =>
      res
        .status(201)
        .header('Content-type', 'image/jpeg')
        .body('Hello World!')
    );

    const assert = jest.fn();

    const res = await fetchXHR(URL_API, {
      assert,
      body: '',
      headers: {
        'Content-type': '12'
      },
      method: 'POST'
    });

    expect(res).toEqual('Hello World!');

    const actionVerifyMap = {
      END: false,
      FULFILLED: false,
      PROGRESS: false,
      START: false
    };

    assert.mock.calls.forEach(([{payload, state}]) => {
      switch (state) {
        case 'START':
          expect(payload).toBeTruthy();
          actionVerifyMap.START = true;
          break;
        case 'PROGRESS':
          expect(payload).toBeTruthy();
          actionVerifyMap.PROGRESS = true;
          break;
        case 'FULFILLED':
          expect(payload).toBeTruthy();
          actionVerifyMap.FULFILLED = true;
          break;
        case 'END':
          expect(payload).toBeUndefined();
          actionVerifyMap.END = true;
          break;
        default:
          throw new Error(`Unknown state: ${state} to assert.`);
      }
    });

    expect(
      Object.keys(actionVerifyMap).some(
        actionKey => !actionVerifyMap[actionKey]
      )
    ).toEqual(false);
  });

  it('should do loadend on error, but does not', async () => {
    mock.post(URL_API, () => Promise.reject(new Error('nope')));

    const assert = jest.fn();

    const actionVerifyMap = {
      END: false,
      REJECTED: false,
      START: false
    };

    try {
      await fetchXHR(URL_API, {
        assert,
        body: '',
        method: 'POST'
      });
    } catch (err) {
      expect(err).toBeTruthy();

      assert.mock.calls.forEach(([{payload, state}]) => {
        switch (state) {
          case 'START':
            expect(payload).toBeTruthy();
            actionVerifyMap.START = true;
            break;
          case 'REJECTED':
            expect(payload).toBeTruthy();
            actionVerifyMap.REJECTED = true;
            break;
          case 'END':
            expect(payload).toBeUndefined();
            actionVerifyMap.END = true;
            break;
          default:
            throw new Error(`Unknown state: ${payload.state} to assert.`);
        }
      });

      expect(
        Object.keys(actionVerifyMap).some(
          actionKey => !actionVerifyMap[actionKey]
        )
      ).toEqual(false);
    }
  });
});
