module.exports = function(grunt) {
	/*
		This generates end-user Harlowe macro documentation by reading
		/*d: delimited comments from the source file.
	*/
	var
		macroEmpty = /\(([\w\-\d]+):\)(?!`)/g,
		macroWithTypeSignature = /\(([\w\-\d]+):[\s\w]+\)/;
	
	grunt.registerTask('harlowedocs', "Make Harlowe documentation", function() {
		var
			// Macro definitions
			macroDefs = {},
			// Error definitions
			errorDefs = {};
		/*
			Read definitions from every JS file.
		*/
		grunt.file.recurse('js/', function(path) {
			var defs = grunt.file.read(path).match(/\/\*d:[^]*?\*\//g);
			if (!defs) {
				return;
			}
			defs.map(function(e) {
				
				// Remove the /*d: and */ markers, whitespace, and tabs.
				return e.replace(/\t/g,'').slice(4,-2).trim();
				
			}).forEach(function(defText) {
				var match, title, text;
				
				/*
					Is it a macro definition?
				*/
				if ((match = defText.match(macroWithTypeSignature))) {
					title = match[0];
					text = defText.trim()
						/*
							Convert the title into an anchor.
						*/
						.replace(title, "<h2 id=macro_" + match[1] + ">" + title + "</h2>")
						/*
							Convert other macro definitions into hyperlinks.
						*/
						.replace(macroEmpty, "[($1:)](#macro_$1)")
						/*
							Convert "Example usage" and "See also" into headings
						*/
						.replace(/\n(Example usage:|See also:)\n/gi,"\n####$1\n");
					/*
						Now, do it! Output the text!
					*/
					macroDefs[title] = text;
				}
			});
		});
		/*
			Now, output the file.
		*/
		var outputFile = "";
		Object.keys(macroDefs).sort().forEach(function(e) {
			outputFile += macroDefs[e];
		});
		grunt.file.write("dist/harloweDocs.md", outputFile);
	});
}
