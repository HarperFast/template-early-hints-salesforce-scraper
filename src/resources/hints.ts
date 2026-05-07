import { Resource, databases } from 'harper';
import { FileType, ProductImages } from '../types/graphql.js';
import type { User } from '../types/index.js';
import { AllowedUserRoles, ClientHosts, FONTS, IMAGE_HINT_QUERY_STRINGS } from '../constants/index.js';

const {
	ProductImages: ProductImagesTable,
	FileCacheKeys: FileCacheKeysTable,
	Files: FilesTable,
} = databases.EarlyHints;

const getProductImages = async (url: URL): Promise<string[]> => {
	const result: ProductImages = await ProductImagesTable.get({ id: url.href, select: ['hints'] });

	if (!result?.hints) {
		return [];
	}

	const queryString = IMAGE_HINT_QUERY_STRINGS[url.hostname as ClientHosts];

	return result.hints.map((image) => `<${image}${queryString}>;rel=preload;as=image;crossorigin`);
};

const getFiles = async (url: URL): Promise<string[]> => {
	const commonCacheKeyQuery = FileCacheKeysTable.get({ id: url.hostname, select: ['key'] });

	const filesQuery = FilesTable.get({
		conditions: [
			{
				attribute: 'urlPrefix',
				comparator: 'starts_with',
				value: `https://${url.hostname}`,
			},
		],
		select: ['fileName', 'urlPrefix', 'type'],
	});

	const [commonCacheKey, fileResults] = await Promise.all([commonCacheKeyQuery, filesQuery]);

	const hints: string[] = FONTS[url.hostname as ClientHosts];

	for await (const file of fileResults) {
		hints.push(
			`<${file.urlPrefix}${commonCacheKey.key}${file.fileName}>;rel=preload;as=${file.type === FileType.Js ? 'script' : 'style'};crossorigin`
		);
	}

	return hints;
};

export class GetHints extends Resource {
	allowRead(user: User) {
		return user?.role?.id === AllowedUserRoles.SUPER_USER || user?.role?.id === AllowedUserRoles.READ_ONLY;
	}

	async get(query: { url: string }) {
		const url = new URLSearchParams(query.url).get('q');

		if (!url) {
			return {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
				data: { error: 'Missing URL in "q" query parameter' },
			};
		}

		const urlObject = new URL(url);

		const [productImages, files] = await Promise.all([getProductImages(urlObject), getFiles(urlObject)]);
		const earlyHints = productImages.length ? [...productImages, ...files].join(',') : files.join(',');

		return { status: 200, headers: { 'Content-Type': 'application/json' }, data: earlyHints };
	}
}
