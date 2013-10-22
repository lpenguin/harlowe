module.exports = function (grunt)
{
	grunt.initConfig(
	{
		pkg: grunt.file.readJSON('package.json'),

		clean:
		{
			dist: ['dist/']
		},

		jshint:
		{
			all: ['js/*.js', 'js/wordarray/*.js', 'js/macroinstance/*.js']
		},

		replace:
		{
			title:
			{
				src: ['template.html'],
				dest: 'index.html',
				replacements:
				[
					{
						from: '{{STORY_NAME}}',
						to: 'My Unreasonably Long Story Title That Is Used For Testing'
					},
					{
						from: '{{STORY_DATA}}',
						to: grunt.file.read('tests/samplestory.html')
					}
				]
			}
		},

		watch:
		{
			templates:
			{
				files: ['template.html', 'js/**', 'css/**'],
				tasks: ['default']
			}
		},

		yuidoc:
		{
			compile:
			{
				name: '<% pkg.name %>',
				description: '<% pkg.description %>',
				version: '<% pkg.version %>',
				options:
				{
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
	grunt.loadNpmTasks('grunt-text-replace');

	grunt.registerTask('default', [/*'jshint',*/ 'yuidoc', 'replace']);
	grunt.registerTask('release',
	[
		'clean', 'yuidoc'
	]);
};
