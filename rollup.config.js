import esbuild from 'rollup-plugin-esbuild';
import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';

const input = 'lib/index.ts';

const outputs = [
    // typings
    {
        input: ['lib/index.ts', 'lib/types.ts'],
        output: {
            dir: 'dist',
            format: 'es',
        },
        plugins: [
            // json(),
            typescript({
                tsconfigOverride: { compilerOptions: { declaration: true, emitDeclarationOnly: true } },
            }),
        ],
    },
    // esm (Node.js 12+)
    {
        input,
        output: {
            file: 'dist/index.mjs',
            format: 'es',
        },
        plugins: [
            json(),
            esbuild({ target: 'node12' }),
            // typescript(),
        ],
    },
    // commonjs (Node.js 10+)
    {
        input,
        output: {
            file: 'dist/index.js',
            format: 'cjs',
            exports: 'default',
        },
        plugins: [
            json(),
            esbuild({ target: 'node10' }),
            // typescript(),
        ],
    },
];

export default outputs;
