import { httpRequest } from 'http-request';
import { logger } from 'log';

const PMUSER_103_HINTS = 'PMUSER_103_HINTS';
const SUBREQUEST_BASE_URL = '';
const HARPER_TOKEN = '';

export async function onClientRequest(request) {
	try {
		const url = `https://${SUBREQUEST_BASE_URL}/hints?q=${request.scheme}://${request.host}${request.path}`;
		const requestHeaders = {
			'Authorization': `Basic ${HARPER_TOKEN}`,
			'Content-Type': 'application/json',
		};
		const options = {
			timeout: 250,
			method: 'GET',
			headers: requestHeaders,
		};
		const response = await httpRequest(url, options);

		if (response.status == 200) {
			const data = await response.text();
			request.setVariable(PMUSER_103_HINTS, data);
		}
	} catch (exception) {
		logger.log(`Error occured while calling HDB: ${exception.message}`);
	}
}
