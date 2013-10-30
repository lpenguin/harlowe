module.exports = function (grunt) {
	"use strict";
	var jsFileList = ['js/*.js', 'js/wordarray/*.js', 'js/macroinstance/*.js'],
		jsFullFileList = ['js/lib/*.js'].concat(jsFileList),
		cssFileList = ['./css/*.css'],
		testFile = 'tests/hooktest.html',
		testTitle = 'My Unreasonably Long Story Title That Is Used For Testing',
		sourceHTML = ['template.html'];
	
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		clean: {
			dist: ['dist/'],
			build: ['build/']
		},

		jshint: {
			all: jsFileList,
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
					out: "build/harlowe-min.js"
				}
			}
		},

		cssmin: {
			minify: {
				src: cssFileList,
				dest: "/build/harlowe-min.css"
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
				}, {
					from: '{{CSS}}',
					to: function () {
						return '<style title="Twine CSS">' + grunt.file.read("./build/harlowe-min.css") + '</style>'
					}
				}, {
					from: '{{HARLOWE}}',
					to: function () {
						return '<script title="Twine engine code" data-main="harlowe">' + grunt.file.read("./build/harlowe-min.js") + '</script>'
					}
				}]
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

	grunt.registerTask('default', [ 'replace:test']);
	grunt.registerTask('build', [ /*'jshint',*/ /*'yuidoc',*/ 'requirejs', 'cssmin', 'replace:build']);
	grunt.registerTask('release', [
		'clean', 'yuidoc'
	]);
};
