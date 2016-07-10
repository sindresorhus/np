# np [![Build Status](https://travis-ci.org/sindresorhus/np.svg?branch=master)](https://travis-ci.org/sindresorhus/np)

> A better `npm publish`

<img src="screenshot.gif" width="688">


## Why

- Ensures you are publishing from the `master` branch
- Ensures the working directory is clean and that there are no unpulled changes
- Reinstalls dependencies to ensure your project works with the latest dependency tree
- Runs the tests
- Bumps the version in package.json and npm-shrinkwrap.json (if present) and creates a git tag
- Publishes the new version to npm, optionally under a [dist-tag](https://docs.npmjs.com/cli/dist-tag)
- Pushes commits and tags to GitHub


## Install

```
$ npm install --global np
```


## Usage

```
$ np --help

  Usage
    $ np <version>

    Version can be:
      patch | minor | major | prepatch | preminor | premajor | prerelease | 1.2.3

  Options
    --any-branch    Allow publishing from any branch
    --skip-cleanup  Skips cleanup of node_modules
    --yolo          Skips cleanup and testing
    --tag           Publish under a given dist-tag

  Examples
    $ np patch
    $ np 1.0.2
    $ np 1.0.2-beta.3 --tag=beta
```


## Tips

### npm hooks

You can use any of the test/version/publish related [npm lifecycle hooks](https://docs.npmjs.com/misc/scripts) in your package.json to add extra behavior.

For example, here we build the documentation before tagging the release:

```json
{
	"name": "my-awesome-package",
	"scripts": {
		"preversion": "./build-docs"
	}
}
```

### Signed Git tag

Set the [`sign-git-tag`](https://docs.npmjs.com/misc/config#sign-git-tag) npm config to have the Git tag signed:

```
$ npm config set sign-git-tag true
```


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
