import ConcatPlugin from '../../../lib';

module.exports = {
    entry: './index.js',
    plugins: [
        new ConcatPlugin({
            name: 'file',
            fileName: '[name].js',
            filesToConcat: ['../../fixtures', 'is-object']
        })
    ],
    optimization: {
        minimize: false,
    },
};
