import { cwd as processCwd } from 'process';
import { glob } from '../lib/glob';

describe('glob', () => {
    it('handle node module', () => {
        const cwd = processCwd();
        return expect(glob('fs', cwd)).resolves.toEqual(['fs']);
    });

    it('expand folder pattern', () => {
        const cwd = processCwd();
        return expect(glob('test/fixtures', cwd)).resolves.toEqual(['test/fixtures/a.js', 'test/fixtures/b.js']);
    });

    it('expand file pattern', () => {
        const cwd = processCwd();
        return expect(glob('test/fixtures-sourcemaps/*.js', cwd)).resolves.toEqual(['test/fixtures-sourcemaps/external.js', 'test/fixtures-sourcemaps/inline.js', 'test/fixtures-sourcemaps/linked.js', 'test/fixtures-sourcemaps/source.js']);
    });

    it('handle file', () => {
        const cwd = processCwd();
        return expect(glob('test/fixtures/a.js', cwd)).resolves.toEqual(['test/fixtures/a.js']);
    });
});
