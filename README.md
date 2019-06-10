# PostCSS Gradient Transparency Fix

[![npm][badge-npm-img]][badge-npm]
[![Build Status][badge-ci-img]][badge-ci]
[![Greenkeeper badge][badge-gk-img]][badge-gk]

A [PostCSS] plugin to fix gradient transparency for certain browsers (looking at you, Safari).

## What it does

### The short version

Finds all instances of the `transparent` keyword being used in CSS gradients and tries to replace them with specific colour values.


### The long version (a.k.a. Why it’s needed)

Back when the [CSS gradients] specification was first written, it defined colour transitions as simple interpolations in the RGB colour space. A lot of web developers started being caught out by gradients that faded to full transparency, and noticed dark greys in their gradients.

![Gradient using old spec][img-non-premul]

The reason for the darkness is that the CSS keyword `transparent` is actually an alias for `rgba(0, 0, 0, 0)` — that is, fully transparent _black_. A simple definition like `linear-gradient(red, transparent)` would not only fade the colour from fully opaque to fully transparent, but it would _also_ fade from red to black at the same time.

While this was correct from a technical view, it was unintuitive behaviour to web developers. Eventually the spec was changed to codify the use of a special graphics technique called _[pre-multiplied alpha][premul]_. While the specifics of this technique are not important here, the results are. Effectively it means that gradients fading to/from a fully transparent colour now eliminate the “fade to black” part, and look much more like developers expect them to.

![Gradient using new spec][img-premul]

Of course, there’s a catch — not all the browsers have implemented the updated version of the spec. If you write a gradient with a `transparent` value, it will look the way you intended in some browsers but not in others.

At the current time (February 2016), the following browsers support CSS gradients but do **not** support the updated spec:

* Desktop Safari
* iOS Safari
* ...yup, that’s it (I honestly expected this list to be bigger)

The solution for those browsers is to not use the `transparent` keyword at all, but instead use specific `rgba()` or `hsla()` values that have full transparency but keep the colour the same:

```css
/* Original */
.thingy {
    background-image: linear-gradient(green, transparent);
}

/* Compatible version */
.thingy {
    background-image: linear-gradient(green, rgba(0, 128, 0, 0));
}
```

If you have colours either side of a `transparent` keyword, you need to create _two_ transparent colour stops at the same position in order to keep the colour transitions the same:

```css
/* Original */
.thingy {
    background-image: linear-gradient(green, transparent 50%, blue);
}

/* Compatible version */
.thingy {
    background-image: linear-gradient(green, rgba(0, 128, 0, 0) 50%,
                                             rgba(0, 0, 255, 0) 50%, blue);
}
```

If you’re manually editing your gradients to do this, it can become easy to make mistakes — especially if you have to convert from `#rgb` hex values in the process.

That’s where this plugin comes in. You can continue to author your gradients with `transparent` values, and the plugin will transform them into the more compatible version for you.

It will only transform `transparent` values that are found in gradients. Using `background-color: transparent`, for example, will be left unchanged.


## Examples

Input:
```css
.simple {
    background-image: linear-gradient(transparent, red);
}
.keep-stop-positions {
    background-image: linear-gradient(transparent 40%, #f00 60%);
}
.complex {
    background: transparent radial-gradient(farthest-side at 30px 2em, red, transparent),
                linear-gradient(hsl(230, 45%, 86%), transparent 3em, peachpuff);
}
```

Output:
```css
.simple {
    background-image: linear-gradient(rgba(255, 0, 0, 0), red);
}
.keep-stop-positions {
    background-image: linear-gradient(rgba(255, 0, 0, 0) 40%, #f00 60%);
}
.complex {
    background: transparent radial-gradient(farthest-side at 30px 2em, red, rgba(255, 0, 0, 0)),
                linear-gradient(hsl(230, 45%, 86%), hsla(230, 45%, 86%, 0) 3em, rgba(255, 218, 185, 0) 3em, peachpuff);
}
```

## Usage

Install the plugin via [npm](npm): `npm install postcss-gradient-transparency-fix`

Then include it in your project in the same way as other PostCSS plugins. For example:

```js
postcss([ require('postcss-gradient-transparency-fix') ])
```

See the [PostCSS] docs for examples for your environment.


## Caveats, warnings, etc.

### `transparent` only

Only values of the keyword `transparent` will be altered. Any other transparent colours, including `rgba(0, 0, 0, 0)`, will be left unchanged as they could be specifically intended as those values. Browsers that do not support premultiplied alpha (see the list above) will still show different results.

### Define stop positions

For best results, **define explicit stop positions** for the `transparent` colour stops. The plugin will try to guess missing stop positions where possible, but due to the nature of gradient calculations, some position values can _only_ be calculated by the browser at the time of rendering. [Do you really understand CSS linear-gradients](linear-brosset) gives many details of how browsers calculate stop positions.

Some examples of what is supported:

```css
/* No positions at all, assumes 50% */
(red, transparent, green) -> (red, transparent 50%, green)

/* One stop has a percentage value, context can be calculated */
(red 50%, transparent, green) -> (red 50%, transparent 75%, green)

/* Surrounding stops have positions with the same unit type */
(red 30px, transparent, green 80px) -> (red 30px, transparent 55px, green 80px)
```

Examples of positions that cannot be calculated at all:

```css
/* One stop has a non-percentage value, context depends on final rendered size */
(red 100px, transparent, green)

/* Surrounding stops have different unit types */
(red 100px, transparent, green 80%)

/* Surrounding stops use calc() */
(red 1em, transparent, green calc(100% - 1em))
```


[badge-npm]:     https://www.npmjs.com/package/postcss-gradient-transparency-fix
[badge-npm-img]: https://img.shields.io/npm/v/postcss-gradient-transparency-fix.svg
[badge-ci]:      https://travis-ci.org/gilmoreorless/postcss-gradient-transparency-fix
[badge-ci-img]:  https://travis-ci.org/gilmoreorless/postcss-gradient-transparency-fix.svg
[badge-gk]:      https://greenkeeper.io/
[badge-gk-img]:  https://badges.greenkeeper.io/gilmoreorless/postcss-gradient-transparency-fix.svg

[PostCSS]: https://github.com/postcss/postcss
[img-non-premul]: https://rawgit.com/gilmoreorless/postcss-gradient-transparency-fix/master/img/example-non-premul.svg
[img-premul]:     https://rawgit.com/gilmoreorless/postcss-gradient-transparency-fix/master/img/example-premul.svg
[CSS gradients]:  https://www.w3.org/TR/css3-images/
[premul]:         https://www.w3.org/TR/2012/CR-css3-images-20120417/#color-stop-syntax
[linear-brosset]: https://medium.com/@patrickbrosset/do-you-really-understand-css-linear-gradients-631d9a895caf
