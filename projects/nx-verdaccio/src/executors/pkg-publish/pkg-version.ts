import { join } from 'node:path';
import { readFile } from '@nx/plugin/testing';
import type { PackageJson } from 'nx/src/utils/package-json';
import { writeFile } from 'node:fs/promises';

export async function postfixVersion(dist: string): Promise<void> {
  const pkgPath = join(process.cwd(), dist, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath)) as PackageJson;
  return writeFile(
    pkgPath,
    JSON.stringify(
      {
        ...pkg,
        version: `${pkg.version}-e2e`,
      },
      null,
      2
    )
  );
}
