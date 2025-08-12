export const SCRAPE_HTML_PAGE_URL = [
	'https://www.brandA.com/us/p/product.html',
	'https://www.brandB.com/us/p/product.html',
];
export const IMAGE_SITEMAP_URLS = [
	'https://www.brandA.com/us/image_sitemap_0.xml',
	'https://www.brandB.com/us/image_sitemap_0.xml',
];

export enum ClientHosts {
	BRAND_A = 'www.brandA.com',
	BRAND_B = 'www.brandB.com',
}

export const FONTS = {
	[ClientHosts.BRAND_A]: [
		'<https://www.brandA.com/on/demandware.static/Sites-Name-Site/-/en_US/fonts/font2.woff2>;rel=preload;as=font;crossorigin;type=font/woff2',
	],
	[ClientHosts.BRAND_B]: [
		'<https://www.brandB.com/on/demandware.static/Sites-Name-Site/-/en_US/fonts/font1.woff2>;rel=preload;as=font;crossorigin;type=font/woff2',
	],
};

export const IMAGE_HINT_QUERY_STRINGS = {
	[ClientHosts.BRAND_A]: '?sw=740&sh=1110',
	[ClientHosts.BRAND_B]: '?sw=1280&sh=1920',
};

export const KEY_REFRESH_INTERVAL = 1000 * 60 * 60; // 1 hour

export const HARPER_USER_AGENT = 'HarperBot/1.0 (+https://harpersystems.dev) EarlyHints-Scraper Linode-Akamai';

export enum AllowedUserRoles {
	SUPER_USER = 'super_user',
	READ_ONLY = 'hints_read_only',
}
