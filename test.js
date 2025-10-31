import {
	rmSync,
	mkdirSync,
	writeFileSync,
	existsSync,
} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
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

function setupTestDirectory() {
	const testDirectory = path.join('test-temp', `test-${Math.random().toString(36).slice(2)}`);
	mkdirSync(testDirectory, {recursive: true});
	return testDirectory;
}

function cleanupTestDirectory(testDirectory) {
	if (existsSync(testDirectory)) {
		rmSync(testDirectory, {recursive: true, force: true});
	}
}

test('main', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(createHtmlPage('Unicorn'));
	});

	const {stdout} = await execa(cliPath, [server.url], {encoding: 'buffer'});
	const {mime} = await fileTypeFromBuffer(stdout);
	assert.equal(mime, 'image/png');

	await server.close();
});

test('support HTML input', async () => {
	const {stdout} = await execa(cliPath, ['--timeout=60'], {
		input: '<h1>Unicorn</h1>',
		encoding: 'buffer',
	});

	const {mime} = await fileTypeFromBuffer(stdout);
	assert.equal(mime, 'image/png');
});

test('error handling for invalid URLs', async () => {
	const testDirectory = setupTestDirectory();
	const outputFile = path.join(testDirectory, 'test-error.png');

	try {
		await assert.rejects(
			execa(cliPath, [
				'http://this-domain-does-not-exist-12345.com',
				`--output=${outputFile}`,
				'--timeout=3',
			]),
			error => {
				assert.ok(error.stderr.includes('ERR_NAME_NOT_RESOLVED'));
				assert.equal(error.exitCode, 1);
				return true;
			},
		);
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('error handling for timeout', async () => {
	const testDirectory = setupTestDirectory();
	const outputFile = path.join(testDirectory, 'test-timeout.png');

	try {
		await assert.rejects(
			execa(cliPath, [
				'https://httpbin.org/delay/30',
				`--output=${outputFile}`,
				'--timeout=1',
			]),
			error => {
				assert.ok(error.stderr.includes('Navigation timeout') || error.stderr.includes('timeout'));
				assert.equal(error.exitCode, 1);
				return true;
			},
		);
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('localStorage flag sets localStorage before page load', async () => {
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
	assert.equal(mime, 'image/png');

	await server.close();
});

test('localStorage flag handles multiple key-value pairs', async () => {
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
	assert.equal(mime, 'image/png');

	await server.close();
});

test('localStorage flag validates format', async () => {
	const testDirectory = setupTestDirectory();
	const outputFile = path.join(testDirectory, 'test-invalid-localStorage.png');

	try {
		await assert.rejects(
			execa(cliPath, [
				'https://example.com',
				`--output=${outputFile}`,
				'--local-storage=invalid-format',
			]),
			error => {
				assert.ok(error.stderr.includes('Invalid localStorage format'));
				assert.equal(error.exitCode, 1);
				return true;
			},
		);
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('localStorage flag handles edge cases', async () => {
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
	assert.equal(mime, 'image/png');

	await server.close();
});

test('localStorage flag validates empty key', async () => {
	const testDirectory = setupTestDirectory();
	const outputFile = path.join(testDirectory, 'test-empty-key.png');

	try {
		await assert.rejects(
			execa(cliPath, [
				'https://example.com',
				`--output=${outputFile}`,
				'--local-storage==value',
			]),
			error => {
				assert.ok(error.stderr.includes('Invalid localStorage format'));
				assert.equal(error.exitCode, 1);
				return true;
			},
		);
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('wait-for-element flag works correctly', async () => {
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
	assert.equal(mime, 'image/png');

	await server.close();
});

test('auto-output flag generates filenames', async () => {
	const testDirectory = setupTestDirectory();

	try {
		// Test with file path
		const inputFile = path.join(testDirectory, 'test-auto-input.html');
		const outputFile = path.join(testDirectory, 'test-auto-input.png');
		writeFileSync(inputFile, '<h1>Test</h1>');
		await execa(cliPath, ['test-auto-input.html', '--auto-output'], {
			cwd: testDirectory,
		});
		assert.ok(existsSync(outputFile));

		// Test with stdin
		const screenshotFile = path.join(testDirectory, 'screenshot.png');
		await execa(cliPath, ['--auto-output'], {
			input: '<h1>Test from stdin</h1>',
			cwd: testDirectory,
		});
		assert.ok(existsSync(screenshotFile));
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('output flag takes precedence over auto-output', async () => {
	const testDirectory = setupTestDirectory();

	try {
		await execa(cliPath, ['https://example.com', '--auto-output', '--output=custom.png', '--timeout=10'], {
			cwd: testDirectory,
		});
		assert.ok(existsSync(path.join(testDirectory, 'custom.png')));
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('auto-output respects file type', async () => {
	const testDirectory = setupTestDirectory();

	try {
		const jpegFile = path.join(testDirectory, 'example.com.jpeg');
		await execa(cliPath, ['https://example.com', '--auto-output', '--type=jpeg', '--timeout=10'], {
			cwd: testDirectory,
		});
		assert.ok(existsSync(jpegFile));
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('auto-output flag increments filename if file exists', async () => {
	const testDirectory = setupTestDirectory();

	try {
		const firstFile = path.join(testDirectory, 'example.com.png');
		const secondFile = path.join(testDirectory, 'example.com (1).png');

		// Create first file
		await execa(cliPath, ['https://example.com', '--auto-output', '--timeout=10'], {
			cwd: testDirectory,
		});
		assert.ok(existsSync(firstFile));

		// Create second file (should increment)
		await execa(cliPath, ['https://example.com', '--auto-output', '--timeout=10'], {
			cwd: testDirectory,
		});
		assert.ok(existsSync(secondFile));
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('check flags', async () => {
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

	// Verify the parsed flags structure
	const expected = {
		allowCors: false,
		authentication: {
			password: 'password',
			username: 'username',
		},
		autoOutput: true,
		blockAds: false,
		clickElement: 'button',
		clip: {
			height: 1024,
			width: 300,
			x: 10,
			y: 30,
		},
		cookies: [
			'id=unicorn; Expires=Wed, 21 Oct 2018 07:28:00 GMT;',
		],
		darkMode: true,
		debug: false,
		defaultBackground: false,
		delay: 10,
		disableAnimations: true,
		element: '.main-content',
		emulateDevice: 'iPhone X',
		fullPage: false,
		headers: {
			'x-powered-by': 'capture-website-cli',
		},
		height: 600,
		hideElements: [
			'.sidebar',
		],
		insecure: true,
		inset: {
			bottom: -15,
			left: 25,
			right: -15,
			top: 10,
		},
		internalPrintFlags: true,
		isJavaScriptEnabled: false,
		javascript: false,
		launchOptions: {
			acceptInsecureCerts: true,
			headless: false,
		},
		listDevices: false,
		localStorage: {
			theme: 'dark',
		},
		logConsole: false,
		modules: [
			'https://sindresorhus.com/remote-file.js',
			'local-file.js',
			'document.body.style.backgroundColor = \'red\'',
		],
		output: 'screenshot.png',
		overwrite: false,
		pdfBackground: false,
		pdfLandscape: false,
		preloadLazyContent: false,
		quality: 0.5,
		removeElements: [
			'img.ad',
		],
		scaleFactor: 3,
		scripts: [],
		scrollToElement: '#map',
		styles: [],
		throwOnHttpError: false,
		timeout: 80,
		type: 'jpeg.',
		userAgent: 'I love unicorns',
		waitForElement: '#header',
		waitForNetworkIdle: false,
		width: 1000,
	};

	assert.deepStrictEqual(json, expected);
});

test('throwOnHttpError flag throws error on 404', async () => {
	const testDirectory = setupTestDirectory();
	const outputFile = path.join(testDirectory, 'test-404.png');

	try {
		await assert.rejects(
			execa(cliPath, [
				'https://httpbin.org/status/404',
				`--output=${outputFile}`,
				'--throw-on-http-error',
				'--timeout=30',
			]),
			error => {
				assert.ok(error.stderr.includes('404') || error.stderr.includes('HTTP'));
				assert.equal(error.exitCode, 1);
				return true;
			},
		);
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('PDF format option', async () => {
	const testDirectory = setupTestDirectory();
	const outputFile = path.join(testDirectory, 'test.pdf');

	try {
		await execa(cliPath, [
			'https://example.com',
			`--output=${outputFile}`,
			'--type=pdf',
			'--pdf-format=a4',
			'--timeout=10',
		]);
		assert.ok(existsSync(outputFile));
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('PDF landscape option', async () => {
	const testDirectory = setupTestDirectory();
	const outputFile = path.join(testDirectory, 'test-landscape.pdf');

	try {
		await execa(cliPath, [
			'https://example.com',
			`--output=${outputFile}`,
			'--type=pdf',
			'--pdf-landscape',
			'--timeout=10',
		]);
		assert.ok(existsSync(outputFile));
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('PDF margin option with single value', async () => {
	const testDirectory = setupTestDirectory();
	const outputFile = path.join(testDirectory, 'test-margin.pdf');

	try {
		await execa(cliPath, [
			'https://example.com',
			`--output=${outputFile}`,
			'--type=pdf',
			'--pdf-margin=1in',
			'--timeout=10',
		]);
		assert.ok(existsSync(outputFile));
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('PDF margin option with four values', async () => {
	const testDirectory = setupTestDirectory();
	const outputFile = path.join(testDirectory, 'test-margin-4.pdf');

	try {
		await execa(cliPath, [
			'https://example.com',
			`--output=${outputFile}`,
			'--type=pdf',
			'--pdf-margin=1in,0.5in,1in,0.5in',
			'--timeout=10',
		]);
		assert.ok(existsSync(outputFile));
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('PDF margin option validates format', async () => {
	const testDirectory = setupTestDirectory();
	const outputFile = path.join(testDirectory, 'test-invalid-margin.pdf');

	try {
		await assert.rejects(
			execa(cliPath, [
				'https://example.com',
				`--output=${outputFile}`,
				'--type=pdf',
				'--pdf-margin=1in,2in,3in',
			]),
			error => {
				assert.ok(error.stderr.includes('Invalid'));
				assert.equal(error.exitCode, 1);
				return true;
			},
		);
	} finally {
		cleanupTestDirectory(testDirectory);
	}
});

test('PDF margin preserves units', async () => {
	const {stdout} = await execa(cliPath, [
		'noop-file',
		'--internal-print-flags',
		'--pdf-margin=1in',
	]);

	const json = JSON.parse(stdout);
	assert.ok(json.pdf);
	assert.equal(json.pdf.margin, '1in');
});

test('PDF margin converts pure numbers', async () => {
	const {stdout} = await execa(cliPath, [
		'noop-file',
		'--internal-print-flags',
		'--pdf-margin=72',
	]);

	const json = JSON.parse(stdout);
	assert.ok(json.pdf);
	assert.equal(json.pdf.margin, 72);
});

test('PDF margin preserves units with four values', async () => {
	const {stdout} = await execa(cliPath, [
		'noop-file',
		'--internal-print-flags',
		'--pdf-margin=1in,0.5in,2cm,10mm',
	]);

	const json = JSON.parse(stdout);
	assert.ok(json.pdf);
	assert.deepStrictEqual(json.pdf.margin, {
		top: '1in',
		right: '0.5in',
		bottom: '2cm',
		left: '10mm',
	});
});

test('PDF margin mixes numbers and units', async () => {
	const {stdout} = await execa(cliPath, [
		'noop-file',
		'--internal-print-flags',
		'--pdf-margin=72,1in,2.5cm,10',
	]);

	const json = JSON.parse(stdout);
	assert.ok(json.pdf);
	assert.deepStrictEqual(json.pdf.margin, {
		top: 72,
		right: '1in',
		bottom: '2.5cm',
		left: 10,
	});
});

test('PDF margin rejects empty values', async () => {
	await assert.rejects(
		execa(cliPath, [
			'noop-file',
			'--internal-print-flags',
			'--pdf-margin=1in,,1in,0.5in',
		]),
		error => {
			assert.ok(error.stderr.includes('empty values not allowed'));
			assert.equal(error.exitCode, 1);
			return true;
		},
	);
});

test('logConsole flag works without errors', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(createHtmlPage(`
			<script>
				console.log('test log message');
				console.warn('test warning');
				console.error('test error');
			</script>
		`));
	});

	const {stdout} = await execa(cliPath, [
		server.url,
		'--log-console',
		'--timeout=10',
	], {encoding: 'buffer'});

	const {mime} = await fileTypeFromBuffer(stdout);
	assert.equal(mime, 'image/png');

	await server.close();
});

test('referrer option sets custom referrer', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		const referrer = request.headers.referer || 'none';
		response.end(createHtmlPage(`<div id="referrer">${referrer}</div>`));
	});

	const {stdout} = await execa(cliPath, [
		server.url,
		'--referrer=https://example.com',
		'--timeout=10',
	], {encoding: 'buffer'});

	const {mime} = await fileTypeFromBuffer(stdout);
	assert.equal(mime, 'image/png');

	await server.close();
});

test('preloadLazyContent flag works', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(createHtmlPage(`
			<div style="height: 2000px;">Top content</div>
			<img loading="lazy" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="lazy">
		`));
	});

	const {stdout} = await execa(cliPath, [
		server.url,
		'--preload-lazy-content',
		'--timeout=10',
	], {encoding: 'buffer'});

	const {mime} = await fileTypeFromBuffer(stdout);
	assert.equal(mime, 'image/png');

	await server.close();
});

// Clean up test-temp directory after all tests
after(() => {
	if (existsSync('test-temp')) {
		rmSync('test-temp', {recursive: true, force: true});
	}
});
