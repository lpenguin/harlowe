// This script builds a single-file version of Harlowe
// by compressing the JS via requireJS's optimizer, then
// interpolating the resulting content into the HTML.
//
// Using a function for an out attribute doesn't seem to
// work when optimizing CSS, so for now we'll just insert
// the CSS as-is. The savings don't look all that impressive
// anyway, at this point.

var requirejs = require('requirejs');
var fs = require('fs');

var JS_PLACEHOLDER = '<script data-main="js/harlowe.js" src="js/require.js"></script>';
var CSS_PLACEHOLDER = '<link rel="stylesheet" href="style.css">';

// read HTML and CSS file

var html = fs.readFileSync('../harlowe.html', 'utf8');
var css = fs.readFileSync('../style.css', 'utf8');

// optimize JS

var compressedJS;

var jsConfig = 
{
	baseUrl: '../js',
	paths:
	{
		requirelib: '../js/require'
	},
	mainConfigFile: '../js/harlowe.js',
	include: ['requirelib'],
	name: 'harlowe',

	out: function (source)
	{
		compressedJS = source;
		assemble();
	}
};

console.log('Optimizing JavaScript...');
requirejs.optimize(jsConfig);

function assemble()
{
	console.log('Assembling final HTML...');

	// we can't do a replace here --
	// source characters will act like backreferences, etc.

	var i = html.indexOf(JS_PLACEHOLDER);
	html = html.substring(0, i) + '<script data-main="harlowe">' + compressedJS +
	       '</script>' + html.substring(i + JS_PLACEHOLDER.length, html.length);

	// life is easier with CSS

	html = html.replace(CSS_PLACEHOLDER, '<style>' + css + '</style>');
	fs.writeFileSync('template.html', html, 'utf8');

	console.log('Wrote template.html.');
};
