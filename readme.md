# np [![Build Status](https://travis-ci.org/sindresorhus/np.svg?branch=master)](https://travis-ci.org/sindresorhus/np) [![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/xojs/xo)

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
- Supports [two-factor authentication](https://docs.npmjs.com/getting-started/using-two-factor-authentication)


## Install

```
$ npm install --global np
```

*Support my open source work by buying this excellent [Node.js course](https://LearnNode.com/friend/AWESOME).*


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
    --no-yarn     Don't use Yarn

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
		"version": "./build-docs && git add docs"
	}
}
```

### Release script

You can also add `np` to a custom script in `package.json`. This can be useful if you want all maintainers of a package to release the same way (Not forgetting to push Git tags, for example). However, you can't use `publish` as name of your script because it's an [npm defined lifecycle hook](https://docs.npmjs.com/misc/scripts).

```json
{
	"name": "my-awesome-package",
	"scripts": {
		"release": "np"
	},
	"devDependency": {
		"np": "*"
	}
}
```

### Signed Git tag

Set the [`sign-git-tag`](https://docs.npmjs.com/misc/config#sign-git-tag) npm config to have the Git tag signed:

```
$ npm config set sign-git-tag true
```

Or set the [`version-sign-git-tag`](https://yarnpkg.com/lang/en/docs/cli/version/#toc-git-tags) Yarn config:

```
$ yarn config set version-sign-git-tag true
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

### Publish to gh-pages

To publish to `gh-pages` or any other branch that serves your static assets), install [`branchsite`](https://github.com/enriquecaballero/branchsite), an `np`-like CLI tool aimed to compliment `np`, and create an [npm "post" hook](https://docs.npmjs.com/misc/scripts) that runs after `np`.

```
$ npm install --save-dev branchsite
```

```json
"scripts":{
	"deploy": "np",
	"postdeploy": "bs"
}
```

### Initial version

For new packages, start the `version` field in package.json at `0.0.0` and let `np` bump it to `1.0.0` or `0.1.0` when publishing.

### Prerequisite step runs forever on macOS Sierra

If you're running macOS Sierra or higher and previously stored your Git SSH-key in the keychain (So you don't have to enter your password on every single Git command), it happens that the `prerequisite` step runs forever. This is because macOS Sierra no longer stores the SSH-key in the keychain by default, so it prompts for a password during the `prerequisite` step, but you're not able to input it. The solution is to open `~/.ssh/config` (if it doesn't exist create it), add or modify `AddKeysToAgent yes`, and save the file. To add your SSH-key to the keychain, you have to run a simple Git command like `git fetch`. Your credentials should now be stored in the keychain and you're able to use `np` again.


## Created by

- [Sindre Sorhus](https://github.com/sindresorhus)
- [Sam Verschueren](https://github.com/SamVerschueren)


## License

MIT
