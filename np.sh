#!/usr/bin/env sh

if test 0 -ne `git status --porcelain | wc -l`; then
	echo "Unclean working tree. Commit or stash changes first." >&2;
	exit 128;
fi

if test "00" -ne `git fetch; git rev-list --count --left-right @'{u}'...HEAD | awk '{ print $1$2 }'`; then
	echo "Local/Remote history differ. Please push/pull changes." >&2;
	exit 128;
fi

./node_modules/.bin/trash node_modules &>/dev/null;
npm install &&
npm test &&
npm version ${1:-patch} &&
npm publish &&
git push --follow-tags