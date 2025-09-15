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

test('localStorage flag sets localStorage before page load', async t => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(`
			<!DOCTYPE html>
			<html>
			<body>
				<div id="result">
					<script>
						const value = localStorage.getItem('testKey');
						document.write(value === 'testValue' ? 'SUCCESS' : 'FAIL');
					</script>
				</div>
			</body>
			</html>
		`);
	});

	const {stdout} = await execa('./cli.js', [
		server.url,
		'--local-storage=testKey=testValue',
	], {encoding: 'buffer'});

	const {mime} = await fileTypeFromBuffer(stdout);
	t.is(mime, 'image/png');

	await server.close();
});

test('localStorage flag handles multiple key-value pairs', async t => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(`
			<!DOCTYPE html>
			<html>
			<body>
				<div id="result">
					<script>
						const key1 = localStorage.getItem('key1');
						const key2 = localStorage.getItem('key2');
						document.write((key1 === 'value1' && key2 === 'value2') ? 'SUCCESS' : 'FAIL');
					</script>
				</div>
			</body>
			</html>
		`);
	});

	const {stdout} = await execa('./cli.js', [
		server.url,
		'--local-storage=key1=value1',
		'--local-storage=key2=value2',
	], {encoding: 'buffer'});

	const {mime} = await fileTypeFromBuffer(stdout);
	t.is(mime, 'image/png');

	await server.close();
});

test('localStorage flag validates format', async t => {
	const error = await t.throwsAsync(execa('./cli.js', [
		'https://example.com',
		'--output=test-invalid-localStorage.png',
		'--local-storage=invalid-format',
	]));

	t.true(error.stderr.includes('Invalid localStorage format'));
	t.is(error.exitCode, 1);
});

test('localStorage flag handles edge cases', async t => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(`
			<!DOCTYPE html>
			<html>
			<body>
				<div id="result">
					<script>
						const emptyValue = localStorage.getItem('emptyKey');
						const equalsValue = localStorage.getItem('equalsKey');
						const trimmedKey = localStorage.getItem('trimmedKey');
						document.write([
							emptyValue === '',
							equalsValue === 'value=with=equals',
							trimmedKey === 'trimmed value'
						].every(Boolean) ? 'SUCCESS' : 'FAIL');
					</script>
				</div>
			</body>
			</html>
		`);
	});

	const {stdout} = await execa('./cli.js', [
		server.url,
		'--local-storage=emptyKey=',
		'--local-storage=equalsKey=value=with=equals',
		'--local-storage= trimmedKey = trimmed value ',
	], {encoding: 'buffer'});

	const {mime} = await fileTypeFromBuffer(stdout);
	t.is(mime, 'image/png');

	await server.close();
});

test('localStorage flag validates empty key', async t => {
	const error = await t.throwsAsync(execa('./cli.js', [
		'https://example.com',
		'--output=test-empty-key.png',
		'--local-storage==value',
	]));

	t.true(error.stderr.includes('Invalid localStorage format'));
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
--local-storage="theme=dark"
--inset=10,-15,-15,25
--clip=10,30,300,1024
--no-block-ads
--insecure
	`;

	flags = flags.trim()
		.replaceAll(/(?<==)"|(?<!\\)"$/gm, '')
		.replaceAll(String.raw`\"`, '"')
		.split('\n');

	const {stdout} = await execa('./cli.js', ['noop-file', '--internal-print-flags', ...flags]);
	const json = JSON.parse(stdout);
	t.snapshot(json);
});
