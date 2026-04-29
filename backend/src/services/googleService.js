import { GoogleAuth } from 'google-auth-library';
import { config } from '../config.js';
import { formatBeijingTime } from '../utils.js';

function createApiError(message, extra = {}) {
  const error = new Error(message);
  Object.assign(error, extra);
  return error;
}

function buildTimeoutSignal() {
  return AbortSignal.timeout(config.googleApiTimeoutMs);
}

function isProxyLimitMessage(message) {
  return /traffic limit|access denied|contact support|account manager/i.test(String(message || ''));
}

function createProxyResponseError(status, data) {
  const proxyMessage =
    data?.message ||
    data?.error?.message ||
    `Proxy request failed: ${status}`;

  if (status === 407 || isProxyLimitMessage(proxyMessage)) {
    return createApiError(
      'Outbound proxy rejected the request. Check backend/.env proxy settings, proxy credentials, or proxy traffic quota.',
      {
        code: 'PROXY_407',
        status,
        causeMessage: proxyMessage,
        responseData: data
      }
    );
  }

  return createApiError(proxyMessage, {
    status,
    responseData: data
  });
}

function normalizeGoogleError(error) {
  if (error?.name === 'TimeoutError' || error?.code === 'UND_ERR_CONNECT_TIMEOUT') {
    return createApiError(`Google API request timed out after ${config.googleApiTimeoutMs}ms`, {
      code: error.code || 'TIMEOUT'
    });
  }

  if (error?.message?.includes('oauth2.googleapis.com/token failed') && /ETIMEDOUT|ENETUNREACH|ECONNRESET|ECONNREFUSED/i.test(error.message)) {
    return createApiError(
      'Failed to reach Google OAuth token endpoint. Check server outbound network or configure HTTPS_PROXY in backend/.env.',
      { causeMessage: error.message, code: 'GOOGLE_OAUTH_UNREACHABLE' }
    );
  }

  if (/ETIMEDOUT|ENETUNREACH|ECONNRESET|ECONNREFUSED/i.test(error?.message || '')) {
    return createApiError('Failed to reach Google API. Check server outbound network or proxy settings.', {
      causeMessage: error.message,
      code: error.code || 'NETWORK_ERROR'
    });
  }

  return error;
}

function parseConfiguredSiteUrls(siteUrlInput) {
  return String(siteUrlInput || '')
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getHostnameFromUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function normalizeOriginSiteUrl(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}/`;
  } catch {
    return value;
  }
}

function isDomainProperty(value) {
  return /^sc-domain:/i.test(value);
}

function getDomainPropertyDomain(value) {
  return value.replace(/^sc-domain:/i, '').trim().toLowerCase();
}

function hostnameMatchesDomainProperty(hostname, propertyDomain) {
  return hostname === propertyDomain || hostname.endsWith(`.${propertyDomain}`);
}

function resolveInspectionSiteUrl(inspectionUrl, siteUrlInput) {
  const configuredSiteUrls = parseConfiguredSiteUrls(siteUrlInput);
  if (!configuredSiteUrls.length) {
    throw new Error('Please configure at least one GSC Site URL in Settings first');
  }

  const inspectionHostname = getHostnameFromUrl(inspectionUrl);
  if (!inspectionHostname) {
    throw new Error('Inspection URL is invalid');
  }

  const exactOriginMatch = configuredSiteUrls.find((item) => {
    if (isDomainProperty(item)) {
      return false;
    }
    return getHostnameFromUrl(item) === inspectionHostname;
  });
  if (exactOriginMatch) {
    return normalizeOriginSiteUrl(exactOriginMatch);
  }

  const domainPropertyMatch = configuredSiteUrls.find((item) => {
    if (!isDomainProperty(item)) {
      return false;
    }
    return hostnameMatchesDomainProperty(inspectionHostname, getDomainPropertyDomain(item));
  });
  if (domainPropertyMatch) {
    return domainPropertyMatch;
  }

  if (configuredSiteUrls.length === 1) {
    return isDomainProperty(configuredSiteUrls[0]) ? configuredSiteUrls[0] : normalizeOriginSiteUrl(configuredSiteUrls[0]);
  }

  throw new Error(`No matching GSC Site URL found for host: ${inspectionHostname}`);
}

function getAuthClient(serviceAccountJson, scopes) {
  if (!serviceAccountJson) {
    throw new Error('Please configure Google Service Account JSON in Settings first');
  }

  let credentials;
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('Service Account JSON is invalid');
  }

  return new GoogleAuth({ credentials, scopes });
}

async function authorizedFetch(url, options, serviceAccountJson, scopes) {
  let token;
  try {
    const auth = getAuthClient(serviceAccountJson, scopes);
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  } catch (error) {
    throw normalizeGoogleError(error);
  }

  if (!token) {
    throw new Error('Failed to get Google access token');
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: buildTimeoutSignal(),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {})
      }
    });
  } catch (error) {
    throw normalizeGoogleError(error);
  }

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { rawText: text };
  }

  if (!response.ok) {
    throw createProxyResponseError(response.status, data);
  }

  return data;
}

export async function submitIndexingUrl(url, serviceAccountJson) {
  return authorizedFetch(
    'https://indexing.googleapis.com/v3/urlNotifications:publish',
    {
      method: 'POST',
      body: JSON.stringify({ url, type: 'URL_UPDATED' })
    },
    serviceAccountJson,
    ['https://www.googleapis.com/auth/indexing']
  );
}

export async function inspectUrlIndexStatus(url, siteUrl, serviceAccountJson) {
  const resolvedSiteUrl = resolveInspectionSiteUrl(url, siteUrl);

  return authorizedFetch(
    'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
    {
      method: 'POST',
      body: JSON.stringify({
        inspectionUrl: url,
        siteUrl: resolvedSiteUrl,
        languageCode: 'zh-CN'
      })
    },
    serviceAccountJson,
    ['https://www.googleapis.com/auth/webmasters.readonly']
  );
}

export async function runGoogleApiTest({ type, url, siteUrl, serviceAccountJson }) {
  const logs = [];
  const log = (message, extra = null) => {
    logs.push({
      time: formatBeijingTime(),
      message,
      extra
    });
  };

  try {
    if (!url) {
      throw new Error('URL is required');
    }

    const scopes =
      type === 'inspection'
        ? ['https://www.googleapis.com/auth/webmasters.readonly']
        : ['https://www.googleapis.com/auth/indexing'];

    log('Test started', { type, url });

    let credentials;
    try {
      credentials = JSON.parse(serviceAccountJson || '');
      log('Service Account JSON parsed', {
        clientEmail: credentials.client_email || '',
        projectId: credentials.project_id || ''
      });
    } catch {
      throw new Error('Service Account JSON is invalid');
    }

    if (type === 'inspection') {
      const configuredSiteUrls = parseConfiguredSiteUrls(siteUrl);
      if (!configuredSiteUrls.length) {
        throw new Error('GSC Site URL is missing');
      }
      const resolvedSiteUrl = resolveInspectionSiteUrl(url, siteUrl);
      log('GSC Site URL resolved', {
        configuredSiteUrls,
        resolvedSiteUrl
      });
    }

    const auth = new GoogleAuth({ credentials, scopes });
    log('Requesting Google access token', { scopes });
    let token;
    try {
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
    } catch (error) {
      throw normalizeGoogleError(error);
    }

    if (!token) {
      throw new Error('Failed to get Google access token');
    }

    log('Access token received', {
      tokenPreview: `${token.slice(0, 18)}...`
    });

    const requestUrl =
      type === 'inspection'
        ? 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect'
        : 'https://indexing.googleapis.com/v3/urlNotifications:publish';

    const requestBody =
      type === 'inspection'
        ? {
            inspectionUrl: url,
            siteUrl: resolveInspectionSiteUrl(url, siteUrl),
            languageCode: 'zh-CN'
          }
        : {
            url,
            type: 'URL_UPDATED'
          };

    log('Calling Google API', { requestUrl, requestBody });

    let response;
    try {
      response = await fetch(requestUrl, {
        method: 'POST',
        signal: buildTimeoutSignal(),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      throw normalizeGoogleError(error);
    }

    const rawText = await response.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { rawText };
    }

    log('Google API responded', {
      status: response.status,
      ok: response.ok,
      data
    });

    if (!response.ok) {
      throw createProxyResponseError(response.status, data);
    }

    log('Test finished', { success: true });
    return {
      success: true,
      logs,
      data
    };
  } catch (rawError) {
    const error = normalizeGoogleError(rawError);
    log('Test failed', {
      message: error.message,
      code: error.code || null,
      causeMessage: error.causeMessage || null,
      status: error.status || null,
      responseData: error.responseData || null
    });
    return {
      success: false,
      logs,
      error: {
        message: error.message,
        status: error.status || null,
        responseData: error.responseData || null
      }
    };
  }
}
