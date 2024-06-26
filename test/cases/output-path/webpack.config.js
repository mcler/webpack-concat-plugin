import ConcatPlugin from '../../../index';

module.exports = {
    entry: './index.js',
    plugins: [
        new ConcatPlugin({
            name: 'file',
            fileName: '[name].js',
            filesToConcat: ['../../fixtures/a.js', '../../fixtures/b.js', 'is-object'],
            outputPath: 'legacy',
        })
    ],
    optimization: {
        minimize: false,
    },
};
