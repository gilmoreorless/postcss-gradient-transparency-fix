var expect  = require('chai').expect;
var testSuite = require('./core-tests');

var testOutput = function (result, output, warnings, done) {
    expect(result.css).to.eql(output);
    if (warnings) {
        expect(result.warnings().length).to.equal(warnings.length);
        result.warnings().forEach(function (warning, i) {
            expect(warning.text).to.equal(warnings[i]);
        });
    } else {
        expect(result.warnings()).to.be.empty;
    }
    done();
};

/* global describe, it */
testSuite.run(describe, it, testOutput);
