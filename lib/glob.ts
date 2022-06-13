import DirGlob from 'dir-glob';
import FastGlob from 'fast-glob';

export function glob(pattern: string, cwd: string): Promise<string[]> {
    try {
        if (require.resolve(pattern)) return Promise.resolve([pattern]);
    } catch {
        //
    }

    return DirGlob([pattern], { cwd })
        .then((convertedPattern) => FastGlob(convertedPattern, { cwd }));
}
