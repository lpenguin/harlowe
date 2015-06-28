module.exports = function (grunt) {
	"use strict";
	
	var
		// Source files
		sourceHTML = ['template.html'],
		jsFileList = ['js/**/*.js'],
		
		// Destinations
		destCSS        = "./build/harlowe-css.css",
		destJS         = "./build/harlowe-min.js",
		
		destMarkupJS   = "./build/twinemarkup-min.js",
		
		// Standard replacements
		scriptStyleReplacements = [{
			from: '{{CSS}}',
			to: function () {
				return '<style title="Twine CSS">' + grunt.file.read(destCSS) + '</style>';
			}
		}, {
			from: '{{HARLOWE}}',
			to: function () {
				return '<script title="Twine engine code" data-main="harlowe">' + grunt.file.read(destJS) + '</script>\n';
			}
		}];
	
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		clean: {
			dist: ['dist/'],
			build: ['build/']
		},
		babel: {
			all: {
				files: [{
					expand:true,
					src:  destJS,
					dest: "./",
				},
				{
					expand:true,
					src:  destMarkupJS,
					dest: "./",
				}],
			},
		},
		uglify: {
			all: {
				options: { beautify: true },
				files: (function() {
					var ret = {};
					ret[destJS] = [destJS];
					ret[destMarkupJS] = [destMarkupJS];
					return ret;
				}())
			}
		},
		jshint: {
			harlowe: jsFileList,
			options: {
				globals: {
					Map         : true,
					Set         : true,
					require     : true,
					define      : true,
					module      : true,
					global      : true,
					// Used by CodeMirror.mode
					StoryFormat : true,
					CodeMirror  : true,
					_           : true,
				},
				// Enforcing options
				eqeqeq   : true,
				immed    : true,
				latedef  : "nofunc",
				noarg    : true,
				nonew    : true,
				undef    : true,
				unused   : true,
				strict   : true,
				// Relaxing options
				evil     : true,
				expr     : true,
				laxbreak : true,
				validthis: true,
				debug    : true,
				newcap   : false,
				// Environments
				browser  : true,
				devel    : true,
				esnext   : true,
			},
			tests: {
				files: {
					src: ['test/spec/*/*.js'],
				},
				options: {
					globals: {
						// Jasmine
						describe : true,
						expect   : true,
						it       : true,
						afterEach: true,
						beforeEach:true,
						// User-defined
						createPassage : true,
						runPassage : true,
						goToPassage : true,
						htmlOfPassage : true,
						expectMarkupToBecome : true,
						expectMarkupToPrint : true,
						expectMarkupToError : true,
						expectMarkupNotToError : true,
						expectMarkupToNotError : true,
						$ : true,
					},
					globalstrict: true,
				},
			},
		},
		
		requirejs: {
			markup: {
				options: {
					baseUrl: 'js/markup',
					name: 'markup',
					include: ['codemirror/mode'],
					useStrict: true,
					optimize: "none",
					out: function(src) {
						/*
							Crudely edit out the final define() call that's added
							for codemirror/mode.
						*/
						src = src.replace(/(?:,|\n)define\([^\;]+\;/g,';');
						grunt.file.write(destMarkupJS, src);
					},
				}
			},
			compile: {
				options: {
					baseUrl: 'js',
					mainConfigFile: 'js/harlowe.js',
					name: 'harlowe',
					include: ['almond'],
					insertRequire: ['harlowe'],
					wrap: true,
					useStrict: true,
					optimize: "none",
					out: destJS,
				},
			},
		},

		sass: {
			dist: {
				files: [{
					expand: true,
					cwd: 'scss/',
					src: ['*.scss'],
					dest: 'build/',
					ext: '.build.css',
					extDot: 'first'
				}],
			}
		},
		cssmin: {
			minify: {
				src: ['./build/*.build.css'],
				dest: destCSS
			}
		},

		replace: {
			runtime: {
				requires: ['requirejs', 'cssmin'],
				src: 'format.js',
				dest: 'dist/format.js',
				replacements: [{
					from: '"source":""',
					to: '"source":' + JSON.stringify(grunt.file.read(sourceHTML)),
				},{
					from: '"setup":""',
					to: function() { return '"setup": function(){' + grunt.file.read(destMarkupJS) + '}'; },
				}].concat(scriptStyleReplacements.map(function(e) {
					return {
						from: e.from,
						to: function() { return JSON.stringify(e.to()).slice(1, -1); }
					};
				}))
			},
		},

		yuidoc: {
			compile: {
				name: '<% pkg.name %>',
				description: '<% pkg.description %>',
				version: '<% pkg.version %>',
				options: {
					paths: 'js/',
					outdir: 'docs/'
				}
			}
		},
	});
	
	grunt.registerTask('examplefile', "Create an example TwineJS output file", function() {
		grunt.file.write('dist/exampleOutput.html',
			[
				{
					from: "{{STORY_DATA}}",
					to: function() {
						return "<tw-storydata startnode='1'><tw-passagedata pid=1 name='Start'>''Success!''</tw-passagedata></tw-storydata>";
					},
				},
				{
					from: "{{STORY_NAME}}",
					to: function() {
						return "Example Output File";
					},
				},
			].concat(scriptStyleReplacements).reduce(function(a, e) {
				return a.replace(e.from, e.to.bind(e));
			}, grunt.file.read(sourceHTML)));
	});
	
	/*
		Load the auxiliary tasks.
	*/
	grunt.loadTasks('tasks');
	
	/*
		Load the standard plugins.
	*/
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-yuidoc');
	grunt.loadNpmTasks('grunt-contrib-requirejs');
	/*
		Notice this isn't grunt-contrib-sass, as that requires Ruby,
		whereas grunt-sass uses libsass and is potentially cross-platform,
		at the expense of being a lower Sass version.
	*/
	grunt.loadNpmTasks('grunt-sass');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-text-replace');
	grunt.loadNpmTasks('grunt-babel');
	
	// Hack to allow ES6 in RequireJS
	grunt.registerTask('es6hack', function hack() {
		var esprima = require('espree');
		esprima.parse = (function(oldparse) {
			return function(code, options) {
				return oldparse(code, {
					ecmaFeatures: {
						arrowFunctions: true,
						blockBindings: true,
						destructuring: true,
						regexYFlag: true,
						regexUFlag: true,
						templateStrings: true,
						binaryLiterals: true,
						octalLiterals: true,
						unicodeCodePointEscapes: true,
						defaultParams: true,
						restParams: true,
						forOf: true,
						objectLiteralComputedProperties: true,
						objectLiteralShorthandMethods: true,
						objectLiteralShorthandProperties: true,
						objectLiteralDuplicateProperties: true,
						generators: true,
						spread: true,
						classes: true,
						modules: true,
					},
					loc: options && options.loc,
				});
			};
		}(esprima.parse));
		require('requirejs').define('esprima', [], function () {
			return esprima;
		});
	});
	
	grunt.registerTask('default', [ 'jshint:harlowe', 'jshint:tests', 'sass', 'cssmin', ]);
	grunt.registerTask('compile', [ 'clean', 'sass', 'cssmin', 'es6hack', 'requirejs', 'babel', 'uglify', ]);
	grunt.registerTask('runtime', [ 'compile', 'replace:runtime', 'examplefile', ]);
	grunt.registerTask('quick',   [ 'sass', 'cssmin', 'es6hack', 'requirejs', 'babel', 'replace:runtime', ]);
};
