import {basename, dirname, join} from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {mkdir, writeFile, rm} from 'node:fs/promises';
import {executeProcess} from "@org/test-utils";
import {readJsonFile} from "nx/src/utils/fileutils";
import {User} from "@org/models";

describe('core - sort user.json', () => {
  const workspaceRoot = join('tmp', 'npm-env', 'core-e2e');
  const baseDir = join(workspaceRoot, '__test_env__', 'sort-user-json');

  afterEach(async () => {
    await rm(baseDir, {recursive: true, force: true});
  });

  it('should sort unsorted user json list', async () => {
    const cwd = join(baseDir, 'unsorted-json-list');
    const testScriptPath = join(cwd, 'sort-user.ts');
    const testDataPath = join(cwd, 'users.json');

    await mkdir(cwd, {recursive: true});
    await writeFile(
      testDataPath,
      JSON.stringify([{name: 'Michael'}, {name: 'Alice'}])
    );
    await expect(writeFile(testScriptPath, `
    import {sortUserFile} from "@org/core";
    sortUserFile('${basename(testDataPath)}');`)).resolves.not.toThrow();

    await executeProcess({
      command: 'tsx',
      args: [basename(testScriptPath)],
      cwd,
      verbose: true,
    });

    const userJson = await readJsonFile<User[]>(testDataPath);
    expect(userJson).toStrictEqual([{name: 'Alice'}, {name: 'Michael'}]);
  });
});
