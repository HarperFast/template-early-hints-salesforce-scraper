import { logger, server } from 'harper';
import { runContinuousScraperJob } from '../scraper/index.js';
import { GetHints } from './hints.js';

if (server.workerIndex === 0) {
	logger.info('Running key refresh scraper...');
	runContinuousScraperJob();
}

export const hints = GetHints;
