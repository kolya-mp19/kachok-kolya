import { rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

/** Рекурсивная очистка разрешена только для дочернего каталога известного тестового корня. */
export async function removeTestDirectory(directory, root) {
  const absoluteDirectory = resolve(directory);
  const relativeDirectory = relative(resolve(root), absoluteDirectory);

  if (
    !relativeDirectory ||
    relativeDirectory === '..' ||
    relativeDirectory.startsWith('..' + sep) ||
    isAbsolute(relativeDirectory)
  ) {
    throw new Error('Очистка вне тестового каталога запрещена.');
  }

  await rm(absoluteDirectory, { recursive: true, force: true });
}
