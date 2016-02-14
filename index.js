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

function getColor(node, logErrors) {
    var ret;
    try {
        ret = colorUtil(valueParser.stringify(node));
    } catch (e) {
        ret = false;
        if (logErrors) {
            console.warn(e);
        }
    }
    return ret;
}


// ----- DOMAIN OBJECT: COLOR STOP -----

function ColorStop(nodes) {
    this.parent = null;
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
    var nodes = {};
    ['before', 'color', 'separator', 'position'].forEach(function (prop) {
        var key = prop + 'Node';
        if (this[key]) {
            nodes[key] = JSON.parse(JSON.stringify(this[key]));
        }
    }, this);
    return new ColorStop(nodes);
};

ColorStop.prototype.setColor = function (colorString) {
    if (!this.colorNode) {
        this.colorNode = {};
        if (this.parent) {
            this.parent.syncNodes();
        }
    }
    this.colorNode.type = 'word';
    this.colorNode.value = colorString;
};

ColorStop.prototype.setPosition = function (positionString) {
    var isDirty = false;
    if (!this.separatorNode) {
        this.separatorNode = { type: 'space', value: ' ' };
        isDirty = true;
    }
    if (!this.positionNode) {
        this.positionNode = {};
        isDirty = true;
    }
    if (isDirty && this.parent) {
        this.parent.syncNodes();
    }
    this.positionNode.type = 'word';
    this.positionNode.value = positionString;
};

ColorStop.prototype.getTransparentColor = function () {
    var node = this.colorNode;
    if (!node) {
        return 'rgba(0, 0, 0, 0)';
    }
    var parsed = getColor(node, true);
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
    this.preludeNodes = [];
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
        curStop.parent = this;
        var isPrelude = false;
        var isFirst = true;
        node.nodes.forEach(function (subNode) {
            // Dividers (commas) define the end of a stop
            if (subNode.type === 'div') {
                if (!isPrelude) {
                    stopList.push(curStop);
                    curStop = new ColorStop();
                    curStop.parent = this;
                    curStop.beforeNode = subNode;
                }
                isPrelude = false;
                return;
            }
            // Work out if the "stop" is actually prelude matter (angle/size definitions)
            if (isFirst) {
                isFirst = false;
                var color = getColor(subNode);
                if (!color) {
                    isPrelude = true;
                }
            }
            if (isPrelude) {
                this.preludeNodes.push(subNode);
            // Spaces are value separators
            } else if (subNode.type === 'space') {
                curStop.separatorNode = subNode;
            // Function or word is either a colour or a stop position
            } else if (subNode.type === 'function' || subNode.type === 'word') {
                if (curStop.colorNode) {
                    curStop.positionNode = subNode;
                } else {
                    curStop.colorNode = subNode;
                }
            }
        }, this);
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
        this.syncNodes();
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
    };
    if (this._walking) {
        this._actionQueue.push(action);
    } else {
        action();
    }
};

Gradient.prototype.syncNodes = function () {
    var stopNodes = this.stops.reduce(function (memo, stop) {
        return memo.concat(stop.nodes());
    }, []);
    this.node.nodes = [].concat(this.preludeNodes, stopNodes);
};


// ----- MAIN ACTIONS -----

function unitValue(node) {
    return node ? valueParser.unit(node.value) : false;
}

function midPoint(val1, val2) {
    var num1 = +val1 || 0;
    var num2 = +val2 || 0;
    return num1 + (num2 - num1) / 2;
}

/**
 * Try to calculate a new stop position exactly halfway between two other stops.
 */
function calculateStopPosition(stop1, stop2) {
    var pos1 = unitValue(stop1.positionNode);
    var pos2 = unitValue(stop2.positionNode);

    // No positions defined, default to 50%
    // TODO: Make this smarter
    // TODO: Test calc() values
    if (!pos1 && !pos2) {
        return '50%';
    }
    // Both positions defined
    if (pos1 && pos2) {
        // Both using the same unit
        if (pos1.unit === pos2.unit) {
            return midPoint(pos1.number, pos2.number) + pos1.unit;
        // Different units
        } else {
            // TODO: Do some sort of error
            return '/* ERROR */';
        }
    }
    // Only one position defined
    var startPerc = 0, endPerc = 100;
    if (pos1 && pos1.unit === '%' || pos2 && pos2.unit === '%') {
        if (pos1) {
            startPerc = +pos1.number || 0;
        }
        if (pos2) {
            endPerc = +pos2.number || 0;
        }
        return midPoint(startPerc, endPerc) + '%';
    }
}

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
                // Make sure the stop positions are the same for both transparent stops
                if (!stop.positionNode) {
                    var position = calculateStopPosition(prevStop, nextStop);
                    if (position) {
                        // TODO: Error checking
                        stop.setPosition(position);
                        extraStop.setPosition(position);
                    }
                }
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
