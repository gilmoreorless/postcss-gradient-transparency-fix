# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]
### Changed
- Updated color dependency
- Updated eslint and mocha dev dependencies
- Dropped active testing for Node 0.12 (the plugin still works though)

### Fixed
- Gracefully handle invalid colour definitions (now generates a proper PostCSS warning, instead of logging an exception)

## 1.0.2 - 2016-03-23
### Changed
- Updated eslint config and fixed new linting errors
- Changed test suite structure and included a visual comparison page

## 1.0.1 - 2016-02-21
### Changed
- Updated npm dependencies

## 1.0.0 - 2016-02-20
### Changed
- Smarter calculation of gradient stop positions for smaller CSS output

## 0.1.0 - 2016-02-17
### Added
- First working version
