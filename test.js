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
        test('a{ background:transparent }', 'a{ background:transparent }', done);
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

    it('corrects 8-digit hex value', function (done) {
        testGradient('#fee1600d, transparent',
                     '#fee1600d, rgba(254, 225, 96, 0)', done);
    });

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
                     'rgba(0, 0, 255, 0) 30%,  blue', done);
    });

    it('generates two colour stops when transparent is between two colours', function (done) {
        testGradient('#f00, transparent 50%, #0f0',
                     '#f00, rgba(255, 0, 0, 0) 50%, rgba(0, 255, 0, 0) 50%, #0f0', done);
    });

    it('calculates missing stop lengths when possible', function (done) {
        testGradient('#f00, transparent, #0f0',
                     '#f00, rgba(255, 0, 0, 0) 50%, rgba(0, 255, 0, 0) 50%, #0f0', done);
        testGradient('#f00 30%, transparent, #0f0',
                     '#f00 30%, rgba(255, 0, 0, 0) 65%, rgba(0, 255, 0, 0) 65%, #0f0', done);
        testGradient('#f00 20px, transparent, #0f0 50px',
                     '#f00 20px, rgba(255, 0, 0, 0) 45px, rgba(0, 255, 0, 0) 45px, #0f0 50px', done);
    });

    it('generates an error when missing stop lengths can\'t be calculated', function (done) {
        testGradient(              '#f00 20px, transparent, #0f0',
                     errorString + '#f00 20px, transparent, #0f0', done);
    });

    it('works with linear-gradient angles', function (done) {
        testGradient('to right, transparent, #ff0',
                     'to right, rgba(255, 255, 0, 0), #ff0', done);
        testGradient('27deg, #ff0, transparent',
                     '27deg, #ff0, rgba(255, 255, 0, 0)', done);
    });

    it('works with radial-gradient syntax', function (done) {
        testProperty('background-image', 'radial', 'transparent, #ff0',
                                         'rgba(255, 255, 0, 0), #ff0', done);
        testProperty('background-image', 'radial', 'farthest-side at 20% 30%, #ff0, transparent',
                                         'farthest-side at 20% 30%, #ff0, rgba(255, 255, 0, 0)', done);
    });

    it('works with repeating gradients', function (done) {
        testProperty('background-image', 'repeating-linear', 'transparent, #ff0',
                                                             'rgba(255, 255, 0, 0), #ff0', done);
        testProperty('background-image', 'repeating-radial', '#ff0, transparent',
                                                             '#ff0, rgba(255, 255, 0, 0)', done);
    });

    it('works with conic-gradient syntax', function (done) {
        testProperty('background-image', 'conic', 'transparent, #ff0',
                                                  'rgba(255, 255, 0, 0), #ff0', done);
    });

    it('works on properties other than background-image', function (done) {
        testProperty('background',   'linear', 'transparent, #ff0',
                                               'rgba(255, 255, 0, 0), #ff0', done);
        testProperty('border-image', 'linear', 'transparent, #ff0',
                                               'rgba(255, 255, 0, 0), #ff0', done);
    });

});
