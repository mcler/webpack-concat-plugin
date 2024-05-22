import type { Source } from 'webpack-sources';
import type { RawSourceMap } from 'source-map';

export type PromiseResult<T> = PromiseFulfilledResult<T> | PromiseSettledResult<T>;

export type Sources = Source[];

export type BinaryToTextEncoding = 'base64' | 'base64url' | 'hex' | 'binary';

export interface ConcatPluginInputOptions {
    useHash?: boolean;
    hashFunction?: string;
    hashDigest?: BinaryToTextEncoding;
    name?: string;
    fileName?: string;
    filesToConcat: string[];
    injectType?: 'prepend' | 'append' | 'none';
    attributes?: {
        [attribute: string]: unknown;
    };
    publicPath?: string;
    outputPath?: string;
}

export interface ConcatPluginOptions {
    useHash?: boolean;
    hashFunction?: string;
    hashDigest?: BinaryToTextEncoding;
    name: string;
    fileName: string;
    filesToConcat: string[];
    injectType: 'prepend' | 'append' | 'none';
    attributes?: {
        [attribute: string]: unknown;
    };
    publicPath?: string;
    outputPath: string;
}

export interface CodeAndMap {
    code: string;
    map: RawSourceMap | undefined;
}

export type WebpackFileTimestamps = ReadonlyMap<string, null | 'ignore'>;

export interface HtmlWebpackPluginAssets {
    publicPath: string;
    js: Array<string>;
    css: Array<string>;
    favicon?: string;
    manifest?: string;
    webpackConcat: Record<string, string>;
}
