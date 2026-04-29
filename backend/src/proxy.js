import { ProxyAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { config } from './config.js';

let proxyInitialized = false;

export function ensureProxyDispatcher() {
    if (proxyInitialized) {
        return getGlobalDispatcher();
    }

    const proxyUrl = config.httpsProxy || config.httpProxy;
    if (proxyUrl) {
        process.env.HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || proxyUrl;
        process.env.HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy || proxyUrl;
        if (config.noProxy) {
            process.env.NO_PROXY = process.env.NO_PROXY || process.env.no_proxy || config.noProxy;
        }
        setGlobalDispatcher(new ProxyAgent(proxyUrl));
        console.log(`Proxy enabled for outbound requests: ${proxyUrl}`);
    }

    proxyInitialized = true;
    return getGlobalDispatcher();
}
