import { fetchCacheKeysFromSitemap } from './xml.js';
import { fetchCacheKeysFromHTML } from './html.js';
import { IMAGE_SITEMAP_URLS, KEY_REFRESH_INTERVAL, SCRAPE_HTML_PAGE_URL } from '../constants/index.js';
import { logger } from 'harperdb';

export const runContinuousScraperJob = async () => {
	const runJob = async () => {
		IMAGE_SITEMAP_URLS.forEach((url) => {
			logger.info(`Fetching image sitemap from ${url}`);
			fetchCacheKeysFromSitemap(url);
		});
		SCRAPE_HTML_PAGE_URL.forEach((url) => {
			logger.info(`Fetching HTML page from ${url}`);
			fetchCacheKeysFromHTML(url);
		});
	};

	setInterval(runJob, KEY_REFRESH_INTERVAL);

	runJob();
};
