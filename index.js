var postcss = require('postcss');
var valueParser = require('postcss-value-parser');
var colorUtil = require('color');

var rProp = /(^background|-image)$/;
var rGradient = /-gradient/;
var rTransparent = /\btransparent\b/;
var rHsl = /^hsla?$/;

var errorString = 'Cannot calculate a stop position for `transparent` value. Please use explicit stop positions.';

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

function isCalc(node) {
    return node && node.type === 'function' && node.value === 'calc';
}

function isTransparentStop(stop) {
    return !!stop.colorNode && stop.colorNode.type === 'word' && stop.colorNode.value === 'transparent';
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

function unitValue(node) {
    return node ? valueParser.unit(node.value) : false;
}

/**
 * Generate a range of evenly-spaced numbers between start and end values (inclusive)
 */
function midRange(start, end, count) {
    count = Math.max(+count || 0, 2); // Force a number greater than 1 (must have at least start/end values)
    count -= 1; // Makes the maths easier
    var diff = end - start;
    var incr = diff / count;
    var ret = [];
    for (var i = 0; i <= count; i++) {
        ret.push(start + incr * i);
    }
    return ret;
}

function round(num, precision) {
    var exp = Math.pow(10, precision);
    return Math.round(num * exp) / exp;
}


// ----- DOMAIN OBJECT: COLOR STOP -----

function ColorStop() {
    this.parent = null;
    this.beforeNode = null;
    this.colorNode = null;
    this.separatorNode = null;
    this.positionNode = null;
    this.warning = null;
    this.parsePosition();
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
    var stop = new ColorStop();
    var keys = [
        'parent', 'beforeNode', 'colorNode', 'separatorNode', 'positionNode'
    ];
    keys.forEach(function (key) {
        if (this[key] !== undefined) {
            var value = this[key];
            stop[key] = key === 'parent' ? value : JSON.parse(JSON.stringify(value));
        }
    }, this);
    return stop;
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

ColorStop.prototype.setPosition = function (positionString, unit) {
    if (unit !== undefined) {
        positionString = '' + positionString + unit;
    }
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
    this.parsePosition();
};

ColorStop.prototype.parsePosition = function () {
    var parsed = unitValue(this.positionNode);
    if (parsed) {
        this.positionNumber = +parsed.number || 0;
        this.positionUnit = parsed.unit;
    } else {
        this.positionNumber = undefined;
        this.positionUnit = isCalc(this.positionNode) ? 'calc' : undefined;
    }
};

ColorStop.prototype.getTransparentColor = function (opts) {
    opts = opts || {};
    var node = this.colorNode;
    if (!node) {
        return 'rgba(0, 0, 0, 0)';
    }
    var parsed = getColor(node, true);
    parsed.alpha(0);
    // Try to match the input format as much as possible
    var fn = 'rgbString';
    if (opts.matchFormat !== false && node.type === 'function' && isHsl(node.value)) {
        fn = 'hslString';
    }
    return parsed[fn]();
};

Object.defineProperties(ColorStop.prototype, {
    isFullyTransparent: {
        get: function () {
            if (this.colorNode) {
                var color = getColor(this.colorNode);
                return color && color.alpha() === 0;
            }
        }
    }
});


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
                    curStop.parsePosition();
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

/**
 * Try to calculate a new stop position exactly halfway between two other stops.
 */
function calculateStopPositions(stop1, stop2, count) {
    var good = function (values, unit) {
        return { values: values, unit: unit };
    };
    var bad = function (warning) {
        return { values: false, unit: '', warning: warning };
    };

    // Exit early if either value is calc()
    if (stop1 && isCalc(stop1.positionNode) || stop2 && isCalc(stop2.positionNode)) {
        return bad(errorString);
    }

    var startPos, endPos, baseUnit;
    var hasStartPos = true;
    var hasEndPos = true;

    var pos1 = stop1 && unitValue(stop1.positionNode);
    var pos2 = stop2 && unitValue(stop2.positionNode);
    if (!pos1) {
        hasStartPos = false;
        pos1 = { number: '0', unit: '%' };
    } else {
        count++;
    }
    if (!pos2) {
        hasEndPos = false;
        pos2 = { number: '100', unit: '%' };
    } else {
        count++;
    }

    // Check if missing stops can be calculated
    if (pos1.unit !== pos2.unit) {
        return bad(errorString);
    }
    startPos = +pos1.number || 0;
    endPos = +pos2.number || 0;
    baseUnit = pos1.unit;

    // Generate as many missing positions as required
    var positions = midRange(startPos, endPos, count);
    // Take off any known positions
    if (hasStartPos) {
        positions.shift();
    }
    if (hasEndPos) {
        positions.pop();
    }

    return good(positions, baseUnit);
}

function assignStopPositions(gradient) {
    var stops = gradient.stops;
    var stop, beforeStop, midStops, afterStop, si, checkStop, positions;
    for (var i = 0, ii = stops.length; i < ii; i++) {
        stop = stops[i];
        if (stop.positionUnit === undefined) {
            beforeStop = stops[i - 1];
            midStops = [stop];
            afterStop = undefined;
            for (si = i + 1; si < ii; si++) {
                checkStop = stops[si];
                if (checkStop.positionNumber === undefined) {
                    midStops.push(checkStop);
                } else {
                    afterStop = checkStop;
                    break;
                }
            }
            // Check for missing values
            positions = calculateStopPositions(beforeStop, afterStop, midStops.length);
            if (positions.warning) {
                midStops.forEach(function (s) {
                    if (isTransparentStop(s)) {
                        s.warning = positions.warning;
                    }
                });
                i += midStops.length;
            } else {
                positions.values && positions.values.forEach(function (value, vi) {
                    midStops[vi].positionNumber = value;
                    midStops[vi].positionUnit = positions.unit;
                });
            }
        }
    }
}

function fixGradient(imageNode, warnings) {
    var gradient = new Gradient(imageNode);

    // Run through each stop and pre-calculate any missing stop positions (where possible)
    assignStopPositions(gradient);

    // Fix transparent values
    gradient.walkStops(function (stop, i) {
        if (isTransparentStop(stop)) {
            var prevStop = gradient.stops[i - 1];
            var nextStop = gradient.stops[i + 1];
            // (red, TRANSPARENT)
            if (prevStop && !nextStop) {
                stop.setColor(prevStop.getTransparentColor());
            // (TRANSPARENT, red)
            } else if (!prevStop && nextStop) {
                stop.setColor(nextStop.getTransparentColor());
            // (red, TRANSPARENT, blue)
            } else if (prevStop && nextStop) {
                // Check if surrounding colours are the same (regardless of alpha values)
                var prevColor = prevStop.getTransparentColor({ matchFormat: false });
                var nextColor = nextStop.getTransparentColor({ matchFormat: false });
                var isSurroundedBySameColors = prevColor === nextColor;
                var isConsecutiveTransparent = prevStop.isFullyTransparent || nextStop.isFullyTransparent;
                var needsExtraStop = !isSurroundedBySameColors && !isConsecutiveTransparent;

                // Add a stop position if required
                if (!stop.positionNode && needsExtraStop) {
                    // Position number/unit should have been pre-calculated.
                    // If it's missing, the position can't be worked out, so nothing more can be done for this stop.
                    if (!stop.positionUnit) {
                        if (stop.warning) {
                            warnings.push(stop.warning);
                        }
                        return;
                    }
                    stop.setPosition(round(stop.positionNumber, 2), stop.positionUnit);
                }

                // Get the right rgb values for the transparency, based on surrounding stops
                var transparentColor = prevStop.getTransparentColor();
                if (!needsExtraStop && prevStop.isFullyTransparent) {
                    transparentColor = nextStop.getTransparentColor();
                }
                stop.setColor(transparentColor);

                // Create an extra stop at the same position
                if (needsExtraStop) {
                    var extraStop = stop.clone();
                    extraStop.setColor(nextStop.getTransparentColor());
                    gradient.insertStopAfter(extraStop, stop);
                }
            }
        }
    });
}

function fixAllGradients(value) {
    var parsed = valueParser(value);
    var warnings = [];
    parsed.walk(function (node) {
        if (node.type === 'function' && hasGradient(node.value)) {
            fixGradient(node, warnings);
            return false;
        }
    });
    return {
        value: parsed.toString(),
        warnings: warnings
    };
}

module.exports = postcss.plugin('postcss-gradient-transparency-fix', function (opts) {
    opts = opts || {};

    return function (css, result) {
        css.walkDecls(rProp, function (decl) {
            if (hasGradient(decl.value) && hasTransparent(decl.value)) {
                var fixedValue = fixAllGradients(decl.value);
                decl.value = fixedValue.value;
                fixedValue.warnings.forEach(function (warning) {
                    decl.warn(result, warning);
                });
            }
        });
    };
});

module.exports.ERROR_STOP_POSITION = errorString;
