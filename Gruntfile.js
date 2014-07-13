module.exports = function (grunt) {
	"use strict";
	var testFile = 'tests/hooktest.html',
		testTitle = 'Harlowe Test',
		
		// Source files
		sourceHTML = ['template.html'],
		jsFileList = ['js/*.js', 'js/wordarray/*.js', 'js/utils/*.js'],
		jsFullFileList = ['js/lib/*.js'].concat(jsFileList),
		cssFileList = ['./css/*.css'],
		
		// Destinations
		destCSS = "./build/harlowe-css.css",
		destJS = "./build/harlowe-min.js",
		
		// Standard replacements
		scriptStyleReplacements = [{
			from: '{{CSS}}',
			to: function () {
				return '<style title="Twine CSS">' + grunt.file.read(destCSS) + '</style>'
			}
		}, {
			from: '{{HARLOWE}}',
			to: function () {
				return '<script title="Twine engine code" data-main="harlowe">' + grunt.file.read(destJS) + '</script>'
			}
		}];
	
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		clean: {
			dist: ['dist/'],
			build: ['build/']
		},

		jshint: {
			all: jsFileList,
			options: {
				globals: {
					require : true,
					define  : true,
					module  : true,
					global  : true
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
				// Environments
				browser  : true,
				devel    : true,
			}
		},

		requirejs: {
			compile: {
				options: {
					baseUrl: 'js',
					mainConfigFile: 'js/harlowe.js',
					include: ['lib/almond', 'harlowe'],
					insertRequire: ['harlowe'],
					name: 'harlowe',
					wrap: true,
					out: destJS
				}
			}
		},

		cssmin: {
			minify: {
				src: cssFileList,
				dest: destCSS
			}
		},

		replace: {
			test: {
				src: sourceHTML,
				dest: 'dist/index.html',
				replacements: [{
					from: '{{STORY_NAME}}',
					to: testTitle,
				}, {
					from: '{{STORY_DATA}}',
					to: grunt.file.read(testFile)
				}, {
					from: '{{CSS}}',
					to: function () {
						var ret = '';
						
						grunt.file.expand(cssFileList).forEach(function(a) {
							ret += '<link rel="stylesheet" href=".' + a + '"/>';
						});
						
						return ret;
					}
				}, {
					from: '{{HARLOWE}}',
					to: '<script data-main="../js/harlowe.js" src="../node_modules/requirejs/require.js"></script>'
				}]
			},
			runtime: {
				requires: ['requirejs', 'cssmin'],
				src: sourceHTML,
				dest: 'dist/runtime.html',
				replacements: scriptStyleReplacements
			},
			build: {
				requires: ['requirejs', 'cssmin'],
				src: sourceHTML,
				dest: 'dist/index.html',
				replacements: [{
					from: '{{STORY_NAME}}',
					to: testTitle
				}, {
					from: '{{STORY_DATA}}',
					to: grunt.file.read(testFile)
				}].concat(scriptStyleReplacements)
			}
		},

		watch: {
			templates: {
				files: ['template.html', 'js/**', 'css/**'],
				tasks: ['default']
			}
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
		}
	});

	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-yuidoc');
	grunt.loadNpmTasks('grunt-contrib-requirejs');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-text-replace');

	grunt.registerTask('default', [ 'jshint', 'replace:test']);
	grunt.registerTask('build', [ 'jshint', 'yuidoc', 'requirejs', 'cssmin', 'replace:build']);
	grunt.registerTask('runtime', [ 'requirejs', 'yuidoc', 'cssmin', 'replace:runtime']);
	grunt.registerTask('release', [
		'clean', 'yuidoc'
	]);
};
