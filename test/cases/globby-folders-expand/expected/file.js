var x = 1;


/**
 * Redefine "x"
 * @type {number}
 */
x = 10;
var y = 2;







y = 5;
debugger;
// End of this test file
'use strict';

module.exports = function isObject(x) {
	return typeof x === 'object' && x !== null;
};
