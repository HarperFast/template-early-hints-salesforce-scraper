# Early Hints Application with Salesforce Backend Scraper

## Overview

This Harper application is designed for ecommerce sites leveraging a Salesforce backend to provide **Early Hints** for key assets including:

- Main product images
- JS and CSS file dependencies
- Fonts

All assets are served via a CDN with URLs containing a version hash that may change multiple times per day. To ensure these hints are always accurate, this application scrapes the site **hourly** to retrieve and update the version hashs.

The application is designed to be able to handle hints accross multiple 

### Scraping Strategy by Asset Type

- **Main Product Images**:  
  Fetched by downloading and parsing an **image sitemap XML** file. This provides updated image URLs and their associated cache keys.

- **JS & CSS Files**:  
  Since these files are consistent across all pages, they are also extracted from an individual product page's HTML.

- **Fonts**:  
  Fonts generally do not have a changing version hash so they are hardcoded in the `/src/constants/index.ts` file, however, if needed, they can be scraped from the product page HTML as well and included in the files table.

This update cycle is handled by a background process.

The component exposes a **single API endpoint** that accepts a page URL and returns the relevant early hints for that page, including any CSS/JS, fonts and image assets.

## Getting Started

### Update Constants

The `/src/constants/index.ts` file contains various implementation specific constants that need to be updated before running the application, such as hostnames, desired font hints, and image hints url query parameters.

If no font hints are desired for a particular hostname, you can set the value for its key to an empty array.

### Scraper Updates

The HTML scraper in `/src/scraper/html.ts` is designed to extract the version hash for JS and CSS files from a product page. The regex in this file will need to be updated based on the structure of these asset URLs.

The XML scraper most likely will not need to be updated as the Salesforce sitemaps tend to be consistent, but if the structure of the image sitemap changes, you may need to adjust the parsing logic in `/src/scraper/xml.ts`.

The current expected XML structure is:

```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd http://www.google.com/schemas/sitemap-image/1.1 http://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd http://www.w3.org/1999/xhtml http://www.w3.org/2002/08/xhtml/xhtml1-strict.xsd">
	<url>
		<loc>https://www.hostname.com/us/p/product1.html</loc>
		<lastmod>2025-06-17T10:58:48+00:00</lastmod>
		<changefreq>daily</changefreq>
		<priority>1.0</priority>
		<image:image>
			<image:loc>https://hostname.net/dw/image/v2/BDRP_PRD/on/demandware.static/-/Sites-name/default/dwb8715417/images/100061261/100061261_06V_1920x2880.jpg?sw=1200&sh=1800</image:loc>
			<image:caption>text</image:caption>
			<image:title>text</image:title>
		</image:image>
		<image:image>
			<image:loc>https://hostname.net/dw/image/v2/BDRP_PRD/on/demandware.static/-/Sites-name/default/dw3da0d027/images/100061261/100061261_06V_alt1_1920x2880.jpg?sw=1200&sh=1800</image:loc>
			<image:caption>text</image:caption>
			<image:title>text</image:title>
		</image:image>
		...
	</url>
	...
</urlset>
```

### Runnning locally

1. `git clone https://github.com/HarperFast/template-early-hints-salesforce-scraper.git`
2. `cd template-early-hints-salesforce-scraper`
3. `npm install`
4. `npm run build`
5. `harper run .`

This assumes you have Harper installed. [Install Harper](https://docs.harperdb.io/docs/deployments/install-harperdb) globally.

### Deployement

The component can be installed using [Harper's Operation API](https://docs.harperdb.io/docs/developers/operations-api/components).

i.e.

`POST https://harper-server.com:9925`

```json
{
	"operation": "deploy_component",
	"project": "early-hints",
	"package": "git+ssh://git@github.com:HarperFast/template-early-hints-salesforce-scraper.git#semver:v1.0.0",
	"replicated": true,
	"restart": true
}
```

### Seeding Database with Files

The files table needs to be seeded with the desired file hints. The `files-seed.example.json` contains an example of how this data should be structured. Use the [Operations API Upsert command](https://docs.harperdb.io/docs/developers/operations-api/nosql-operations#body-2) with the json array of data to seed.

i.e.

```json
{
    "operation": "upsert",
    "database": "EarlyHints",
    "table": "Files",
    "records": [
        {
			"fileName": "/lib/jquery/jquery-3.7.1.min.js",
			"urlPrefix": "https://www.site.com/on/demandware.static/Web-Site/-/default/",
			"type": "JS"
		},
	    ...
    ]
}
```

## Usage

### Endpoints

| Endpoint           | Description                                                     | Query Parameters           |
| ------------------ | --------------------------------------------------------------- | -------------------------- |
| `/hints`           | Supports GET request to return early hints for a given page URL | `q` = full URL of the page |
| `/file-cache-keys` | Direct REST interface for the FileCacheKeys table               |                            |
| `/files`           | Direct REST interface for the Files table                       |                            |
| `/product-images`  | Direct REST interface for the ProductImages table               |                            |

The Harper REST API gives low level control over your data. The last two endpoints are component level and provide higher level functionality. The first is direct access to Harper's REST API. For a full description of what the REST API can do and how to use if your can refer to its [documentation](https://docs.harperdb.io/docs/developers/rest).
This REST interface for the various tables can be used to manually manipulate the data. See the [Data Model](#data-model) section below for details on the structure of each table.

### Example Request

```
GET /hints?q=https://www.website.com/example.html
```

### Example Response

```json
"<https://cdn.site.com/styles/main.css?v=abc123>;rel=preload;as=style,<https://cdn.site.com/scripts/main.js?v=def456>;rel=preload;as=script,<https://cdn.site.com/images/product123.jpg?v=ghi789>;rel=preload;as=image"
```

## Data Model

### FileCacheKeys Table

| Name   | Type                     | Description                                        |
| ------ | ------------------------ | -------------------------------------------------- |
| `key`  | String                   | Cache key used in file URLs                        |
| `host` | String **(Primary Key)** | Domain host of the asset, also acts as primary key |

### Files Table

| Name        | Type                     | Description                                            |
| ----------- | ------------------------ | ------------------------------------------------------ |
| `fileName`  | String **(Primary Key)** | Path of the JS or CSS file                             |
| `urlPrefix` | String **(Indexed)**     | Url from start up until the variable cache key portion |
| `type`      | Enum (JS / CSS)          | File type                                              |

### ProductImages Table

| Name      | Type                     | Description                                      |
| --------- | ------------------------ | ------------------------------------------------ |
| `pageUrl` | String **(Primary Key)** | Page the product image is found on               |
| `hint`    | String                   | Main product image url to be sent as early hints |

## Edgeworker

The **edgeworker** acts as a forwarder for hint generation. It takes the client's original URL request and sends it to Harper via GTM to the `/hints` endpoint. The response from Harper (an array of hint strings) is then used to set the `PMUSER_103_HINTS` variable.

This variable is interpreted by the CDN edge layer to emit a `103 Early Hints` response, allowing browsers to start fetching assets before the main HTML payload arrives.

The variable has a max character length of 1024. Exceeding this limit will result in the edgeworker returning an error.
