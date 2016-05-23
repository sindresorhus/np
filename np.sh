#!/usr/bin/env sh

if test "$(node -v | sed -e "s#v\([0-9]*\)\.[0-9]*\.[0-9]*#\1#")" == "6"; then
	echo 'You should not publish when running Node.js 6. Please downgrade and publish again. https://github.com/npm/npm/issues/5082' >&2;
	exit 128;
fi

if test -n "$(git status --porcelain)"; then
	echo 'Unclean working tree. Commit or stash changes first.' >&2;
	exit 128;
fi

if ! git fetch --quiet 2>/dev/null; then
	echo 'There was a problem fetching your branch.' >&2;
	exit 128;
fi

if test "0" != "$(git rev-list --count --left-only @'{u}'...HEAD)"; then
	echo 'Remote history differ. Please pull changes.' >&2;
	exit 128;
fi

trashCli=$(node -e "var path = require('path');console.log(path.join(path.dirname(require('fs').realpathSync('$0')), 'node_modules/.bin/trash'))");

node "$trashCli" node_modules &&
npm install &&
npm test &&
npm version ${1:-patch} &&
npm publish &&
git push --follow-tags
