# capture-website-cli [![Build Status](https://travis-ci.com/sindresorhus/capture-website-cli.svg?branch=master)](https://travis-ci.com/sindresorhus/capture-website-cli)

> Capture screenshots of websites from the command-line

It uses [Puppeteer](https://github.com/GoogleChrome/puppeteer) (Chrome) under the hood.


## Install

```
$ npm install --global capture-website-cli
```

Note to Linux users: If you get a "No usable sandbox!" error, you need to enable [system sandboxing](https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#setting-up-chrome-linux-sandbox).


## Usage

```
$ capture-website --help

  Usage
    $ capture-website <url|file> [output-file]

    The screenshot will be written to stdout if there's no output file argument

  Options
    --width                  Page width  [default: 1280]
    --height                 Page height  [default: 800]
    --type                   Image type: png|jpeg  [default: png]
    --quality                Image quality: 0...1 (Only for JPEG)  [default: 1]
    --scale-factor           Scale the webpage `n` times  [default: 2]
    --list-devices           Output a list of supported devices to emulate
    --emulate-device         Capture as if it were captured on the given device
    --no-default-background  Make the default background transparent
    --timeout                Seconds before giving up trying to load the page. Specify `0` to disable.  [default: 60]
    --delay                  Seconds to wait after the page finished loading before capturing the screenshot  [default: 0]
    --wait-for-element       Wait for a DOM element matching the CSS selector to appear in the page and to be visible before capturing the screenshot
    --element                Capture the DOM element matching the CSS selector. It will wait for the element to appear in the page and to be visible.
    --hide-elements          Hide DOM elements matching the CSS selector (Can be set multiple times)
    --remove-elements        Remove DOM elements matching the CSS selector (Can be set multiple times)
    --click-element          Click the DOM element matching the CSS selector
    --disable-animations     Disable CSS animations and transitions. [default: false]
    --module                 Inject a JavaScript module into the page. Can be inline code, absolute URL, and local file path with `.js` extension. (Can be set multiple times)
    --scripts                Same as `--modules`, but instead injects the code as a classic script
    --style                  Inject CSS styles into the page. Can be inline code, absolute URL, and local file path with `.css` extension. (Can be set multiple times)
    --header                 Set a custom HTTP header (Can be set multiple times)
    --user-agent             Set the user agent
    --cookie                 Set a cookie (Can be set multiple times)
    --authentication         Credentials for HTTP authentication
    --debug                  Show the browser window to see what it's doing
    --overwrite              Overwrite the destination file if it exists
    --launch-options         Puppeteer launch options as JSON

  Examples
    $ capture-website https://sindresorhus.com screenshot.png
    $ capture-website index.html screenshot.png

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
    --disable-animations=true
    --module=https://sindresorhus.com/remote-file.js
    --module=local-file.js
    --module="document.body.style.backgroundColor = 'red'"
    --header="x-powered-by: capture-website-cli"
    --user-agent="I love unicorns"
    --cookie="id=unicorn; Expires=Wed, 21 Oct 2018 07:28:00 GMT;"
    --authentication="username:password"
    --launch-options='{"headless": false}'
```


## Related

- [capture-website](https://github.com/sindresorhus/capture-website) - API for this module
- [pageres-cli](https://github.com/sindresorhus/pageres-cli) - A different take on screenshotting websites
