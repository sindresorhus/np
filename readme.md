# np

> A better `npm publish`


## Why

- Pulls in remote git commits to ensure you publish the latest commit
- Reinstalls dependencies to ensure your project works with the latest dependency tree
- Runs the tests
- Bumps the version in package.json and creates a git tag
- Publishes the new version to npm
- Pushes commits and tags to GitHub


## Install

```
$ npm install --global np
```


## Usage

```sh
np [patch | minor | major | <version>]
# `patch` is default
```


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
