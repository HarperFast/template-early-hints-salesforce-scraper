export interface ParsedImage {
	'image:loc': string;
}

export interface ParsedUrl {
	'loc': string;
	'image:image'?: ParsedImage | ParsedImage[];
}

export interface ParsedSitemap {
	urlset: {
		url: ParsedUrl[] | ParsedUrl;
	};
}
