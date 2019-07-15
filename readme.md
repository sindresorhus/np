# np [![Build Status](https://travis-ci.org/sindresorhus/np.svg?branch=master)](https://travis-ci.org/sindresorhus/np) [![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/xojs/xo)

> A better `npm publish`

<div>
	<br>
	<br>
	<a href="https://issuehunt.io">
		<img src="https://user-images.githubusercontent.com/170270/50307315-5c349200-0498-11e9-95bb-e51a8cfc2b15.png" width="600">
	</a>
	<br>
	<br>
	<br>
</div>

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
- Rolls back the project to its previous state in case publishing fails
- Pushes commits and tags (newly & previously created) to GitHub/GitLab
- Supports [two-factor authentication](https://docs.npmjs.com/getting-started/using-two-factor-authentication)
- Enables two-factor authentication on new repositories
  <br>
  <sub>(does not apply to external registries)</sub>
- Opens a prefilled GitHub Releases draft after publish
- Warns about the possibility of extraneous files being published


## Prerequisite

- Node.js 8 or later
- npm 6.8.0 or later
- Git 2.11 or later


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
    --any-branch        Allow publishing from any branch
    --no-cleanup        Skips cleanup of node_modules
    --no-tests          Skips tests
    --yolo              Skips cleanup and testing
    --no-publish        Skips publishing
    --tag               Publish under a given dist-tag
    --no-yarn           Don't use Yarn
    --contents          Subdirectory to publish
    --no-release-draft  Skips opening a GitHub release draft

  Examples
    $ np
    $ np patch
    $ np 1.0.2
    $ np 1.0.2-beta.3 --tag=beta
    $ np 1.0.2-beta.3 --tag=beta --contents=dist
```


## Interactive UI

Run `np` without arguments to launch the interactive UI that guides you through publishing a new version.

<img src="screenshot-ui.png" width="1290">


## Config

`np` can be configured both locally and globally. When using the global `np` binary, you can configure any of the CLI flags in either a `.np-config.js` or `.np-config.json` file in the home directory. When using the local `np` binary, for example, in a `npm run` script, you can configure `np` by setting the flags in either a top-level `np` field in `package.json` or in a `.np-config.js` or `.np-config.json` file in the project directory.

Currently, these are the flags you can configure:

- `anyBranch` - Allow publishing from any branch (`false` by default).
- `cleanup` - Cleanup `node_modules` (`true` by default).
- `tests` - Run `npm test` (`true` by default).
- `yolo` - Skip cleanup and testing (`false` by default).
- `publish` - Publish (`true` by default).
- `tag` - Publish under a given dist-tag (`latest` by default).
- `yarn` - Use yarn if possible (`true` by default).
- `contents` - Subdirectory to publish (`.` by default).
- `releaseDraft` - Open a GitHub release draft after releasing (`true` by default).

For example, this configures `np` to never use Yarn and to use `dist` as the subdirectory to publish:

`package.json`
```json
{
	"name": "superb-package",
	"np": {
		"yarn": false,
		"contents": "dist"
	}
}
```

`.np-config.json`
```json
{
	"yarn": false,
	"contents": "dist"
}
```

`.np-config.js`
```js
module.exports = {
	yarn: false,
	contents: 'dist'
};
```

_**Note:** The global config only applies when using the global `np` binary, and is never inherited when using a local binary._


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
	"devDependencies": {
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

To publish to `gh-pages` (or any other branch that serves your static assets), install [`branchsite`](https://github.com/enriquecaballero/branchsite), an `np`-like CLI tool aimed to complement `np`, and create an [npm "post" hook](https://docs.npmjs.com/misc/scripts) that runs after `np`.

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

### Release an update to an old major version

To release a minor/patch version for an old major version, create a branch from the major version's git tag and run `np`:

```console
$ git checkout -b fix-old-bug v1.0.0 # Where 1.0.0 is the previous major version
# Create some commits…
$ git push --set-upstream origin HEAD
$ np patch --any-branch --tag=v1
```

### Prerequisite step runs forever on macOS

If you're using macOS Sierra 10.12.2 or later, your SSH key passphrase is no longer stored into the keychain by default. This may cause the `prerequisite` step to run forever because it prompts for your passphrase in the background. To fix this, add the following lines to your `~/.ssh/config` and run a simple Git command like `git fetch`.

```
Host *
 AddKeysToAgent yes
 UseKeychain yes
```

If you're running into other issues when using SSH, please consult [GitHub's support article](https://help.github.com/articles/connecting-to-github-with-ssh/).


## Maintainers

- [Sindre Sorhus](https://github.com/sindresorhus)
- [Sam Verschueren](https://github.com/SamVerschueren)
- [Itai Steinherz](https://github.com/itaisteinherz)
