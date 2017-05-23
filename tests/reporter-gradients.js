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
        var warnings = (test.data.warnings || []).map(function (warning) {
            return `<p class="warning">Warning: <code>${escape(warning)}</code></p>`;
        }).join('');

        htmlBits.push(`
            <div class="test test-${escape(test.state)}">
                <h3>${escape(test.title)}</h3>
                <p>Input: <pre><code>${inputBg}</code></pre></p>
                <div class="examples">
                    <div class="example" style="${inputBg}"></div>
                    <div class="example" style="${outputBg}"></div>
                </div>
                <p>Output: <pre><code>${outputBg}</code></pre></p>
                ${warnings}
            </div>
        `);
    }

    function writeHTML() {
        var htmlTemplate = fs.readFileSync(path.join(__dirname, 'visual-template.html'), { encoding: 'utf-8' });
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
        /* eslint no-process-exit: 0 */
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
