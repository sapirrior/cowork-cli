import { lookup } from 'node:dns/promises';
import { URL } from 'node:url';
import ipaddr from 'ipaddr.js';

const MAX_CHARS = 15000;
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;

/**
 * Checks if a hostname resolves to a private or reserved IP address.
 */
async function validateUrlSafety(url) {
  try {
    const parsedUrl = new URL(url);
    
    // Enforce protocol
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
    }

    const hostname = parsedUrl.hostname;

    // Resolve hostname to IP addresses
    // This also handles cases where hostname is already an IP address
    const addresses = await lookup(hostname, { all: true });

    if (addresses.length === 0) {
      throw new Error(`Could not resolve hostname: ${hostname}`);
    }

    for (const addr of addresses) {
      if (!ipaddr.isValid(addr.address)) continue;
      
      const parsedAddr = ipaddr.parse(addr.address);
      let addrToTest = parsedAddr;
      
      // IPv4-mapped IPv6 handling
      if (parsedAddr instanceof ipaddr.IPv6 && parsedAddr.isIPv4MappedAddress()) {
        addrToTest = parsedAddr.toIPv4Address();
      }

      // Check range
      const range = addrToTest.range();
      
      // We only allow 'unicast' for public internet access.
      // This blocks: 'private', 'loopback', 'linkLocal', 'multicast', 'reserved', etc.
      if (range !== 'unicast') {
        return { safe: false, reason: `Address ${addr.address} (${range}) is not allowed.` };
      }

      // Explicitly block IANA benchmark range (198.18.0.0/15)
      if (addrToTest instanceof ipaddr.IPv4) {
        const [benchmarkRange, mask] = ipaddr.parseCIDR('198.18.0.0/15');
        if (addrToTest.match(benchmarkRange, mask)) {
          return { safe: false, reason: `Address ${addr.address} is in a reserved benchmark range.` };
        }
      }
    }
    return { safe: true };
  } catch (err) {
    throw new Error(`Safety validation failed: ${err.message}`);
  }
}

/**
 * webFetch tool implementation.
 * Hardened with manual redirect following and SSRF protection at every hop.
 */
export default async function webFetch({ url }) {
  let currentUrl = url;
  let redirectCount = 0;

  try {
    while (redirectCount <= MAX_REDIRECTS) {
      // 1. Safety Check for the current hop
      const validation = await validateUrlSafety(currentUrl);
      if (!validation.safe) {
        throw new Error(`SSRF Protection: ${validation.reason}`);
      }

      // 2. Fetch with Timeout and manual redirect handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(currentUrl, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'manual', // We handle redirects manually for safety
        headers: {
          'User-Agent': 'cowork-cli/0.1 (Analyst Tool; SSRF-Protected)',
          'Accept': 'text/html,application/xhtml+xml,application/json,text/plain'
        }
      });

      clearTimeout(timeoutId);

      // 3. Handle Redirects
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new Error(`Redirect status ${response.status} received without Location header.`);
        }
        
        // Resolve relative redirects
        currentUrl = new URL(location, currentUrl).href;
        redirectCount++;
        continue; 
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 4. Process Response
      let text = await response.text();
      const contentType = response.headers.get('content-type') || '';

      // 5. HTML Stripping (Aggressive for context awareness)
      if (contentType.includes('text/html')) {
        text = text
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
          .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
          .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
          .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } else if (contentType.includes('application/json')) {
        try {
          text = JSON.stringify(JSON.parse(text), null, 2);
        } catch (e) {
          // Fallback to raw text if JSON parsing fails
        }
      }

      // 6. Context Awareness: Truncation
      if (text.length > MAX_CHARS) {
        text = text.slice(0, MAX_CHARS) + "\n\n[Warning: Output truncated to fit context limits]";
      }

      return text;
    }

    throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);

  } catch (err) {
    if (err.name === 'AbortError') {
      return `Error: Request timed out after ${TIMEOUT_MS}ms`;
    }
    return `Error: ${err.message}`;
  }
}
