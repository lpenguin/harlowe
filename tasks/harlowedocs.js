module.exports = function(grunt) {
	/*
		This generates end-user Harlowe macro and syntax documentation (in Markup) by reading
		/*d: delimited comments from the source file.
	*/
	var
		macroEmpty = /\(([\w\-\d]+):\)(?!`)/g,
		macroWithTypeSignature = /\(([\w\-\d]+):([\s\w\.\,\[\]]*)\) -> ([\w]+)/,
		/*
			This matches a mixed-case type name, optionally plural, but not whenever
			it seems to be part of a macro name.
		*/
		typeName = /\b(string|number|boolean|array|data(?:map|set))(s?)(?!\:\))\b/ig,
		
		// Type definitions
		typeDefs = {},
		// Macro definitions
		macroDefs = {},
		// Error definitions
		errorDefs = {};
	
	/*
		Write out a parameter signature, highlighting the pertinent parts:
		* Type names
		* "Optional" brackets
		* "Rest" ellipsis
		...with relevant HTML.
	*/
	function parameterSignature(sig) {
		return sig
			// Highlight the optional syntax
			.replace(/([\[\]])/g,  "<span class=parameter_optional>$1</span>")
			// Highlight the rest syntax
			.replace(/\.{3}/g, "<span class=parameter_rest>...</span>");
	}
	
	/*
		Write out the macro's signature as the following structures:
		* A <h2> tag anchored to "macro_" + the macro's name.
		* The macro's tag, containing...
		* Its parameter signature.
		* Then, afterward, a return type signature.
	*/
	function macroSignature(name, sig, returnType) {
		return "<h2 id=macro_" + name + ">" +
		"(" + name + ": <i>" +
		parameterSignature(sig) +
		"</i>) <span class=macro_returntype>&rarr;</span> <i>" +
		returnType +
		"</i></h2>";
	}
	
	function processMacroDefinition(match) {
		/*
			A record of which type names were hyperlinked.
			As a rule, only hyperlink type names once each per macro definition.
		*/
		var typeNamesLinked = [];
		
		title = match[0];
		text = match.input.trim()
			/*
				Convert the title signature into an anchor and an augmented parameter signature.
			*/
			.replace(title,macroSignature(match[1], match[2], match[3]))
			/*
				Convert type names into hyperlinks.
			*/
			.replace(typeName, function(text, $1, $2){
				if (typeNamesLinked.indexOf($1) === -1) {
					typeNamesLinked.push($1);
					return "[" + $1 + $2 + "](#type_" + $1 + ")";
				}
				return text;
			})
			/*
				Convert other macro definitions into hyperlinks.
			*/
			.replace(macroEmpty, function(text, $1) {
				/*
					...but don't hyperlink references to this own macro.
					(e.g. don't hyperlink (goto:) in the (goto:) article.)
				*/
				if ($1 === match[1]) {
					return "<b>" + text + "</b>";
				}
				return "[(" + $1 + ":)](#macro_" + $1 + ")";
			})
			/*
				Convert the minor headings into <h4> elements.
			*/
			.replace(/\n([A-Z][\w\s\d]+:)\n/g,"\n####$1\n");
		/*
			Now, do it! Output the text!
		*/
		macroDefs[title] = text;
	}
	
	grunt.registerTask('harlowedocs', "Make Harlowe documentation", function() {
		/*
			Read the definitions from every JS file.
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
					processMacroDefinition(match);
				}
			});
		});
		/*
			Now, output the file.
		*/
		var outputFile = "";
		/*
			Output macro definitions.
		*/
		outputFile += "<h1 id=section_macros>List of macros</h1>\n";
		Object.keys(macroDefs).sort().forEach(function(e) {
			outputFile += macroDefs[e];
		});
		grunt.file.write("dist/harloweDocs.md", outputFile);
	});
};
