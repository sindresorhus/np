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

```
$ np --help

  Usage
    $ np [patch | minor | major | <version>]

  Example
    $ np patch
```


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
