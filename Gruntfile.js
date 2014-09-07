module.exports = function (grunt) {
	"use strict";
	var testTitle = 'Harlowe Test',
		
		// Source files
		sourceHTML = ['template.html'],
		jsFileList = ['js/*.js', 'js/utils/*.js', 'js/hooksets/*.js', 'js/markup/*.js'],
		jsFullFileList = ['js/lib/*.js'].concat(jsFileList),
		
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
					global  : true,
					requestAnimationFrame : true
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
					to: '"source":' + JSON.stringify(grunt.file.read(sourceHTML))
				}].concat(scriptStyleReplacements.map(function(e) {
					return {
						from: e.from,
						to: function() { return JSON.stringify(e.to()).slice(1, -1); }
					};
				}))
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
	/*
		Notice this isn't grunt-contrib-sass, as that requires Ruby,
		whereas grunt-sass uses libsass and is potentially cross-platform,
		at the expense of being a lower Sass version.
	*/
	grunt.loadNpmTasks('grunt-sass');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-text-replace');

	grunt.registerTask('default', [ 'jshint', 'requirejs', 'sass', 'cssmin']);
	grunt.registerTask('runtime', [ 'requirejs', 'yuidoc', 'sass', 'cssmin', 'replace:runtime']);
	grunt.registerTask('release', [
		'clean', 'yuidoc'
	]);
};
