/* global beforeEach, describe, it */

var postcss = require('postcss');
var expect  = require('chai').expect;
var plugin = require('../');

var curData;

function testOutput(result, output, warnings, done) {
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
}

function test(input, output, warnings, done) {
    if (typeof warnings === 'function' && done === undefined) {
        done = warnings;
        warnings = 0;
    }
    curData.input = input;
    curData.expected = output;
    postcss([ plugin() ]).process(input)
        .then(function (result) {
            curData.actual = result.css;
            curData.warnings = result.warnings();
            testOutput(result, output, warnings, done);
        })
        .catch(function (error) {
            curData.error = error;
            done(error);
        });
}

function testProperty(prop, input, output, warnings, done) {
    var prefix = '.test{ ' + prop + ':';
    var suffix = '; }';
    input = prefix + input + suffix;
    output = prefix + output + suffix;
    return test(input, output, warnings, done);
}

function testGradient(prop, gradType, input, output, warnings, done) {
    var prefix = gradType + '-gradient( ';
    var suffix = ' )';
    input = prefix + input + suffix;
    output = prefix + output + suffix;
    return testProperty(prop, input, output, warnings, done);
}

function testLinearGradient(input, output, warnings, done) {
    return testGradient('background-image', 'linear', input, output, warnings, done);
}

// Keep a reference to the current test so that extra data can be added for different reporters
beforeEach(function () {
    curData = this.currentTest.data = {};
});

describe('postcss-gradient-transparency-fix', function () {

    it('ignores non-gradient transparent values', function (done) {
        testProperty('background', 'transparent', 'transparent', done);
    });

    it('ignores gradients without transparent values', function (done) {
        testLinearGradient('red, blue',
                           'red, blue', done);
    });

    it('doesn\'t change rgba(r,g,b,0) values', function (done) {
        testLinearGradient('rgb(255,0,0), rgba(0,0,0,0)',
                           'rgb(255,0,0), rgba(0,0,0,0)', done);
    });

    it('corrects single rgb() value', function (done) {
        testLinearGradient('rgb(255,0,0), transparent',
                           'rgb(255,0,0), rgba(255, 0, 0, 0)', done);
    });

    it('corrects single rgba() value', function (done) {
        testLinearGradient('rgba(120, 0, 200, 0.5), transparent',
                           'rgba(120, 0, 200, 0.5), rgba(120, 0, 200, 0)', done);
    });

    it('corrects single hsl() value', function (done) {
        testLinearGradient('hsl(204, 30%, 70%), transparent',
                           'hsl(204, 30%, 70%), hsla(204, 30%, 70%, 0)', done);
    });

    it('corrects single hsla() value', function (done) {
        testLinearGradient('hsla(123,50%,50%,0.7), transparent',
                           'hsla(123,50%,50%,0.7), hsla(123, 50%, 50%, 0)', done);
    });

    it('corrects 3-digit hex value', function (done) {
        testLinearGradient('#fed, transparent',
                           '#fed, rgba(255, 238, 221, 0)', done);
    });

    it('corrects 6-digit hex value', function (done) {
        testLinearGradient('#5adCab,transparent',
                           '#5adCab,rgba(90, 220, 171, 0)', done);
    });

    // it('corrects 8-digit hex value', function (done) {
    //     testLinearGradient('#fee1600d, transparent',
    //                        '#fee1600d, rgba(254, 225, 96, 0)', done);
    // });

    it('corrects named colours', function (done) {
        testLinearGradient('papayawhip, transparent',
                           'papayawhip, rgba(255, 239, 213, 0)', done);
    });

    it('handles any order', function (done) {
        testLinearGradient('transparent,  blue',
                           'rgba(0, 0, 255, 0),  blue', done);
    });

    it('maintains stop positions (basic)', function (done) {
        testLinearGradient('transparent 30%, blue',
                           'rgba(0, 0, 255, 0) 30%, blue', done);
    });

    it('maintains stop positions (calc)', function (done) {
        testLinearGradient('transparent calc(30% + 2px), blue',
                           'rgba(0, 0, 255, 0) calc(30% + 2px), blue', done);
    });

    it('generates two colour stops when transparent is between two colours', function (done) {
        testLinearGradient(
            '#f00,  transparent 50%, #0f0',
            '#f00,  rgba(255, 0, 0, 0) 50%, rgba(0, 255, 0, 0) 50%, #0f0',
            done);
    });

    it('keeps a single colour stop when transparent is between two identical colours (same format)', function (done) {
        testLinearGradient('#00f, transparent 50%, #00f',
                           '#00f, rgba(0, 0, 255, 0) 50%, #00f', done);
    });

    it('keeps a single colour stop when transparent is between two identical colours (different formats)', function (done) {
        testLinearGradient(
            'rgb(0, 0, 255), transparent 50%, hsl(240, 100%, 50%)',
            'rgb(0, 0, 255), rgba(0, 0, 255, 0) 50%, hsl(240, 100%, 50%)',
            done);
    });

    it('keeps a single colour stop when transparent is between two colours that are the same, with different alpha', function (done) {
        testLinearGradient(
            'rgb(0, 0, 255), transparent 50%, rgba(0, 0, 255, 0.9)',
            'rgb(0, 0, 255), rgba(0, 0, 255, 0) 50%, rgba(0, 0, 255, 0.9)',
            done);
    });

    it('calculates missing stop positions when possible (no stop positions defined)', function (done) {
        testLinearGradient(
            '#f00, transparent, #0f0',
            '#f00, rgba(255, 0, 0, 0) 50%, rgba(0, 255, 0, 0) 50%, #0f0',
            done);
    });

    it('calculates missing stop positions when possible (one % stop position defined before, one undefined after)', function (done) {
        testLinearGradient(
            '#f00 30%, transparent, #0f0',
            '#f00 30%, rgba(255, 0, 0, 0) 65%, rgba(0, 255, 0, 0) 65%, #0f0',
            done);
    });

    it('calculates missing stop positions when possible (one % stop position defined before, two undefined after)', function (done) {
        testLinearGradient(
            '#f00 30%, transparent, #0f0, #00f',
            '#f00 30%, rgba(255, 0, 0, 0) 53.33%, rgba(0, 255, 0, 0) 53.33%, #0f0, #00f',
            done);
    });

    it('calculates missing stop positions when possible (one % stop position defined after, one undefined before)', function (done) {
        testLinearGradient(
            '#f00, transparent, #0f0 70%',
            '#f00, rgba(255, 0, 0, 0) 35%, rgba(0, 255, 0, 0) 35%, #0f0 70%',
            done);
    });

    it('calculates missing stop positions when possible (one % stop position defined after, two undefined before)', function (done) {
        testLinearGradient(
            '#f00, #0f0, transparent, #00f 70%',
            '#f00, #0f0, rgba(0, 255, 0, 0) 46.67%, rgba(0, 0, 255, 0) 46.67%, #00f 70%',
            done);
    });

    it('calculates missing stop positions when possible (two stop positions defined)', function (done) {
        testLinearGradient(
            '#f00 20px, transparent, #0f0 50px',
            '#f00 20px, rgba(255, 0, 0, 0) 35px, rgba(0, 255, 0, 0) 35px, #0f0 50px',
            done);
    });

    it('doesn\'t need to calculate a missing stop position when transparent is between identical colours', function (done) {
        testLinearGradient('#00f, transparent, #00f',
                           '#00f, rgba(0, 0, 255, 0), #00f', done);
    });

    it('doesn\'t warn about a missing stop position when transparent is between identical colours', function (done) {
        testLinearGradient('#00f calc(10% + 10px), transparent, #00f',
                           '#00f calc(10% + 10px), rgba(0, 0, 255, 0), #00f', done);
    });

    it('generates a warning when missing stop points can\'t be calculated (missing non-% unit)', function (done) {
        var input = '#f00 20px, transparent, #0f0';
        testLinearGradient(input, input, [plugin.ERROR_STOP_POSITION], done);
    });

    it('generates a warning when missing stop points can\'t be calculated (mixed units)', function (done) {
        var input = '#f00 10%, transparent, #0f0 20em';
        testLinearGradient(input, input, [plugin.ERROR_STOP_POSITION], done);
    });

    it('generates a warning when missing stop points can\'t be calculated (calc units)', function (done) {
        var input = '#f00 calc(10% + 1em), transparent, #0f0 calc(90% - 1em)';
        testLinearGradient(input, input, [plugin.ERROR_STOP_POSITION], done);
    });

    it('generates a warning about invalid colours', function (done) {
        var input = 'transparent, thisdoesntexist'
        testLinearGradient(input, input, [plugin.ERROR_INVALID_COLOR], done);
    });

    it('handles multiple transparent values in a single gradient', function (done) {
        testLinearGradient(
            '#f00, transparent, #0f0, transparent, #00f',
            '#f00, rgba(255, 0, 0, 0) 25%, rgba(0, 255, 0, 0) 25%, #0f0, rgba(0, 255, 0, 0) 75%, rgba(0, 0, 255, 0) 75%, #00f',
            done);
    });

    it('optimises stops for consecutive transparent values (middle)', function (done) {
        testLinearGradient(
            '#f00, transparent, transparent, #0f0',
            '#f00, rgba(255, 0, 0, 0), rgba(0, 255, 0, 0), #0f0',
            done);
    });

    it('optimises stops for consecutive transparent values (middle with stop points)', function (done) {
        testLinearGradient(
            '#f00, transparent 25%, transparent 73%, #0f0',
            '#f00, rgba(255, 0, 0, 0) 25%, rgba(0, 255, 0, 0) 73%, #0f0',
            done);
    });

    it('optimises stops for consecutive transparent values (start)', function (done) {
        testLinearGradient(
            'transparent, transparent, #0f0',
            'rgba(0, 0, 0, 0), rgba(0, 255, 0, 0), #0f0',
            done);
    });

    it('optimises stops for consecutive transparent values (end)', function (done) {
        testLinearGradient(
            '#0f0, transparent, transparent',
            '#0f0, rgba(0, 255, 0, 0), rgba(0, 255, 0, 0)',
            done);
    });

    it('handles multiple gradients', function (done) {
        testLinearGradient(
            'transparent, blue), linear-gradient(red, transparent',
            'rgba(0, 0, 255, 0), blue), linear-gradient(red, rgba(255, 0, 0, 0)',
            done);
    });

    it('ignores non-gradient multiple background values', function (done) {
        testProperty('background',
            'linear-gradient(transparent, blue), transparent, url(http://example.com/transparent.png)',
            'linear-gradient(rgba(0, 0, 255, 0), blue), transparent, url(http://example.com/transparent.png)',
            done);
    });

    it('works with linear-gradient angles (keyword)', function (done) {
        testLinearGradient('to right, transparent, #ff0',
                           'to right, rgba(255, 255, 0, 0), #ff0', done);
    });

    it('works with linear-gradient angles (unit)', function (done) {
        testLinearGradient('27deg, #ff0, transparent',
                           '27deg, #ff0, rgba(255, 255, 0, 0)', done);
    });

    it('works with radial-gradient syntax (basic)', function (done) {
        testGradient('background-image', 'radial',
            'transparent, #ff0',
            'rgba(255, 255, 0, 0), #ff0',
            done);
    });

    it('works with radial-gradient syntax (keyword)', function (done) {
        testGradient('background-image', 'radial',
            'ellipse, #ff0, transparent',
            'ellipse, #ff0, rgba(255, 255, 0, 0)',
            done);
    });

    it('works with radial-gradient syntax (keyword + position)', function (done) {
        testGradient('background-image', 'radial',
            'farthest-side at 20% 30%, transparent, #ff0',
            'farthest-side at 20% 30%, rgba(255, 255, 0, 0), #ff0',
            done);
    });

    it('works with radial-gradient syntax (size + position)', function (done) {
        testGradient('background-image', 'radial',
            '30px 2em at 20% 30%, transparent, #ff0',
            '30px 2em at 20% 30%, rgba(255, 255, 0, 0), #ff0',
            done);
    });

    it('works with repeating linear gradients', function (done) {
        testGradient('background-image', 'repeating-linear',
            'transparent, #ff0',
            'rgba(255, 255, 0, 0), #ff0',
            done);
    });

    it('works with repeating radial gradients', function (done) {
        testGradient('background-image', 'repeating-radial',
            'transparent, #ff0',
            'rgba(255, 255, 0, 0), #ff0',
            done);
    });

    it('works with conic-gradient syntax', function (done) {
        testGradient('background-image', 'conic',
            'transparent, #ff0',
            'rgba(255, 255, 0, 0), #ff0',
            done);
    });

    it('works on properties other than background-image (background)', function (done) {
        testGradient('background', 'linear',
            'transparent, #ff0',
            'rgba(255, 255, 0, 0), #ff0',
            done);
    });

    it('works on properties other than background-image (border-image)', function (done) {
        testGradient('border-image', 'linear',
            'transparent, #ff0',
            'rgba(255, 255, 0, 0), #ff0',
            done);
    });

});
