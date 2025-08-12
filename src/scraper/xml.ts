import { databases, logger } from 'harperdb';
import { XMLParser } from 'fast-xml-parser';
import type { ParsedSitemap, ParsedUrl } from '../types/xmlParser.js';
import { HARPER_USER_AGENT } from '../constants/index.js';

const { ProductImages: ProductImagesTable } = databases.EarlyHints;

/**
 * Converts fetched page url to image urls map into json object for storing
 * in ProductImages table. Stores array of image urls with the pageUrl as
 * primary key.
 */
export const fetchCacheKeysFromSitemap = async (xmlUrl: string) => {
	const imageMap = await parseImageSitemap(xmlUrl);
	const xmlUrlObj = new URL(xmlUrl);

	for (const [pageUrl, imageUrls] of Object.entries(imageMap)) {
		ProductImagesTable.put(pageUrl, {
			hints: convertToImageServiceUrl(imageUrls, xmlUrlObj),
		});
	}
};

/**
 * Parses the image sitemap XML from client website and extracts image URLs associated with each page.
 *
 * @returns A map where keys are page URLs and values are arrays of image URLs on that page.
 */
const parseImageSitemap = async (url: string): Promise<Record<string, string[]>> => {
	logger.info(`Fetching image sitemap from ${url}`);

	const resp = await fetch(url, {
		headers: {
			'User-Agent': HARPER_USER_AGENT,
		},
	});

	const xmlData = await resp.text();

	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		ignoreDeclaration: true,
		parseTagValue: true,
		removeNSPrefix: false,
	});

	const parsed: ParsedSitemap = parser.parse(xmlData);

	const urlEntries = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];

	const resultMap: Record<string, string[]> = {};

	for (const entry of urlEntries) {
		const loc = entry.loc;
		resultMap[loc] = getImagesFromUrlEntries(entry);
	}

	return resultMap;
};

const getImagesFromUrlEntries = (entry: ParsedUrl): string[] => {
	const images: string[] = [];

	if (entry['image:image']) {
		const imageEntries = Array.isArray(entry['image:image']) ? entry['image:image'] : [entry['image:image']];

		for (const image of imageEntries) {
			if (image['image:loc']) {
				images.push(image['image:loc']);
			}

			// Take the first two images per page
			if (images.length > 1) {
				break;
			}
		}
	}

	return images;
};

/**
 * Converts url from demandware host to site host and removes query string.
 */
const convertToImageServiceUrl = (imageUrls: string[], xmlUrl: URL): string[] =>
	imageUrls.map((imageUrl) => {
		const urlObj = new URL(imageUrl);

		urlObj.hostname = xmlUrl.hostname;
		urlObj.search = '';

		return urlObj.toString();
	});
