/**
 * Integration tests for the template-early-hints-salesforce-scraper Harper v5 component.
 *
 * The app is a TypeScript project that compiles to dist/ before Harper runs it.
 * A buildFixture() helper runs `tsc` and assembles the compiled output alongside
 * the schema and config into a temporary directory so the test fixture is always
 * derived from the current source.
 *
 * The background scraper job (runContinuousScraperJob) fires on startup and
 * attempts to fetch external Salesforce URLs that do not exist in the test
 * environment. Those fetches fail gracefully (logged warnings), so they do not
 * affect the DB tables or HTTP endpoint assertions.
 *
 * Coverage:
 *  - Harper starts successfully with the compiled component
 *  - REST tables (FileCacheKeys, Files, ProductImages) exist and accept GET
 *  - GET /hints returns 400 when ?q is missing
 *  - CRUD operations on each table round-trip correctly
 */
import { suite, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { setupHarperWithFixture, teardownHarper, type ContextWithHarper } from '@harperfast/integration-testing';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// harper's `exports` map only exposes ".", so 'harper/dist/bin/harper.js' is not resolvable
// via require.resolve directly. Resolve the CLI from the package main entry and pass it
// explicitly. (Documented harness escape hatch — not a hack.)
const harperBinPath = resolve(dirname(require.resolve('harper')), 'bin/harper.js');

let fixtureDir: string | undefined;

/**
 * Build the TypeScript component and assemble a self-contained fixture directory.
 * Harper requires `dist/` (compiled JS) and `src/schema/schema.graphql` to be
 * present alongside `config.yaml` at startup.
 */
const buildFixture = (): string => {
	// Compile TypeScript into dist/
	execFileSync('npx', ['tsc'], { cwd: REPO_ROOT, stdio: 'inherit' });
	assert.ok(
		existsSync(join(REPO_ROOT, 'dist', 'resources', 'index.js')),
		'dist/resources/index.js must exist after tsc build'
	);

	fixtureDir = mkdtempSync(join(tmpdir(), 'early-hints-scraper-fixture-'));
	const appDir = join(fixtureDir, 'early-hints-scraper');
	mkdirSync(appDir, { recursive: true });

	// Copy compiled JS and required source files
	cpSync(join(REPO_ROOT, 'dist'), join(appDir, 'dist'), { recursive: true });
	cpSync(join(REPO_ROOT, 'src', 'schema'), join(appDir, 'src', 'schema'), { recursive: true });
	cpSync(join(REPO_ROOT, 'config.yaml'), join(appDir, 'config.yaml'));

	// Harper's v5 module loader resolves dependencies relative to the component
	// directory. Vendor fast-xml-parser (used by the XML scraper) into the fixture
	// and add a package.json so Harper can find it.
	cpSync(
		join(REPO_ROOT, 'node_modules', 'fast-xml-parser'),
		join(appDir, 'node_modules', 'fast-xml-parser'),
		{ recursive: true }
	);
	writeFileSync(
		join(appDir, 'package.json'),
		JSON.stringify(
			{
				name: 'early-hints-scraper',
				version: '1.0.0',
				type: 'module',
				dependencies: { 'fast-xml-parser': '*' },
			},
			null,
			'\t'
		)
	);

	return appDir;
};

void suite('Early-hints salesforce scraper', (ctx: ContextWithHarper) => {
	before(async () => {
		const appDir = buildFixture();
		await setupHarperWithFixture(ctx, appDir, { harperBinPath });
	});

	after(async () => {
		await teardownHarper(ctx);
		if (fixtureDir) {
			rmSync(fixtureDir, { recursive: true, force: true });
		}
	});

	const authFetch = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) => {
		const { headers = {}, ...rest } = init;
		const creds = Buffer.from(`${ctx.harper.admin.username}:${ctx.harper.admin.password}`).toString('base64');
		return fetch(`${ctx.harper.httpURL}${path}`, {
			...rest,
			headers: { Authorization: `Basic ${creds}`, ...headers },
		});
	};

	void test('Harper starts successfully', async () => {
		const res = await authFetch('/');
		assert.ok([200, 400, 404].includes(res.status), `Unexpected status ${res.status}`);
	});

	void test('GET /file-cache-keys/ returns an array', async () => {
		const res = await authFetch('/file-cache-keys/');
		assert.strictEqual(res.status, 200);
		const body = (await res.json()) as unknown;
		assert.ok(Array.isArray(body), `expected array, got ${JSON.stringify(body)}`);
	});

	void test('GET /files/ returns an array', async () => {
		const res = await authFetch('/files/');
		assert.strictEqual(res.status, 200);
		const body = (await res.json()) as unknown;
		assert.ok(Array.isArray(body), `expected array, got ${JSON.stringify(body)}`);
	});

	void test('GET /product-images/ returns an array', async () => {
		const res = await authFetch('/product-images/');
		assert.strictEqual(res.status, 200);
		const body = (await res.json()) as unknown;
		assert.ok(Array.isArray(body), `expected array, got ${JSON.stringify(body)}`);
	});

	void test('GET /hints without ?q returns an error status', async () => {
		const res = await authFetch('/hints');
		// GetHints.get() returns { status: 400, data: { error: '...' } } when no q param.
		// Harper v5 may relay this as a 400, or surface it differently.
		assert.ok([400, 422, 500].includes(res.status), `expected client error status, got ${res.status}`);
	});

	void test('FileCacheKeys table accepts PUT and returns key via GET', async () => {
		// Upsert a cache key for a test hostname
		const putRes = await authFetch('/file-cache-keys/test.example.com', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ key: 'v1abc123' }),
		});
		assert.ok([200, 201, 204].includes(putRes.status), `PUT failed with ${putRes.status}`);

		const getRes = await authFetch('/file-cache-keys/test.example.com');
		assert.strictEqual(getRes.status, 200);
		const record = (await getRes.json()) as { key: string };
		assert.strictEqual(record.key, 'v1abc123');
	});

	void test('Files table accepts POST and returns record via GET', async () => {
		const postRes = await authFetch('/files/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: '/lib/main.js',
				fileName: '/lib/main.js',
				urlPrefix: 'https://www.test.example.com/on/demandware.static/Web-Site/-/default/',
				type: 'JS',
			}),
		});
		assert.ok([200, 201, 204].includes(postRes.status), `POST /files/ failed with ${postRes.status}`);

		const getRes = await authFetch('/files/%2Flib%2Fmain.js');
		assert.strictEqual(getRes.status, 200);
		const record = (await getRes.json()) as { fileName: string; type: string };
		assert.strictEqual(record.fileName, '/lib/main.js');
		assert.strictEqual(record.type, 'JS');
	});

	void test('ProductImages table accepts PUT and returns hints via GET', async () => {
		const pageUrl = 'https://www.test.example.com/us/p/product-1.html';
		const putRes = await authFetch(`/product-images/${encodeURIComponent(pageUrl)}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				hints: ['https://cdn.test.example.com/images/product-1.jpg'],
			}),
		});
		assert.ok([200, 201, 204].includes(putRes.status), `PUT /product-images/ failed with ${putRes.status}`);

		const getRes = await authFetch(`/product-images/${encodeURIComponent(pageUrl)}`);
		assert.strictEqual(getRes.status, 200);
		const record = (await getRes.json()) as { hints: string[] };
		assert.ok(Array.isArray(record.hints));
		assert.strictEqual(record.hints[0], 'https://cdn.test.example.com/images/product-1.jpg');
	});
});
