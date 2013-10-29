module.exports = function (grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		clean: {
			dist: ['dist/'],
			build: ['build/']
		},

		jshint: {
			all: ['js/*.js', 'js/wordarray/*.js', 'js/macroinstance/*.js']
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
				src: ['./css/*.css'],
				dest: "./build/harlowe-min.css"
			}
		},

		replace: {
			all: {
				requires: ['requirejs', 'cssmin'],
				src: ['template.html'],
				dest: 'dist/index.html',
				replacements: [{
					from: '{{STORY_NAME}}',
					to: 'My Unreasonably Long Story Title That Is Used For Testing'
				}, {
					from: '{{STORY_DATA}}',
					to: grunt.file.read('tests/hooktest.html')
				}, {
					from: '{{CSS}}',
					to: function () {
						return grunt.file.read("./build/harlowe-min.css")
					}
				}, {
					from: '{{HARLOWE}}',
					to: function () {
						return grunt.file.read("./build/harlowe-min.js")
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

	grunt.registerTask('default', [ /*'jshint',*/ /*'yuidoc',*/ 'requirejs', 'cssmin', 'replace']);
	grunt.registerTask('release', [
		'clean', 'yuidoc'
	]);
};
