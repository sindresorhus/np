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

### Private packages

<img src="private-packages.png" width="260" align="right">

You can use `np` for packages that aren't publicly published to npm (perhaps installed from a private git repo).

Set `"private": true` in your `package.json` and the publish step will be skipped. All other steps
including versioning and pushing tags will still be completed.

### Public scoped packages

To publish [scoped packages](https://docs.npmjs.com/misc/scope#publishing-public-scoped-packages-to-the-public-npm-registry) to the public registry, you need to set the access level to `public`. You can do that by adding the following to your `package.json`:

```json
"publishConfig": {
	"access": "public"
}
```

### Initial version

For new packages, start the `version` field in package.json at `0.0.0` and let `np` bump it to `1.0.0` or `0.1.0` when publishing.


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
