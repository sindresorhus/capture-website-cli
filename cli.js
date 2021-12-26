#!/usr/bin/env node
import process from 'node:process';
import meow from 'meow';
import captureWebsite from 'capture-website';
import arrify from 'arrify';
import splitOnFirst from 'split-on-first';
import getStdin from 'get-stdin';
import filenamify from 'filenamify';
import { URL } from 'url';
import { fstat, accessSync, constants } from 'fs';
import { basename, extname } from 'path';

const cli = meow(`
	Usage
	  $ capture-website <url|file>
	  $ echo "<h1>Unicorn</h1>" | capture-website

	Options
	  --output                 Image file path (names file based on URL if omitted)
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

	Examples
    $ capture-website https://sindresorhus.com
    $ capture-website https://sindresorhus.com --output=screenshot.png
    $ capture-website index.html --output=screenshot.png
    $ capture-website file:///tmp/index.html --full-page --output=-
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
			default: 'png',
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

options.headers = {};
for (const header of arrify(options.header)) {
	const [key, value] = header.split(':');
	options.headers[key.trim()] = value.trim();
}

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

(async () => {
	const {
		internalPrintFlags,
		listDevices,
		output,
		type,
		overwrite,
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

	// Performing stat over stdout (file descriptor 1)
  await fstat(1, async function(e, stat) {
		if (e) {
      console.error('Error: ' + e.message);
      process.exit(1);
    }

		// Check if output is piped
		if (!output && stat.isFIFO() || output == '-') {
			try {
				process.stdout.write(await captureWebsite.buffer(input, options));
			} catch (e) {
				console.error('Error: ' + e.message);
				process.exit(1);
			}
		} else {
			let filename = output;

			if (!filename) {
				if (options.inputType == 'html') {
					filename = 'stdin';
				} else {
					let url;

					try {
						// Check if input is a URL
						url = new URL(input);
					} catch(e) {}

					if (url) {
						// Input is a URL
						filename = filenamify(url.hostname + url.pathname, { replacement: '-' });
					} else {
						// Input is a file path
						try {
							// Check if input file exists
							accessSync(input, constants.F_OK);
						} catch (e) {
							console.error('Error: ' + e.message);
							process.exit(1);
						}

						filename = basename(input, extname(input));
					}
				}

				filename += '.' + type;
			}

			try {
				// Check if output file already exists
				accessSync(filename, constants.F_OK);

				if (!overwrite) {
					console.error("'" + filename + "' already exists, use --overwrite to bypass this error");
					process.exit(1);
				}
			} catch (e) {}

			try {
				await captureWebsite.file(input, filename, options);
			} catch (e) {
				console.error('Error: ' + e.message);
				process.exit(1);
			}
		}
	});
})();
