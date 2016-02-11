var postcss = require('postcss');
var expect  = require('chai').expect;

var plugin = require('./');

var errorString = '/* ERROR: Unable to calculate transparency stop lengths. Please use explicit stop values. */\n';

var test = function (input, output, opts, done) {
    if (typeof opts === 'function' && done === undefined) {
        done = opts;
        opts = {};
    }
    postcss([ plugin(opts) ]).process(input).then(function (result) {
        expect(result.css).to.eql(output);
        expect(result.warnings()).to.be.empty;
        done();
    }).catch(function (error) {
        done(error);
    });
};

var testProperty = function (prop, gradType, input, output, opts, done) {
    var prefix = '.test{ ' + prop + ':' + gradType + '-gradient( ';
    var suffix = ' ); }';
    input = prefix + input + suffix;
    output = prefix + output + suffix;
    return test(input, output, opts, done);
};

var testGradient = function (input, output, opts, done) {
    return testProperty('background-image', 'linear', input, output, opts, done);
};

/* global describe, it */
describe('postcss-gradient-transparency-fix', function () {

    it('ignores non-gradient transparent values', function (done) {
        test('a{ background:transparent }',
             'a{ background:transparent }', done);
    });

    it('ignores gradients without transparent values', function (done) {
        testGradient('red, blue',
                     'red, blue', done);
    });

    it('doesn\'t change rgba(r,g,b,0) values', function (done) {
        testGradient('rgb(255,0,0), rgba(0,0,0,0)',
                     'rgb(255,0,0), rgba(0,0,0,0)', done);
    });

    it('corrects single rgb() value', function (done) {
        testGradient('rgb(255,0,0), transparent',
                     'rgb(255,0,0), rgba(255, 0, 0, 0)', done);
    });

    it('corrects single rgba() value', function (done) {
        testGradient('rgba(120, 0, 200, 0.5), transparent',
                     'rgba(120, 0, 200, 0.5), rgba(120, 0, 200, 0)', done);
    });

    it('corrects single hsl() value', function (done) {
        testGradient('hsl(204, 30%, 70%), transparent',
                     'hsl(204, 30%, 70%), hsla(204, 30%, 70%, 0)', done);
    });

    it('corrects single hsla() value', function (done) {
        testGradient('hsla(123,50%,50%,0.7), transparent',
                     'hsla(123,50%,50%,0.7), hsla(123, 50%, 50%, 0)', done);
    });

    it('corrects 3-digit hex value', function (done) {
        testGradient('#fed, transparent',
                     '#fed, rgba(255, 238, 221, 0)', done);
    });

    it('corrects 6-digit hex value', function (done) {
        testGradient('#5adCab,transparent',
                     '#5adCab,rgba(90, 220, 171, 0)', done);
    });

    // TODO: Submit fix to color-string module to get this working
    // it('corrects 8-digit hex value', function (done) {
    //     testGradient('#fee1600d, transparent',
    //                  '#fee1600d, rgba(254, 225, 96, 0)', done);
    // });

    it('corrects named colours', function (done) {
        testGradient('papayawhip, transparent',
                     'papayawhip, rgba(255, 239, 213, 0)', done);
    });

    it('handles any order', function (done) {
        testGradient('transparent,  blue',
                     'rgba(0, 0, 255, 0),  blue', done);
    });

    it('maintains stop positions', function (done) {
        testGradient('transparent 30%, blue',
                     'rgba(0, 0, 255, 0) 30%, blue', done);
    });

    it('generates two colour stops when transparent is between two colours', function (done) {
        testGradient('#f00,  transparent 50%, #0f0',
                     '#f00,  rgba(255, 0, 0, 0) 50%, rgba(0, 255, 0, 0) 50%, #0f0', done);
    });

    it('calculates missing stop points when possible (no stop points defined)', function (done) {
        testGradient('#f00, transparent, #0f0',
                     '#f00, rgba(255, 0, 0, 0) 50%, rgba(0, 255, 0, 0) 50%, #0f0', done);
    });

    it('calculates missing stop points when possible (one stop point defined)', function (done) {
        testGradient('#f00 30%, transparent, #0f0',
                     '#f00 30%, rgba(255, 0, 0, 0) 65%, rgba(0, 255, 0, 0) 65%, #0f0', done);
    });

    it('calculates missing stop points when possible (two stop points defined)', function (done) {
        testGradient('#f00 20px, transparent, #0f0 50px',
                     '#f00 20px, rgba(255, 0, 0, 0) 45px, rgba(0, 255, 0, 0) 45px, #0f0 50px', done);
    });

    it('generates an error when missing stop points can\'t be calculated', function (done) {
        // TODO: Make this work with PostCSS's warning system
        testGradient(              '#f00 20px, transparent, #0f0',
                     errorString + '#f00 20px, transparent, #0f0', done);
    });

    it('handles multiple transparent values in a single gradient', function (done) {
        testGradient('#f00, transparent, #0f0, transparent, #00f',
                     '#f00, rgba(255, 0, 0, 0) 25%, rgba(0, 255, 0, 0) 25%, #0f0, rgba(0, 255, 0, 0) 75%, rgba(0, 0, 255, 0) 75%, #00f', done);
    });

    it('handles consecutive transparent values (middle)', function (done) {
        testGradient('#f00, transparent, transparent, #0f0',
                     '#f00, rgba(255, 0, 0, 0) 33%, rgba(0, 255, 0, 0) 67%, #0f0', done);
    });

    it('handles consecutive transparent values (middle with stop points)', function (done) {
        testGradient('#f00, transparent 25%, transparent 73%, #0f0',
                     '#f00, rgba(255, 0, 0, 0) 25%, rgba(0, 255, 0, 0) 73%, #0f0', done);
    });

    it('handles consecutive transparent values (start)', function (done) {
        testGradient('transparent, transparent, #0f0',
                     'rgba(0, 255, 0, 0) 0%, rgba(0, 255, 0, 0) 50%, #0f0', done);
    });

    it('handles multiple gradients', function (done) {
        testGradient('transparent, blue), linear-gradient(red, transparent',
                     'rgba(0, 0, 255, 0),  blue), linear-gradient(red, rgba(255, 0, 0, 0))', done);
    });

    it('ignores non-gradient multiple background values', function (done) {
        testProperty('background', 'linear',
            'transparent, blue), transparent, url(http://example.com/transparent.png)',
            'rgba(0, 0, 255, 0), blue), transparent, url(http://example.com/transparent.png)', done);
    });

    it('works with linear-gradient angles (keyword)', function (done) {
        testGradient('to right, transparent, #ff0',
                     'to right, rgba(255, 255, 0, 0), #ff0', done);
    });

    it('works with linear-gradient angles (unit)', function (done) {
        testGradient('27deg, #ff0, transparent',
                     '27deg, #ff0, rgba(255, 255, 0, 0)', done);
    });

    it('works with radial-gradient syntax (basic)', function (done) {
        testProperty('background-image', 'radial', 'transparent, #ff0',
                                                   'rgba(255, 255, 0, 0), #ff0', done);
    });

    it('works with radial-gradient syntax (keyword)', function (done) {
        testProperty('background-image', 'radial', 'ellipse, transparent, #ff0',
                                                   'ellipse, rgba(255, 255, 0, 0), #ff0', done);
    });

    it('works with radial-gradient syntax (keyword + position)', function (done) {
        testProperty('background-image', 'radial', 'farthest-side at 20% 30%, transparent, #ff0',
                                                   'farthest-side at 20% 30%, rgba(255, 255, 0, 0), #ff0', done);
    });

    it('works with radial-gradient syntax (size + position)', function (done) {
        testProperty('background-image', 'radial', '30px 2em at 20% 30%, transparent, #ff0',
                                                   '30px 2em at 20% 30%, rgba(255, 255, 0, 0), #ff0', done);
    });

    it('works with repeating linear gradients', function (done) {
        testProperty('background-image', 'repeating-linear', 'transparent, #ff0',
                                                             'rgba(255, 255, 0, 0), #ff0', done);
    });

    it('works with repeating radial gradients', function (done) {
        testProperty('background-image', 'repeating-radial', 'transparent, #ff0',
                                                             'rgba(255, 255, 0, 0), #ff0', done);
    });

    it('works with conic-gradient syntax', function (done) {
        testProperty('background-image', 'conic', 'transparent, #ff0',
                                                  'rgba(255, 255, 0, 0), #ff0', done);
    });

    it('works on properties other than background-image (background)', function (done) {
        testProperty('background',   'linear', 'transparent, #ff0',
                                                'rgba(255, 255, 0, 0), #ff0', done);
    });

    it('works on properties other than background-image (border-image)', function (done) {
        testProperty('border-image', 'linear', 'transparent, #ff0',
                                                'rgba(255, 255, 0, 0), #ff0', done);
    });

});
