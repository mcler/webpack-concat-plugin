export default {
    roots: [
        '<rootDir>/test',
    ],
    testEnvironment: 'node',
    transform: {
        '^.+\\.jsx?$': 'esbuild-jest',
        '^.+\\.tsx?$': 'esbuild-jest',
    },
    transformIgnorePatterns: [],
};
