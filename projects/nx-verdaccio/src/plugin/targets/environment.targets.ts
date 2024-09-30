import type { ProjectConfiguration, TargetConfiguration } from '@nx/devkit';
import type { NormalizedCreateNodeOptions } from '../normalize-create-nodes-options';
import { join } from 'node:path';
import { TARGET_PACKAGE_INSTALL } from './package.targets';
import type { NxVerdaccioEnvironmentsOptions } from '../schema';
import type { StartVerdaccioOptions } from '../../executors/env-bootstrap/verdaccio-registry';
import { uniquePort } from '../../executors/env-bootstrap/unique-port';
import {
  EXECUTOR_ENVIRONMENT_BOOTSTRAP,
  VERDACCIO_REGISTRY_JSON,
} from '../../executors/env-bootstrap/constants';
import { PACKAGE_NAME } from '../constants';
import { EXECUTOR_ENVIRONMENT_KILL_PROCESS } from '../../executors/kill-process/constant';
import { EXECUTOR_ENVIRONMENT_SETUP } from '../../executors/env-setup/constants';
import { iterateEntries } from '../../internal/transform';

export const TARGET_ENVIRONMENT_VERDACCIO_START = 'nxv-env-verdaccio-start';
export const TARGET_ENVIRONMENT_BOOTSTRAP = 'nxv-env-bootstrap';
export const TARGET_ENVIRONMENT_INSTALL = 'nxv-env-install';
export const TARGET_ENVIRONMENT_SETUP = 'nxv-env-setup';
export const TARGET_ENVIRONMENT_VERDACCIO_STOP = 'nxv-env-verdaccio-stop';

export function isEnvProject(
  projectConfig: ProjectConfiguration,
  options: NormalizedCreateNodeOptions['environments']
): boolean {
  const { tags: existingTags = [], targets } = projectConfig;
  const existingTargetNames = Object.keys(targets ?? {});
  const {
    filterByTags: environmentsTagFilters,
    targetNames: environmentTargetNames,
  } = options;

  if (!existingTargetNames || !environmentTargetNames) {
    return false;
  }

  if (
    existingTargetNames.some((existingTarget) =>
      environmentTargetNames.includes(existingTarget)
    )
  ) {
    if (existingTags && environmentsTagFilters) {
      return existingTags.some((existingTag) =>
        environmentsTagFilters.includes(existingTag)
      );
    }
    return true;
  }

  return false;
}

export function verdaccioTargets(
  projectConfig: ProjectConfiguration,
  options: Pick<
    NormalizedCreateNodeOptions['environments'],
    'environmentsDir'
  > &
    Omit<StartVerdaccioOptions, 'projectName'>
): Record<string, TargetConfiguration> {
  const { name: envProject } = projectConfig;
  const { environmentsDir, ...verdaccioOptions } = options;
  const environmentDir = join(environmentsDir, envProject);

  return {
    [TARGET_ENVIRONMENT_VERDACCIO_START]: {
      // @TODO: consider using the executor function directly to reduce the number of targets
      // https://github.com/nrwl/nx/blob/b73f1e0e0002c55fc0bacaa1557140adb9eec8de/packages/js/src/executors/verdaccio/verdaccio.impl.ts#L22
      executor: '@nx/js:verdaccio',
      options: {
        config: '.verdaccio/config.yml',
        port: uniquePort(),
        storage: join(environmentDir, 'storage'),
        clear: true,
        environmentDir,
        projectName: envProject,
        ...verdaccioOptions,
      },
    },
    [TARGET_ENVIRONMENT_VERDACCIO_STOP]: {
      executor: `${PACKAGE_NAME}:${EXECUTOR_ENVIRONMENT_KILL_PROCESS}`,
      options: {
        filePath: join(environmentsDir, VERDACCIO_REGISTRY_JSON),
        ...verdaccioOptions,
      },
    },
  };
}

export function getEnvTargets(
  projectConfig: ProjectConfiguration,
  options: NormalizedCreateNodeOptions['environments']
): Record<string, TargetConfiguration> {
  const { name: envProject } = projectConfig;
  const { environmentsDir } = options;
  const environmentRoot = join(environmentsDir, envProject);
  return {
    [TARGET_ENVIRONMENT_BOOTSTRAP]: {
      executor: `${PACKAGE_NAME}:${EXECUTOR_ENVIRONMENT_BOOTSTRAP}`,
      options: { environmentRoot },
    },
    // intermediate task just here to execute dependent pkg-install tasks with the correct environmentProject
    [TARGET_ENVIRONMENT_INSTALL]: {
      dependsOn: [
        {
          projects: 'dependencies',
          target: TARGET_PACKAGE_INSTALL,
          params: 'forward',
        },
      ],
      options: { environmentRoot },
    },
    // runs env-bootstrap-env, install-env and stop-verdaccio
    [TARGET_ENVIRONMENT_SETUP]: {
      outputs: [
        '{options.environmentRoot}/node_modules',
        '{options.environmentRoot}/package.json',
        '{options.environmentRoot}/.npmrc',
        '{options.environmentRoot}/package-lock.json',
      ],
      cache: false, // # @TODO enable by default after more research on cache size is done
      executor: `${PACKAGE_NAME}:${EXECUTOR_ENVIRONMENT_SETUP}`,
      options: {
        environmentRoot,
      },
    },
  };
}

export function updateEnvTargetNames(
  projectConfig: ProjectConfiguration,
  options: Required<Pick<NxVerdaccioEnvironmentsOptions, 'targetNames'>>
): Record<string, TargetConfiguration> {
  const { targetNames: envTargetNames } = options;
  const { targets: existingTargets = {} as TargetConfiguration } =
    projectConfig;

  return iterateEntries(existingTargets, (entries) =>
    entries.map(([existingTargetName, config]) => {
      if (!envTargetNames.includes(existingTargetName)) {
        return [existingTargetName, config];
      }
      return [
        existingTargetName,
        {
          ...config,
          dependsOn: [
            { target: TARGET_ENVIRONMENT_SETUP, params: 'forward' },
            ...(config.dependsOn ?? []),
          ],
        },
      ];
    })
  );
}
