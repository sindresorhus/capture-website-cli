# capture-website-cli

> Capture screenshots of websites from the command-line

It uses [Puppeteer](https://github.com/GoogleChrome/puppeteer) (Chrome) under the hood.

## Install

```sh
npm install --global capture-website-cli
```

Note to Linux users: If you get a "No usable sandbox!" error, you need to enable [system sandboxing](https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#setting-up-chrome-linux-sandbox).

## Usage

```
$ capture-website --help

  Usage
    $ capture-website <url|file>
    $ echo "<h1>Unicorn</h1>" | capture-website

  Options
    --output                 Image file path (writes it to stdout if omitted)
    --width                  Page width  [default: 1280]
    --height                 Page height  [default: 800]
    --type                   Image type: png|jpeg|webp  [default: png]
    --quality                Image quality: 0...1 (Only for JPEG and WebP)  [default: 1]
    --scale-factor           Scale the webpage `n` times  [default: 2]
    --list-devices           Output a list of supported devices to emulate
    --emulate-device         Capture as if it were captured on the given device
    --full-page              Capture the full scrollable page, not just the viewport
    --no-default-background  Make the default background transparent
    --timeout                Seconds before giving up trying to load the page. Specify `0` to disable.  [default: 60]
    --delay                  Seconds to wait after the page finished loading before capturing the screenshot  [default: 0]
    --wait-for-element       Wait for a DOM element matching the CSS selector to appear in the page and to be visible before capturing the screenshot
    --element                Capture the DOM element matching the CSS selector. It will wait for the element to appear in the page and to be visible.
    --hide-elements          Hide DOM elements matching the CSS selector (Can be set multiple times)
    --remove-elements        Remove DOM elements matching the CSS selector (Can be set multiple times)
    --click-element          Click the DOM element matching the CSS selector
    --scroll-to-element      Scroll to the DOM element matching the CSS selector
    --disable-animations     Disable CSS animations and transitions  [default: false]
    --no-javascript          Disable JavaScript execution (does not affect --module/--script)
    --module                 Inject a JavaScript module into the page. Can be inline code, absolute URL, and local file path with `.js` extension. (Can be set multiple times)
    --script                 Same as `--module`, but instead injects the code as a classic script
    --style                  Inject CSS styles into the page. Can be inline code, absolute URL, and local file path with `.css` extension. (Can be set multiple times)
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
    --no-block-ads
```

## FAQ

[More here.](https://github.com/sindresorhus/capture-website#faq)

### How can I capture websites from a file with URLs?

Lets say you have a file named `urls.txt` with:

```
https://sindresorhus.com
https://github.com
```

You can run this:

```sh
filename='urls.txt'

while read url; do
  capture-website "$url" --output "screenshot-$(echo "$url" | sed -e 's/[^A-Za-z0-9._-]//g').png"
done < "$filename"
```

## Related

- [capture-website](https://github.com/sindresorhus/capture-website) - API for this module
- [pageres-cli](https://github.com/sindresorhus/pageres-cli) - A different take on screenshotting websites
