# np [![Build Status](https://travis-ci.org/sindresorhus/np.svg?branch=master)](https://travis-ci.org/sindresorhus/np)

> A better `npm publish`

<img src="screenshot.gif" width="688">


## Why

- [Interactive UI](#interactive-ui)
- Ensures you are publishing from the `master` branch
- Ensures the working directory is clean and that there are no unpulled changes
- Reinstalls dependencies to ensure your project works with the latest dependency tree
- Runs the tests
- Bumps the version in package.json and npm-shrinkwrap.json (if present) and creates a git tag
- Prevents [accidental publishing](https://github.com/npm/npm/issues/13248) of pre-release versions under the `latest` [dist-tag](https://docs.npmjs.com/cli/dist-tag)
- Publishes the new version to npm, optionally under a dist-tag
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
    --any-branch  Allow publishing from any branch
    --no-cleanup  Skips cleanup of node_modules
    --yolo        Skips cleanup and testing
    --no-publish  Skips publishing
    --tag         Publish under a given dist-tag

  Examples
    $ np
    $ np patch
    $ np 1.0.2
    $ np 1.0.2-beta.3 --tag=beta
```


## Interactive UI

Run `np` without arguments to launch the interactive UI that guides you through publishing a new version.

<img src="screenshot-ui.png" width="1290">


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

### Publish to a custom registry

Set the [`registry` option](https://docs.npmjs.com/misc/config#registry) in package.json to the URL of your registry:

```json
"publishConfig":{
	"registry": "http://my-internal-registry.local"
}
```

### Publish with a CI

If you use a Continuous Integration server to publish your tagged commits, use the `--no-publish` flag to skip the publishing step of `np`.

### Initial version

For new packages, start the `version` field in package.json at `0.0.0` and let `np` bump it to `1.0.0` or `0.1.0` when publishing.

### Prerequisite runs forever (macOS Sierra)

If you're running macOS >= 10.12 and previously stored your git SSH-Key in the keychain (so you don't have to enter your password on every single git command) it happens that the `prerequisite` step runs forever, because you should type in your password when publishing a new version with `np`. Unfortunately thats not possible right now.

#### Solution

Open `~/.ssh/config` (if it doesn't exist create it)

Add or modify:  `AddKeysToAgent yes`

Save the file, and close it.

To add your SSH-Key to the keychain, you have to run a simple git command like `git fetch`.
Now your credentials should be stored in the keychain and you are able to use `np` again.

## Created by

- [Sindre Sorhus](https://github.com/sindresorhus)
- [Sam Verschueren](https://github.com/SamVerschueren)


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
