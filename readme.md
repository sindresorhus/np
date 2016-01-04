# np

> A better `npm publish`


## Why

- Ensures the working directory is clean and that there are no unpulled changes
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
np [patch | minor | major | <version>] [--keep]
# `patch` is default
```

 1. `--keep`: Stop from trashing `node_modules` and reinstalling.


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
