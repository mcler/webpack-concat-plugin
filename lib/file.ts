import fs from 'node:fs/promises';
import path from 'node:path';
import upath from 'upath';
import type { Compiler } from 'webpack';
import { OriginalSource, SourceMapSource } from 'webpack-sources';
import type { Source } from 'webpack-sources';
import type { RawSourceMap } from 'source-map';
import type { CodeAndMap } from './types';

function readFile(filePath: string): Promise<string | undefined> {
    return fs.readFile(filePath)
        .then(
            (file) => file.toString(),
            () => undefined,
        )
        .catch(() => undefined);
}

async function getSourceAndMap(filePath: string): Promise<CodeAndMap> {
    let code = await readFile(filePath);

    if (!code) return Promise.reject();

    let sourceMapping: string | undefined;
    let map: RawSourceMap | undefined;
    const regexp = /\/\/# sourceMappingURL=(data:application\/json;base64,)?(.+)\n/;

    const matches = regexp.exec(code) ?? [];

    const [sourceMappingLine, isBase64, sourceMappingUrl] = matches;
    if (isBase64) {
        sourceMapping = Buffer.from(sourceMappingUrl, 'base64').toString();
    } else if (sourceMappingUrl) {
        sourceMapping = await readFile(path.join(path.dirname(filePath), sourceMappingUrl));
    } else {
        sourceMapping = await readFile(`${filePath}.map`);
    }

    if (sourceMapping) map = JSON.parse(sourceMapping);

    if (sourceMappingLine) {
        code = code.replace(sourceMappingLine, '');
    }

    return { code, map };
}

export function createFileWithMap(compiler: Compiler, filePath: string): Promise<Source> {
    const webpackPath = `webpack:///${upath.relative(compiler.options.context!, filePath)}`;

    return getSourceAndMap(filePath)
        .then(
            ({ code, map }) => (map
                ? new SourceMapSource(code, webpackPath, map)
                : new OriginalSource(code, webpackPath)),
            () => Promise.reject(),
        )
        .catch((error) => {
            console.debug(error);
            return Promise.reject();
        });
}
