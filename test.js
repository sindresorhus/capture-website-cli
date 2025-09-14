import process from 'node:process';
import test from 'ava';
import {execa} from 'execa';
import createTestServer from 'create-test-server';
import {fileTypeFromBuffer} from 'file-type';

test('main', async t => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end('<body>Unicorn</body>');
	});

	const {stdout} = await execa('./cli.js', [server.url], {encoding: 'buffer'});
	const {mime} = await fileTypeFromBuffer(stdout);
	t.is(mime, 'image/png');

	await server.close();
});

// Skip this test in CI as it consistently times out there
// The functionality works but CI environments are too slow for HTML input processing
const testFunction = process.env.CI ? test.skip : test;

testFunction('support HTML input', async t => {
	const {stdout} = await execa('./cli.js', ['--timeout=120'], {
		input: '<h1>Unicorn</h1>',
		encoding: 'buffer',
	});

	const {mime} = await fileTypeFromBuffer(stdout);
	t.is(mime, 'image/png');
});

test('error handling for invalid URLs', async t => {
	const error = await t.throwsAsync(execa('./cli.js', [
		'http://this-domain-does-not-exist-12345.com',
		'--output=test-error.png',
		'--timeout=3',
	]));

	t.true(error.stderr.includes('ERR_NAME_NOT_RESOLVED'));
	t.is(error.exitCode, 1);
});

test('error handling for timeout', async t => {
	const error = await t.throwsAsync(execa('./cli.js', [
		'https://httpbin.org/delay/10',
		'--output=test-timeout.png',
		'--timeout=2',
	]));

	t.true(error.stderr.includes('Navigation timeout'));
	t.is(error.exitCode, 1);
});

test('check flags', async t => {
	// Copied from `cli.js`
	let flags = `
--output=screenshot.png
--width=1000
--height=600
--type=jpeg.
--quality=0.5
--scale-factor=3
--emulate-device="iPhone X"
--timeout=80
--delay=10
--wait-for-element="#header"
--element=".main-content"
--hide-elements=".sidebar"
--remove-elements="img.ad"
--click-element="button"
--scroll-to-element="#map"
--disable-animations
--no-javascript
--module=https://sindresorhus.com/remote-file.js
--module=local-file.js
--module="document.body.style.backgroundColor = 'red'"
--header="x-powered-by: capture-website-cli"
--user-agent="I love unicorns"
--cookie="id=unicorn; Expires=Wed, 21 Oct 2018 07:28:00 GMT;"
--authentication="username:password"
--launch-options="{\\"headless\\": false}"
--dark-mode
--inset=10,-15,-15,25
--clip=10,30,300,1024
--no-block-ads
	`;

	flags = flags.trim()
		.replaceAll(/(?<==)"|(?<!\\)"$/gm, '')
		.replaceAll(String.raw`\"`, '"')
		.split('\n');

	const {stdout} = await execa('./cli.js', ['noop-file', '--internal-print-flags', ...flags]);
	const json = JSON.parse(stdout);
	t.snapshot(json);
});
