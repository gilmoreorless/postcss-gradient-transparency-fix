var postcss = require('postcss');
var valueParser = require('postcss-value-parser');
var colorUtil = require('color');

var rProp = /(^background|-image)$/;
var rGradient = /-gradient/;
var rTransparent = /\btransparent\b/;
var rGradientParts = /^(\w+-gradient\s*\()(.*)(\)\s*)$/;

function hasGradient(str) {
    return rGradient.test(str);
}

function hasTransparent(str) {
    return rTransparent.test(str);
}

function getTransparentColour(node) {
    var parsed = colorUtil(valueParser.stringify(node));
    return parsed.alpha(0).rgbString();
}

function updateNodeValue(node, colour) {
    node.type = 'word';
    node.value = colour;
}

function fixGradient(imageNode) {
    // console.log(imageNode);
    var prevStop, nextStop;
    var stopList = imageNode.nodes.filter(function (node) {
        return node.type === 'function' || node.type === 'word';
    });
    stopList.forEach(function (node, i) {
        // console.log(node, '---', valueParser.stringify(node), i);
        if (node.type === 'word' && node.value === 'transparent') {
            nextStop = stopList[i + 1];
            // TODO: Handle stop values
            // (red, transparent)
            if (prevStop && !nextStop) {
                updateNodeValue(node, getTransparentColour(prevStop));
            // (transparent, red)
            } else if (!prevStop && nextStop) {
                updateNodeValue(node, getTransparentColour(nextStop));
            // (red, transparent, blue)
            } else if (prevStop && nextStop) {
                // TODO: Make this work
            }
        }
        prevStop = node;
    });
}

function fixAllGradients(value) {
    var parsed = valueParser(value);
    parsed.walk(function (node) {
        if (node.type === 'function' && hasGradient(node.value)) {
            fixGradient(node);
            return false;
        }
    });
    return parsed.toString();
}

module.exports = postcss.plugin('postcss-gradient-transparency-fix', function (opts) {
    opts = opts || {};

    return function (css, result) {
        css.walkRules(function (rule) {
            rule.walkDecls(rProp, function (decl) {
                if (hasGradient(decl.value) && hasTransparent(decl.value)) {
                    decl.value = fixAllGradients(decl.value);
                }
            });
        });
    };
});
