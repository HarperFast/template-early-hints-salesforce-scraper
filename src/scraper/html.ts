import { databases, logger } from 'harperdb';
import { HARPER_USER_AGENT } from '../constants/index.js';

const { FileCacheKeys: FileCacheKeysTable } = databases.EarlyHints;

/**
 * Fetches the an page HTML and extracts cache keys for js/css files
 *
 * All JS/CSS file dependancies use the same version hash. This function locates
 * the first file matching the url prefix and ending with .css or .js, and extracts
 * the version hash from the URL.
 */
export const fetchCacheKeysFromHTML = async (pageUrl: string) => {
	logger.info('Fetching an page HTML to extract cache keys');

	const resp = await fetch(pageUrl, {
		headers: {
			'User-Agent': HARPER_USER_AGENT,
		},
	});
	const html = await resp.text();

	// Regex to extract the asset version for js/css files
	const regex = /Sites-Name-Site\/-\/en_US\/([^/]+)\//;

	const assetMatch = regex.exec(html);
	const assetHash = assetMatch ? assetMatch[1] : null;

	FileCacheKeysTable.put(new URL(pageUrl).hostname, {
		key: assetHash,
	});
};
