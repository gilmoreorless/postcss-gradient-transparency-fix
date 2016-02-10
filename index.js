var postcss = require('postcss');
var valueParser = require('postcss-value-parser');
var colorUtil = require('color');

var rProp = /(^background|-image)$/;
var rGradient = /-gradient/;
var rTransparent = /\btransparent\b/;
var rHsl = /^hsla?$/;

function hasGradient(str) {
    return rGradient.test(str);
}

function hasTransparent(str) {
    return rTransparent.test(str);
}

function isHsl(str) {
    return rHsl.test(str);
}

function getTransparentColour(stop) {
    var node = stop[0];
    var parsed = colorUtil(valueParser.stringify(node));
    parsed.alpha(0);
    // Try to match the input format as much as possible
    var fn = 'rgbString';
    if (node.type === 'function' && isHsl(node.value)) {
        fn = 'hslString';
    }
    return parsed[fn]();
}

function updateNodeValue(node, colour) {
    node.type = 'word';
    node.value = colour;
}

function fixGradient(imageNode) {
    // console.log(imageNode);
    var prevStop, nextStop;
    // Build a list of stop nodes in [colour, stopLength] format
    var stopList = [];
    var curStop = [];
    imageNode.nodes.forEach(function (node) {
        // Dividers (commas) define the end of a stop
        if (node.type === 'div') {
            stopList.push(curStop);
            curStop = [];
            return;
        }
        if (node.type === 'function' || node.type === 'word') {
            curStop.push(node);
        }
    });
    if (curStop.length) {
        stopList.push(curStop);
    }

    // Run through each stop and fix transparent values
    stopList.forEach(function (stop, i) {
        var colourNode = stop[0];
        var positionNode = stop[1];
        // console.log(node, '---', valueParser.stringify(node), i);
        if (colourNode.type === 'word' && colourNode.value === 'transparent') {
            nextStop = stopList[i + 1];
            // TODO: Handle angle/position prevStop values
            // (red, transparent)
            if (prevStop && !nextStop) {
                updateNodeValue(colourNode, getTransparentColour(prevStop));
            // (transparent, red)
            } else if (!prevStop && nextStop) {
                updateNodeValue(colourNode, getTransparentColour(nextStop));
            // (red, transparent, blue)
            } else if (prevStop && nextStop) {
                // TODO: Make this work
            }
        }
        prevStop = stop;
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
