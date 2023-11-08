import process from 'node:process';
import { resolve } from 'node:path';
import semver from 'semver';


export async function checkIfYarnBerry(pkg) {
  if (typeof pkg.packageManager !== 'string') return false;
  const match = pkg.packageManager.match(/^yarn@(.+)$/);
  if (!match) return false;
  const [, yarnVersion] = match;
  const versionParsed = semver.parse(yarnVersion);
  return (versionParsed.major >= 2);
}
