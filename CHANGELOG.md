# Change Log
All notable changes to this project will be documented in this file (the format is based on [Keep a Changelog](http://keepachangelog.com/)).
This project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]
### Added
- Added support for 4- and 8-digit hex colour values via the `color-string` dependency

### Changed
- Updated `color` dependency to 2.0.0
- Updated `chai`, `eslint` and `mocha` dev dependencies

## 2.0.0 – 2017-05-23
### :warning: Breaking change
- Updated `postcss` dependency to 6.0.1 – this means Node.js 0.12 is no longer supported

## 1.0.4 – 2017-05-23
### Fixed
- CSS comments in gradient values are no longer stripped out (#18)

## 1.0.3 – 2016-12-07
### Changed
- Updated `color` dependency to 1.0.2
- Updated `eslint` and `mocha` dev dependencies
- Dropped active testing for Node.js 0.12 (the plugin still works though)

### Fixed
- Gracefully handle invalid colour definitions (now generates a proper PostCSS warning, instead of logging an exception)

## 1.0.2 – 2016-03-23
### Changed
- Updated eslint config and fixed new linting errors
- Changed test suite structure and included a visual comparison page

## 1.0.1 – 2016-02-21
### Changed
- Updated npm dependencies

## 1.0.0 – 2016-02-20
### Changed
- Smarter calculation of gradient stop positions for smaller CSS output (#1, #2)

## 0.1.0 – 2016-02-17
### Added
- First working version
