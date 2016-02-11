var postcss = require('postcss');
var valueParser = require('postcss-value-parser');
var colorUtil = require('color');

var rProp = /(^background|-image)$/;
var rGradient = /-gradient/;
var rTransparent = /\btransparent\b/;
var rHsl = /^hsla?$/;

// ----- UTILITY FUNCTIONS -----

function hasGradient(str) {
    return rGradient.test(str);
}

function hasTransparent(str) {
    return rTransparent.test(str);
}

function isHsl(str) {
    return rHsl.test(str);
}


// ----- DOMAIN OBJECT: COLOR STOP -----

function ColorStop(nodes) {
    nodes = nodes || {};
    this.beforeNode    = nodes.beforeNode;
    this.colorNode     = nodes.colorNode;
    this.separatorNode = nodes.separatorNode;
    this.positionNode  = nodes.positionNode;
}

ColorStop.prototype.nodes = function () {
    var nodes = [];
    if (this.beforeNode)    nodes.push(this.beforeNode);
    if (this.colorNode)     nodes.push(this.colorNode);
    if (this.separatorNode) nodes.push(this.separatorNode);
    if (this.positionNode)  nodes.push(this.positionNode);
    return nodes;
};

ColorStop.prototype.clone = function () {
    // TODO: Make this less hacky
    return new ColorStop(JSON.parse(JSON.stringify(this)));
};

ColorStop.prototype.setColor = function (colorString) {
    if (!this.colorNode) {
        this.colorNode = {};
    }
    this.colorNode.type = 'word';
    this.colorNode.value = colorString;
};

ColorStop.prototype.setPosition = function (positionString) {
    if (!this.separatorNode) {
        this.separatorNode = { type: 'space', value: ' ' };
    }
    if (!this.positionNode) {
        this.positionNode = {};
    }
    this.positionNode.type = 'word';
    this.positionNode.value = positionString;
};

ColorStop.prototype.getTransparentColor = function () {
    var node = this.colorNode;
    if (!node) {
        return 'rgba(0, 0, 0, 0)';
    }
    var parsed = colorUtil(valueParser.stringify(node));
    parsed.alpha(0);
    // Try to match the input format as much as possible
    var fn = 'rgbString';
    if (node.type === 'function' && isHsl(node.value)) {
        fn = 'hslString';
    }
    return parsed[fn]();
};


// ----- DOMAIN OBJECT: GRADIENT -----

function Gradient(parsedNode) {
    this.node = {};
    this.prelude = [];
    this.stops = [];
    this.setNode(parsedNode);

    this._actionQueue = [];
    this._walking = false;
}

Gradient.prototype.setNode = function (node) {
    this.node = node;
    var stopList = this.stops = [];
    if (node.nodes) {
        var curStop = new ColorStop();
        node.nodes.forEach(function (subNode) {
            // TODO: Work out which are "prelude" nodes somehow. For now, assume the first node is a colour
            // Dividers (commas) define the end of a stop
            if (subNode.type === 'div') {
                stopList.push(curStop);
                curStop = new ColorStop();
                curStop.beforeNode = subNode;
            }
            // Spaces are value separators
            if (subNode.type === 'space') {
                curStop.separatorNode = subNode;
            }
            // Function or word is either a colour or a stop position
            if (subNode.type === 'function' || subNode.type === 'word') {
                if (curStop.colorNode) {
                    curStop.positionNode = subNode;
                } else {
                    curStop.colorNode = subNode;
                }
            }
        });
        if (curStop.colorNode) {
            stopList.push(curStop);
        }
    }
};

Gradient.prototype.walkStops = function (fn) {
    this._walking = true;
    this.stops.forEach(fn);
    this._walking = false;
    if (this._actionQueue.length) {
        this._actionQueue.forEach(function (action) {
            action.call(this);
        }, this);
        this._actionQueue = [];
    }
};

Gradient.prototype.insertStopAfter = function (newStop, afterStop) {
    var action = function () {
        // Guarantee that the new stop has a comma node before it
        newStop.beforeNode = { type: 'div', value: ',', before: '', after: ' ' };

        // Add stop to stops list
        var stopIndex = this.stops.indexOf(afterStop);
        if (stopIndex === -1) {
            stopIndex = this.stops.length - 1;
        }
        this.stops.splice(stopIndex + 1, 0, newStop);

        // Add stop's nodes to overall node list
        var referenceNode = afterStop.nodes().slice(-1)[0];
        if (!referenceNode) {
            return;
        }
        var nodeList = this.node.nodes;
        var nodeIndex = nodeList.indexOf(referenceNode);
        if (nodeIndex === -1) {
            nodeIndex = nodeList.length - 1;
        }
        nodeList.splice.apply(nodeList, [nodeIndex + 1, 0].concat(newStop.nodes()));
    };
    if (this._walking) {
        this._actionQueue.push(action);
    } else {
        action();
    }
};


// ----- MAIN ACTIONS -----

function fixGradient(imageNode) {
    var gradient = new Gradient(imageNode);
    // console.log(gradient.stops)

    // Run through each stop and fix transparent values
    gradient.walkStops(function (stop, i) {
        if (stop.colorNode.type === 'word' && stop.colorNode.value === 'transparent') {
            var prevStop = gradient.stops[i - 1];
            var nextStop = gradient.stops[i + 1];
            // (red, transparent)
            if (prevStop && !nextStop) {
                stop.setColor(prevStop.getTransparentColor());
            // (transparent, red)
            } else if (!prevStop && nextStop) {
                stop.setColor(nextStop.getTransparentColor());
            // (red, transparent, blue)
            } else if (prevStop && nextStop) {
                // TODO: Skip this section if prev colour and next colour are the same
                var extraStop = stop.clone();
                stop.setColor(prevStop.getTransparentColor());
                extraStop.setColor(nextStop.getTransparentColor());
                gradient.insertStopAfter(extraStop, stop);
            }
        }
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
