/**
 * @file webpack-concat-plugin
 * @author huangxueliang
 * @author mcler
 */
import { Compilation } from 'webpack';
import type { Compiler, Resolver } from 'webpack';
import { ConcatSource, OriginalSource } from 'webpack-sources';
import type { Source } from 'webpack-sources';
import { createHash } from 'node:crypto';
import path from 'node:path';
import upath from 'upath';
import { validate as validateOptions } from 'schema-utils';
import type { Schema } from 'schema-utils/declarations/validate';
import HtmlWebpackPlugin from 'html-webpack-plugin';

import schema from './schema.json';
import { createFileWithMap } from './file';
import { glob } from './glob';
// import { ensureTrailingSlash } from './utils';

import type {
    ConcatPluginInputOptions, ConcatPluginOptions,
    HtmlWebpackPluginAssets,
    PromiseResult,
    Sources, WebpackFileTimestamps,
} from './types';

const PLUGIN_NAME = 'webpackConcatPlugin';

/**
 * @class ConcatPlugin
 */
export default class ConcatPlugin {
    private fileHash: string = '';

    private filesToConcatAbsolutePromise?: Promise<string[]>;

    private finalFileName: string = '';

    private getReadFilePromise?: (_: boolean) => Promise<Sources>;

    private needCreateNewFile: boolean = true;

    private prevFileTimestamps: WebpackFileTimestamps = new Map();

    private resolveCache: Record<string, boolean> = {};

    private settings: ConcatPluginOptions;

    private startTime: number;

    constructor(optionsArg: ConcatPluginInputOptions) {
        const outputPath = typeof optionsArg.outputPath === 'string' ? optionsArg.outputPath : '';
        const options: ConcatPluginOptions = {
            fileName: '[name].js',
            name: 'result',
            injectType: 'prepend',
            ...optionsArg,
            outputPath,
        };

        if (!options.filesToConcat || !options.filesToConcat.length) {
            throw new Error(`${PLUGIN_NAME}: option filesToConcat is required and should not be empty`);
        }

        validateOptions(schema as Schema, options);

        this.settings = options;

        this.startTime = Date.now();
    }

    private getFileName(fileContent: string, filePath = this.settings.fileName): string {
        if (!this.needCreateNewFile) {
            return this.finalFileName;
        }

        const fileRegExp = /\[name\]/;
        const hashRegExp = /\[hash(?:(?::)([\d]+))?\]/;

        if (this.settings.useHash || hashRegExp.test(filePath)) {
            const fileHash = this.hashFile(fileContent);

            if (!hashRegExp.test(filePath)) {
                filePath = filePath.replace(/\.js$/, '.[hash].js');
            }

            const regResult = hashRegExp.exec(filePath);
            const hashLength = (regResult?.[1]) ? Number(regResult[1]) : fileHash.length;

            filePath = filePath.replace(hashRegExp, fileHash.slice(0, hashLength));
        }
        return filePath.replace(fileRegExp, this.settings.name);
    }

    private hashFile(fileContent: string): string {
        if (this.fileHash && !this.needCreateNewFile) {
            return this.fileHash;
        }

        const { hashFunction = 'md5', hashDigest = 'hex' } = this.settings;

        let fileHash = createHash(hashFunction).update(fileContent).digest(hashDigest);

        if (hashDigest === 'base64') {
            // these are not safe url characters.
            fileHash = fileHash.replace(/[/+=]/g, (c) => {
                switch (c) {
                    case '/': return '_';
                    case '+': return '-';
                    case '=': return '';
                    default: return c;
                }
            });
        }

        this.fileHash = fileHash;

        return fileHash;
    }

    private getRelativePathAsync(context: string): Promise<string[]> {
        return Promise.all(this.settings.filesToConcat.map((f) => glob(f, context)))
            .then((resources) => resources.reduce((target: string[], resource) => target.concat(...resource), [] as string[]))
            .catch((error) => {
                console.error(error);
                return [] as string[];
            });
    }

    private resolveReadFile(resolver: Resolver, context: string, relativeFilePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            resolver.resolve(
                {},
                context,
                relativeFilePath,
                {},
                (error, filePath) => {
                    if (error) {
                        if (!this.resolveCache[relativeFilePath]) reject(error);
                    } else {
                        this.resolveCache[relativeFilePath] = true;
                        resolve(filePath as string);
                    }
                },
            );
        });
    }

    private resolveReadFiles(compiler: Compiler) {
        const self = this;

        const relativePathArrayPromise = this.getRelativePathAsync(compiler.options.context!);

        /**
         * @var {Promise<Sources>}
        */
        this.filesToConcatAbsolutePromise = new Promise((resolve) => {
            compiler.resolverFactory.hooks.resolver.for('normal').tap('resolver', (resolver) => {
                resolve(relativePathArrayPromise
                    .then((relativeFilePathArray) => Promise.all(
                        relativeFilePathArray.map((relativeFilePath) => this.resolveReadFile(
                            resolver,
                            compiler.options.context!,
                            relativeFilePath,
                        )),
                    )).catch((error) => {
                        console.error(error);
                        return [];
                    }));
            });
        });

        const createNewPromise = (): Promise<Sources> => {
            self.needCreateNewFile = true;

            return this.filesToConcatAbsolutePromise!
                .then((filePathArray) => Promise.allSettled(
                    filePathArray.map((filePath) => createFileWithMap(compiler, filePath)),
                ))
                .then((results) => results.reduce((sources: Sources, result: PromiseResult<Source>) => {
                    if (result.status === 'fulfilled') sources.push(result.value);
                    return sources;
                }, []))
                .catch((error) => {
                    console.error(error);
                    return [];
                });
        };

        let readFilePromise: ReturnType<typeof createNewPromise>;

        /**
         * @returns {Promise<Sources>}
         */
        this.getReadFilePromise = (createNew) => {
            if (!readFilePromise || createNew) {
                readFilePromise = createNewPromise();
            }
            return readFilePromise;
        };
    }

    private resolveConcatAndUglify(compilation: Compilation, sources: Sources) {
        const concatSource = new ConcatSource();
        sources.forEach((source, idx) => {
            // New line insertion
            if (idx > 0) {
                const prevSourceText = sources[idx - 1].source().toString();
                const currentSourceText = source.source().toString();
                if (prevSourceText.slice(-1) !== '\n'
                    && currentSourceText.slice(0, 1) !== '\n') {
                    concatSource.add(new OriginalSource('\n', 'x'));
                }
            }
            concatSource.add(source);
        });
        this.finalFileName = this.getFileName(concatSource.source().toString());
        const filePathAsset = this.settings.outputPath
            ? path.join(this.settings.outputPath, this.finalFileName)
            : this.finalFileName;
        compilation.emitAsset(
            filePathAsset,
            concatSource as any, // Reason for any: own Source typing in webpack
        );

        this.needCreateNewFile = false;
    }

    apply(compiler: Compiler) {
        // ensure only compile one time per emit
        let compileLoopStarted = false;

        this.resolveReadFiles(compiler);

        const self = this;

        const dependenciesChanged = (compilation: Compilation, filesToConcatAbsolute: string[]) => {
            // Reason for any: non-full Compilation typing
            const fileTimestamps: WebpackFileTimestamps = (compilation as any).fileTimestamps as WebpackFileTimestamps;
            if (!fileTimestamps) {
                return true;
            }
            const fileTimestampsKeys = Array.from(fileTimestamps.keys());
            if (!fileTimestampsKeys.length) {
                return true;
            }
            const changedFiles = fileTimestampsKeys.filter(
                (file) => {
                    const start = this.prevFileTimestamps.get(file) || this.startTime;
                    const end = fileTimestamps.get(file) || Infinity;
                    return start < end;
                },
            );

            this.prevFileTimestamps = fileTimestamps;

            return changedFiles.some((file) => filesToConcatAbsolute.includes(file));
        };

        const processCompiling = (compilation: Compilation, callback: Function) => {
            self.filesToConcatAbsolutePromise!.then((filesToConcatAbsolute) => {
                filesToConcatAbsolute.forEach((file) => {
                    compilation.fileDependencies.add(upath.relative(compiler.options.context!, file));
                });
                if (!dependenciesChanged(compilation, filesToConcatAbsolute)) {
                    return callback();
                }
                return self.getReadFilePromise!(true).then((files) => {
                    self.resolveConcatAndUglify(compilation, files);

                    callback();
                });
            }).catch((error) => {
                console.error(error);
                // callback();
            });
        };

        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
            let assetPath: string;
            let hookBeforeAssetTagGeneration = HtmlWebpackPlugin.getHooks(compilation).beforeAssetTagGeneration;

            hookBeforeAssetTagGeneration && hookBeforeAssetTagGeneration.tapAsync(PLUGIN_NAME, (htmlPluginData, callback) => {
                const getAssetPath = () => {
                    if (typeof self.settings.publicPath === 'undefined') {
                        if (typeof htmlPluginData.assets.publicPath === 'undefined') {
                            return path.relative(
                                path.dirname(htmlPluginData.outputName),
                                path.join(self.settings.outputPath, self.finalFileName),
                            );
                        }
                        return path.join(
                            htmlPluginData.assets.publicPath,
                            self.settings.outputPath,
                            self.finalFileName,
                        );
                    }
                    if (!self.settings.publicPath) {
                        return path.relative(
                            path.dirname(htmlPluginData.outputName),
                            path.join(self.settings.outputPath, self.finalFileName),
                        );
                    }
                    return path.join(
                        self.settings.publicPath,
                        self.settings.outputPath,
                        self.finalFileName,
                    );
                };

                const injectToHtml = () => {
                    const htmlWebpackPluginAssets: HtmlWebpackPluginAssets = htmlPluginData.assets as HtmlWebpackPluginAssets;
                    if (!htmlWebpackPluginAssets.webpackConcat) htmlWebpackPluginAssets.webpackConcat = {};

                    assetPath = getAssetPath();

                    htmlWebpackPluginAssets.webpackConcat[self.settings.name] = assetPath;

                    if (self.settings.injectType === 'prepend') {
                        htmlWebpackPluginAssets.js.unshift(assetPath);
                    } else if (self.settings.injectType === 'append') {
                        htmlWebpackPluginAssets.js.push(assetPath);
                    }
                };

                if (!self.finalFileName || !compileLoopStarted) {
                    compileLoopStarted = true;
                    processCompiling(compilation, () => {
                        injectToHtml();
                        callback(null, htmlPluginData);
                    });
                } else {
                    injectToHtml();
                    callback(null, htmlPluginData);
                }
            });

            const hookAlterAssetTags = HtmlWebpackPlugin.getHooks(compilation).alterAssetTags;

            hookAlterAssetTags && hookAlterAssetTags.tapAsync(PLUGIN_NAME, (htmlPluginData, callback) => {
                if (self.settings.injectType !== 'none') {
                    const tags = htmlPluginData.assetTags.scripts.filter((tag) => tag.attributes.src === assetPath);
                    if (tags && tags.length && self.settings.attributes) {
                        tags.forEach((tag) => {
                            Object.assign(tag.attributes, self.settings.attributes);
                        });
                    }
                }
                callback(null, htmlPluginData);
            });
        });

        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation: Compilation) => {
            compilation.hooks.processAssets.tapAsync({
                name: PLUGIN_NAME,
                stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
            }, (_, callback: Function) => {
                if (!compileLoopStarted) {
                    compileLoopStarted = true;
                    processCompiling(compilation, callback);
                } else {
                    callback();
                }
            });
        });
        compiler.hooks.afterEmit.tap(PLUGIN_NAME, () => {
            compileLoopStarted = false;
        });
    }
}
