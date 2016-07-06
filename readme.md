# np [![Build Status](https://travis-ci.org/sindresorhus/np.svg?branch=master)](https://travis-ci.org/sindresorhus/np)

> A better `npm publish`

<img src="screenshot.gif" width="688">


## Why

- Ensures you are publishing from the `master` branch
- Ensures the working directory is clean and that there are no unpulled changes
- Reinstalls dependencies to ensure your project works with the latest dependency tree
- Runs the tests
- Bumps the version in package.json and creates a git tag
- Publishes the new version to npm
- Doesn't set the npm `dist-tag` to `latest` when publishing pre-release versions
- Pushes commits and tags to GitHub


## Install

```
$ npm install --global np
```


## Usage

```
$ np --help

  Usage
    $ np [major | minor | patch | premajor | preminor | prepatch | prerelease | <version>] (Default: patch)

  Options
    --any-branch    Allow publishing from any branch
    --skip-cleanup  Skips cleanup of node_modules
    --yolo          Skips cleanup and testing

  Examples
    $ np
    $ np major
    $ np 1.0.2
```


## Tip

You can use any of the test/version/publish related [npm lifecycle hooks](https://docs.npmjs.com/misc/scripts) to add extra behavior.


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
