var postcss = require('postcss');
var expect  = require('chai').expect;

var plugin = require('./');

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

var testGradient = function (input, output, opts, done) {
    var prefix = '.test{ background-image:linear-gradient( ';
    var suffix = ' ); }';
    input = prefix + input + suffix;
    output = prefix + output + suffix;
    return test(input, output, opts, done);
};

/* global describe, it */
describe('postcss-gradient-transparency-fix', function () {

    it('ignores non-gradient transparent values', function (done) {
        return test('a{ background:transparent }', 'a{ background:transparent }', done);
    });

    it('corrects single rgb() value', function (done) {
        return testGradient('rgb(255,0,0), transparent', 'rgb(255,0,0), rgba(255,0,0,0)', done);
    });

});


/*

TO TEST:

- rgb()
- rgba()
- hsl()
- hsla()
- hex (3)
- hex (6)
- hex (8)
- named colours

- one value (colour, trans)
- one value (trans, colour)
- two values
- different gradient types
- different properties (wherever image is supported)
*/
