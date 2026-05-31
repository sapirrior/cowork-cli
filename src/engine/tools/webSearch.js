import { parse } from 'node-html-parser';

const TIMEOUT_MS = 10000;
const MAX_RESULTS_HARD_LIMIT = 20;

/**
 * Searches the web using DuckDuckGo HTML (zero dependencies).
 * Extracts title, clean URL, and snippet summary.
 * 
 * @param {Object} args
 * @param {string} args.query - The search query.
 * @param {number} [args.limit=5] - Max results to return (max 20).
 * @returns {Promise<string>} JSON string of search results or error message.
 */
export default async function webSearch({ query, limit = 5 }) {
  if (!query) return "Error: Search query cannot be empty.";

  const maxLimit = Math.min(Math.max(1, limit), MAX_RESULTS_HARD_LIMIT);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: `q=${encodeURIComponent(query)}`
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const results = [];
    
    const root = parse(html);
    const resultNodes = root.querySelectorAll('.result__body');
    
    for (const node of resultNodes) {
      if (results.length >= maxLimit) break;
      
      const titleEl = node.querySelector('.result__title a');
      const snippetEl = node.querySelector('.result__snippet');
      
      if (titleEl && snippetEl) {
        const title = titleEl.textContent.replace(/\s+/g, ' ').trim();
        const snippet = snippetEl.textContent.replace(/\s+/g, ' ').trim();
        
        let url = titleEl.getAttribute('href') || '';
        if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
          url = decodeURIComponent(url.split('uddg=')[1].split('&')[0]);
        }
        
        results.push({ title, url, snippet });
      }
    }

    if (results.length === 0) {
      return "No results found.";
    }

    return JSON.stringify(results, null, 2);

  } catch (err) {
    if (err.name === 'AbortError') {
      return `Error: Request timed out after ${TIMEOUT_MS}ms`;
    }
    return `Error searching web: ${err.message}`;
  }
}
