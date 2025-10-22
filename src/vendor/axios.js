class AxiosError extends Error {
  constructor(message, config, code, request, response, cause) {
    super(message);
    this.name = code === 'ERR_CANCELED' ? 'AbortError' : 'AxiosError';
    this.config = config;
    this.code = code;
    this.request = request;
    this.response = response;
    this.isAxiosError = true;
    if (cause) {
      this.cause = cause;
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      config: this.config,
      status: this.response?.status,
    };
  }
}

class InterceptorManager {
  constructor() {
    this.handlers = [];
  }

  use(onFulfilled, onRejected) {
    this.handlers.push({ onFulfilled, onRejected });
    return this.handlers.length - 1;
  }

  eject(id) {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  async runHandlers(input, reverse = false) {
    const handlers = reverse ? [...this.handlers].reverse() : this.handlers;
    let chain = Promise.resolve(input);
    for (const handler of handlers) {
      if (!handler) continue;
      const { onFulfilled, onRejected } = handler;
      chain = chain.then(onFulfilled, onRejected);
    }
    return chain;
  }
}

function isAbsoluteURL(url) {
  return /^([a-z][a-z\d+.-]*:)?\/\//i.test(url);
}

function combineURLs(baseURL, requestedURL) {
  if (!baseURL) return requestedURL;
  if (!requestedURL) return baseURL;
  if (isAbsoluteURL(requestedURL)) return requestedURL;
  return `${baseURL.replace(/\/$/, '')}/${requestedURL.replace(/^\//, '')}`;
}

function mergeConfig(defaultConfig = {}, config = {}) {
  const merged = { ...defaultConfig, ...config };
  if (defaultConfig.headers || config.headers) {
    merged.headers = { ...(defaultConfig.headers || {}), ...(config.headers || {}) };
  }
  if (config.baseURL != null) {
    merged.baseURL = config.baseURL;
  }
  return merged;
}

async function parseBody(response, responseType = 'json') {
  if (responseType === 'text') {
    return response.text();
  }
  if (responseType === 'blob') {
    return response.blob();
  }
  if (responseType === 'arraybuffer') {
    return response.arrayBuffer();
  }
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (err) {
      return await response.text();
    }
  }
  if (responseType === 'json') {
    try {
      return await response.json();
    } catch (err) {
      return await response.text();
    }
  }
  return response.text();
}

function buildResponse(config, requestInfo, response, data) {
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return {
    data,
    status: response.status,
    statusText: response.statusText,
    headers,
    config,
    request: requestInfo,
  };
}

async function dispatchRequest(config) {
  const { url, baseURL, method = 'get', headers = {}, data, params, responseType, signal, withCredentials } = config;
  const requestUrl = combineURLs(baseURL, url);
  let finalUrl = requestUrl;
  if (params && typeof params === 'object') {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        value.forEach((item) => usp.append(key, item));
      } else {
        usp.append(key, value);
      }
    });
    const queryString = usp.toString();
    if (queryString) {
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  const requestInit = {
    method: method.toUpperCase(),
    headers,
    signal,
    credentials: withCredentials ? 'include' : 'same-origin',
  };

  if (data !== undefined) {
    if (data instanceof FormData || data instanceof Blob || typeof data === 'string') {
      requestInit.body = data;
    } else if (data !== null && typeof data === 'object') {
      requestInit.body = JSON.stringify(data);
      requestInit.headers = { ...headers, 'Content-Type': headers['Content-Type'] || headers['content-type'] || 'application/json' };
    } else {
      requestInit.body = data;
    }
  }

  let response;
  try {
    response = await fetch(finalUrl, requestInit);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    throw new AxiosError('Network Error', config, 'ERR_NETWORK', { url: finalUrl, method: requestInit.method }, null, err);
  }

  const responseData = await parseBody(response, responseType);
  const axiosResponse = buildResponse(config, { url: finalUrl, method: requestInit.method }, response, responseData);

  if (!response.ok) {
    throw new AxiosError(
      `Request failed with status code ${response.status}`,
      config,
      response.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
      axiosResponse.request,
      axiosResponse,
    );
  }

  return axiosResponse;
}

function createAxios(defaultConfig = {}) {
  const context = {
    defaults: { responseType: 'json', ...defaultConfig },
    interceptors: {
      request: new InterceptorManager(),
      response: new InterceptorManager(),
    },
  };

  async function axiosInstance(configOrUrl, config) {
    return axiosInstance.request(configOrUrl, config);
  }

  axiosInstance.defaults = context.defaults;
  axiosInstance.interceptors = context.interceptors;

  axiosInstance.request = async function request(configOrUrl, maybeConfig = {}) {
    const isUrlString = typeof configOrUrl === 'string';
    const requestConfig = isUrlString ? { ...maybeConfig, url: configOrUrl } : { ...configOrUrl };
    const mergedConfig = mergeConfig(context.defaults, requestConfig);

    const configWithDefaults = await context.interceptors.request.runHandlers(mergedConfig);
    try {
      const response = await dispatchRequest(configWithDefaults);
      return context.interceptors.response.runHandlers(response);
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      if (err?.isAxiosError) {
        return context.interceptors.response.runHandlers(Promise.reject(err));
      }
      throw err;
    }
  };

  ['get', 'delete', 'head', 'options'].forEach((method) => {
    axiosInstance[method] = function (url, config) {
      return axiosInstance.request({ ...config, method, url });
    };
  });

  ['post', 'put', 'patch'].forEach((method) => {
    axiosInstance[method] = function (url, data, config) {
      return axiosInstance.request({ ...config, method, url, data });
    };
  });

  axiosInstance.create = function create(instanceConfig) {
    return createAxios(mergeConfig(context.defaults, instanceConfig));
  };

  return axiosInstance;
}

const axios = createAxios();
axios.AxiosError = AxiosError;
axios.CancelToken = undefined;
axios.isAxiosError = function isAxiosError(error) {
  return !!error && typeof error === 'object' && error.isAxiosError === true;
};
axios.create = function create(instanceConfig) {
  return createAxios(instanceConfig);
};

export { AxiosError };
export default axios;
