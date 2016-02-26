var fs = require('fs');
var os = require('os');
var path = require('path');
var Mocha = require('mocha');
var escape = Mocha.utils.escape;

function GradientReporter(runner) {

    var htmlBits = [];
    var rBackground = /\b(background(?:-.+?)?\s*:([^;]+));/;

    function getBackground(str) {
        var match = str.match(rBackground);
        return match ? (match[1] || '').trim() : undefined;
    }

    function addTest(test) {
        if (!test.data || !test.data.input) {
            return;
        }
        var inputBg = getBackground(test.data.input);
        var outputBg = getBackground(test.data.actual);
        if (!inputBg || !outputBg) {
            return;
        }
        inputBg = escape(inputBg);
        outputBg = escape(outputBg);
        htmlBits.push(
            '<div class="test test-' + escape(test.state) + '">',
                '<h3>' + escape(test.title) + '</h3>',
	            '<p>Input: <code>' + inputBg + '</code></p>',
                '<div class="example" style="' + inputBg + '"></div>',
                '<div class="example" style="' + outputBg + '"></div>',
	            '<p>Output: <code>' + outputBg + '</code></p>'
        );
        if (test.data.warnings) {
            test.data.warnings.forEach(function (warning) {
                htmlBits.push('<p class="warning">Warning: <code>' + escape(warning) + '</code></p>');
            });
        }
        htmlBits.push('</div>');
    }

    function writeHTML() {
        var htmlTemplate = fs.readFileSync(path.join(__dirname, 'visual-template.html'), {encoding: 'utf-8'});
        var htmlOutput = htmlTemplate.replace('{{{content}}}', htmlBits.join('\n'));
        var outputFilename = path.join(os.tmpdir(), 'postcss-gradient-tests.html');
        fs.writeFileSync(outputFilename, htmlOutput);
        console.log(outputFilename);
    }

    runner.on('suite', function (suite) {
        if (!suite.root) {
            htmlBits.push('<h2>' + escape(suite.title) + '</h2>');
        }
    });

    runner.on('pass', addTest);
    runner.on('fail', addTest);

    runner.on('end', function () {
        // Mocha swallows errors here so this is a bypass to make sure they're visible
        try {
            writeHTML();
            process.exit(0);
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    });
}

module.exports = GradientReporter;
