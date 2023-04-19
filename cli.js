#!/usr/bin/env node
import process from 'node:process';
import meow from 'meow';
import captureWebsite from 'capture-website';
import splitOnFirst from 'split-on-first';
import getStdin from 'get-stdin';

const cli = meow(`
	Usage
	  $ capture-website <url|file>
	  $ echo "<h1>Unicorn</h1>" | capture-website

	Options
	  --output                 Image file path (writes it to stdout if omitted)
	  --width                  Page width  [default: 1280]
	  --height                 Page height  [default: 800]
	  --type                   Image type: png|jpeg|webp  [default: png]
	  --quality                Image quality: 0...1 (Only for JPEG and WebP)  [default: 1]
	  --scale-factor           Scale the webpage \`n\` times  [default: 2]
	  --list-devices           Output a list of supported devices to emulate
	  --emulate-device         Capture as if it were captured on the given device
	  --full-page              Capture the full scrollable page, not just the viewport
	  --no-default-background  Make the default background transparent
	  --timeout                Seconds before giving up trying to load the page. Specify \`0\` to disable.  [default: 60]
	  --delay                  Seconds to wait after the page finished loading before capturing the screenshot  [default: 0]
	  --wait-for-element       Wait for a DOM element matching the CSS selector to appear in the page and to be visible before capturing the screenshot
	  --element                Capture the DOM element matching the CSS selector. It will wait for the element to appear in the page and to be visible.
	  --hide-elements          Hide DOM elements matching the CSS selector (Can be set multiple times)
	  --remove-elements        Remove DOM elements matching the CSS selector (Can be set multiple times)
	  --click-element          Click the DOM element matching the CSS selector
	  --scroll-to-element      Scroll to the DOM element matching the CSS selector
	  --disable-animations     Disable CSS animations and transitions  [default: false]
	  --no-javascript          Disable JavaScript execution (does not affect --module/--script)
	  --module                 Inject a JavaScript module into the page. Can be inline code, absolute URL, and local file path with \`.js\` extension. (Can be set multiple times)
	  --script                 Same as \`--module\`, but instead injects the code as a classic script
	  --style                  Inject CSS styles into the page. Can be inline code, absolute URL, and local file path with \`.css\` extension. (Can be set multiple times)
	  --header                 Set a custom HTTP header (Can be set multiple times)
	  --user-agent             Set the user agent
	  --cookie                 Set a cookie (Can be set multiple times)
	  --authentication         Credentials for HTTP authentication
	  --debug                  Show the browser window to see what it's doing
	  --dark-mode              Emulate preference of dark color scheme
	  --launch-options         Puppeteer launch options as JSON
	  --overwrite              Overwrite the destination file if it exists
	  --inset                  Inset the screenshot relative to the viewport or \`--element\`. Accepts a number or four comma-separated numbers for top, right, left, and bottom.
	  --clip                   Position and size in the website (clipping region). Accepts comma-separated numbers for x, y, width, and height.
	  --no-block-ads           Disable ad blocking

	Examples
	  $ capture-website https://sindresorhus.com --output=screenshot.png
	  $ capture-website index.html --output=screenshot.png
	  $ echo "<h1>Unicorn</h1>" | capture-website --output=screenshot.png
	  $ capture-website https://sindresorhus.com | open -f -a Preview

	Flag examples
	  --output=screenshot.png
	  --width=1000
	  --height=600
	  --type=jpeg
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
	  --launch-options='{"headless": false}'
	  --dark-mode
	  --inset=10,15,-10,15
	  --inset=30
	  --clip=10,30,300,1024
`, {
	importMeta: import.meta,
	flags: {
		output: {
			type: 'string',
		},
		width: {
			type: 'number',
		},
		height: {
			type: 'number',
		},
		type: {
			type: 'string',
		},
		quality: {
			type: 'number',
		},
		scaleFactor: {
			type: 'number',
		},
		listDevices: {
			type: 'boolean',
		},
		emulateDevice: {
			type: 'string',
		},
		fullPage: {
			type: 'boolean',
		},
		defaultBackground: {
			type: 'boolean',
		},
		timeout: {
			type: 'number',
		},
		delay: {
			type: 'number',
		},
		waitForElement: {
			type: 'string',
		},
		clip: {
			type: 'string',
		},
		element: {
			type: 'string',
		},
		hideElements: {
			type: 'string',
			isMultiple: true,
		},
		removeElements: {
			type: 'string',
			isMultiple: true,
		},
		clickElement: {
			type: 'string',
		},
		scrollToElement: {
			type: 'string',
		},
		disableAnimations: {
			type: 'boolean',
		},
		javascript: {
			type: 'boolean',
			default: true,
		},
		module: {
			type: 'string',
			isMultiple: true,
		},
		script: {
			type: 'string',
			isMultiple: true,
		},
		style: {
			type: 'string',
			isMultiple: true,
		},
		header: {
			type: 'string',
			isMultiple: true,
		},
		userAgent: {
			type: 'string',
		},
		cookie: {
			type: 'string',
			isMultiple: true,
		},
		authentication: {
			type: 'string',
		},
		debug: {
			type: 'boolean',
		},
		darkMode: {
			type: 'boolean',
		},
		launchOptions: {
			type: 'string',
		},
		overwrite: {
			type: 'boolean',
		},
		inset: {
			type: 'string',
		},
		blockAds: {
			type: 'boolean',
			default: true,
		},
	},
});

let [input] = cli.input;
const options = cli.flags;

// TODO: `meow` needs a way to handle this.
options.modules = options.module;
options.scripts = options.script;
options.styles = options.style;
options.cookies = options.cookie;
delete options.module;
delete options.script;
delete options.style;
delete options.cookie;

if (options.launchOptions) {
	options.launchOptions = JSON.parse(options.launchOptions);
}

if (options.clip) {
	const [x, y, width, height] = options.clip.split(',').map(chunk => Number.parseInt(chunk, 10));
	options.clip = {x, y, width, height};
}

options.headers = {};
for (const header of options.header) {
	const [key, value] = header.split(':');
	options.headers[key.trim()] = value.trim();
}

delete options.header;

if (options.authentication) {
	const [username, password] = splitOnFirst(options.authentication, ':');
	options.authentication = {username, password};
}

if (options.inset) {
	const values = options.inset.split(',').map(chunk => Number.parseInt(chunk, 10));
	const containsNaN = values.some(number => Number.isNaN(number));

	if (containsNaN || ![1, 4].includes(values.length)) {
		console.error('Invalid `--inset` value');
		process.exit(1);
	}

	if (values.length === 1) {
		options.inset = values[0];
	} else {
		const insetOption = {};

		for (const [index, key] of ['top', 'right', 'bottom', 'left'].entries()) {
			insetOption[key] = values[index];
		}

		options.inset = insetOption;
	}
}

options.isJavaScriptEnabled = options.javascript;

async function main() {
	const {
		internalPrintFlags,
		listDevices,
		output,
	} = options;

	if (internalPrintFlags) {
		console.log(JSON.stringify(options));
		return;
	}

	if (listDevices) {
		console.log(captureWebsite.devices.join('\n'));
		return;
	}

	if (!input) {
		input = await getStdin();
		options.inputType = 'html';
	}

	if (!input) {
		console.error('Please specify a URL, file path or HTML');
		process.exit(1);
	}

	if (output) {
		await captureWebsite.file(input, output, options);
	} else {
		process.stdout.write(await captureWebsite.buffer(input, options));
	}
}

await main();
