import {
	rmSync,
	mkdirSync,
	writeFileSync,
	existsSync,
} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'ava';
import {execa} from 'execa';
import createTestServer from 'create-test-server';
import {fileTypeFromBuffer} from 'file-type';

const cliPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cli.js');

function createHtmlPage(bodyContent) {
	return `
		<!doctype html>
		<html>
		<body>
			${bodyContent}
		</body>
		</html>
	`;
}

function setupTestDir(t) {
	const testDir = path.join('test-temp', `test-${Math.random().toString(36).slice(2)}`);
	mkdirSync(testDir, {recursive: true});
	t.teardown(() => rmSync(testDir, {recursive: true, force: true}));
	return testDir;
}

test('main', async t => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(createHtmlPage('Unicorn'));
	});

	const {stdout} = await execa(cliPath, [server.url], {encoding: 'buffer'});
	const {mime} = await fileTypeFromBuffer(stdout);
	t.is(mime, 'image/png');

	await server.close();
});

test('support HTML input', async t => {
	const {stdout} = await execa(cliPath, ['--timeout=60'], {
		input: '<h1>Unicorn</h1>',
		encoding: 'buffer',
	});

	const {mime} = await fileTypeFromBuffer(stdout);
	t.is(mime, 'image/png');
});

test('error handling for invalid URLs', async t => {
	const testDir = setupTestDir(t);
	const outputFile = path.join(testDir, 'test-error.png');

	const error = await t.throwsAsync(execa(cliPath, [
		'http://this-domain-does-not-exist-12345.com',
		`--output=${outputFile}`,
		'--timeout=3',
	]));

	t.true(error.stderr.includes('ERR_NAME_NOT_RESOLVED'));
	t.is(error.exitCode, 1);
});

test('error handling for timeout', async t => {
	const testDir = setupTestDir(t);
	const outputFile = path.join(testDir, 'test-timeout.png');

	const error = await t.throwsAsync(execa(cliPath, [
		'https://httpbin.org/delay/30',
		`--output=${outputFile}`,
		'--timeout=1',
	]));

	t.true(error.stderr.includes('Navigation timeout') || error.stderr.includes('timeout'));
	t.is(error.exitCode, 1);
});

test('localStorage flag sets localStorage before page load', async t => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(createHtmlPage(`
			<div id="result">
				<script>
					const value = localStorage.getItem('testKey');
					document.write(value === 'testValue' ? 'SUCCESS' : 'FAIL');
				</script>
			</div>
		`));
	});

	const {stdout} = await execa(cliPath, [
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
		response.end(createHtmlPage(`
			<div id="result">
				<script>
					const key1 = localStorage.getItem('key1');
					const key2 = localStorage.getItem('key2');
					document.write((key1 === 'value1' && key2 === 'value2') ? 'SUCCESS' : 'FAIL');
				</script>
			</div>
		`));
	});

	const {stdout} = await execa(cliPath, [
		server.url,
		'--local-storage=key1=value1',
		'--local-storage=key2=value2',
	], {encoding: 'buffer'});

	const {mime} = await fileTypeFromBuffer(stdout);
	t.is(mime, 'image/png');

	await server.close();
});

test('localStorage flag validates format', async t => {
	const testDir = setupTestDir(t);
	const outputFile = path.join(testDir, 'test-invalid-localStorage.png');

	const error = await t.throwsAsync(execa(cliPath, [
		'https://example.com',
		`--output=${outputFile}`,
		'--local-storage=invalid-format',
	]));

	t.true(error.stderr.includes('Invalid localStorage format'));
	t.is(error.exitCode, 1);
});

test('localStorage flag handles edge cases', async t => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(createHtmlPage(`
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
		`));
	});

	const {stdout} = await execa(cliPath, [
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
	const testDir = setupTestDir(t);
	const outputFile = path.join(testDir, 'test-empty-key.png');

	const error = await t.throwsAsync(execa(cliPath, [
		'https://example.com',
		`--output=${outputFile}`,
		'--local-storage==value',
	]));

	t.true(error.stderr.includes('Invalid localStorage format'));
	t.is(error.exitCode, 1);
});

test('wait-for-element flag works correctly', async t => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(createHtmlPage(`
			<div id="loading">Loading...</div>
			<script>
				setTimeout(() => {
					const div = document.createElement('div');
					div.id = 'ready';
					div.textContent = 'Ready!';
					document.body.appendChild(div);
				}, 1000);
			</script>
		`));
	});

	const {stdout} = await execa(cliPath, [
		server.url,
		'--wait-for-element=#ready',
		'--timeout=10',
	], {encoding: 'buffer'});

	const {mime} = await fileTypeFromBuffer(stdout);
	t.is(mime, 'image/png');

	await server.close();
});

test('auto-output flag generates filenames', async t => {
	const testDir = setupTestDir(t);

	// Test with file path
	const inputFile = path.join(testDir, 'test-auto-input.html');
	const outputFile = path.join(testDir, 'test-auto-input.png');
	writeFileSync(inputFile, '<h1>Test</h1>');
	await execa(cliPath, ['test-auto-input.html', '--auto-output'], {
		cwd: testDir,
	});
	t.true(existsSync(outputFile));

	// Test with stdin
	const screenshotFile = path.join(testDir, 'screenshot.png');
	await execa(cliPath, ['--auto-output'], {
		input: '<h1>Test from stdin</h1>',
		cwd: testDir,
	});
	t.true(existsSync(screenshotFile));
});

test('output flag takes precedence over auto-output', async t => {
	const testDir = setupTestDir(t);

	await execa(cliPath, ['https://example.com', '--auto-output', '--output=custom.png', '--timeout=10'], {
		cwd: testDir,
	});
	t.true(existsSync(path.join(testDir, 'custom.png')));
});

test('auto-output respects file type', async t => {
	const testDir = setupTestDir(t);
	const jpegFile = path.join(testDir, 'example.com.jpeg');

	await execa(cliPath, ['https://example.com', '--auto-output', '--type=jpeg', '--timeout=10'], {
		cwd: testDir,
	});
	t.true(existsSync(jpegFile));
});

test('auto-output flag increments filename if file exists', async t => {
	const testDir = setupTestDir(t);
	const firstFile = path.join(testDir, 'example.com.png');
	const secondFile = path.join(testDir, 'example.com (1).png');

	// Create first file
	await execa(cliPath, ['https://example.com', '--auto-output', '--timeout=10'], {
		cwd: testDir,
	});
	t.true(existsSync(firstFile));

	// Create second file (should increment)
	await execa(cliPath, ['https://example.com', '--auto-output', '--timeout=10'], {
		cwd: testDir,
	});
	t.true(existsSync(secondFile));
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
--auto-output
	`;

	flags = flags.trim()
		.replaceAll(/(?<==)"|(?<!\\)"$/gm, '')
		.replaceAll(String.raw`\"`, '"')
		.split('\n');

	const {stdout} = await execa(cliPath, ['noop-file', '--internal-print-flags', ...flags]);
	const json = JSON.parse(stdout);
	t.snapshot(json);
});
