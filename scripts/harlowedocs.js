'use strict';

const fs = require('fs');
/*
	This generates end-user Harlowe macro and syntax documentation (in Markup) by reading
	/*d: delimited comments from the source file.
*/
const
	macroEmpty = /\(([\w\-\d]+):\)(?!`)/g,
	macroAliases = /Also known as: [^\n]+/,
	categoryTag = /\n\s+#([a-z][a-z ]*[a-z])(?: (\d+))?/g,
	/*
		This matches a mixed-case type name, optionally plural, but not whenever
		it seems to be part of a macro name.
	*/
	typeName = /([^\-])\b(hookname|colour|variabletovalue|any|changer|command|string|number|boolean|array|data(?:map|set))(s?)(?!\:\))\b/ig,
	
	Defs = function(props) {
		return Object.assign({
			defs: {},

			navLink(def) {
				return `<li><a href="#${def.anchor}">${def.name}</a></li>`;
			},
			output() {
				let outputElement = '', navElement = '';
				let currentCategory;

				Object.keys(this.defs).sort((left, right) => {
					const {category:leftCategory, categoryOrder:leftCategoryOrder} = this.defs[left];
					const {category:rightCategory, categoryOrder:rightCategoryOrder} = this.defs[right];

					if (leftCategory !== rightCategory) {
						return (leftCategory || "").localeCompare(rightCategory || "")
					}
					if (leftCategoryOrder !== rightCategoryOrder) {
						if (isNaN(+leftCategoryOrder)) {
							return 1;
						}
						if (isNaN(+rightCategoryOrder)) {
							return -1;
						}
						return Math.sign(leftCategoryOrder - rightCategoryOrder);
					}
					return left.localeCompare(right);
				}).forEach((e) => {
					const def = this.defs[e];
					/*
						Add the category heading to the <nav> if we're in a new category.
					*/
					if (def.category !== currentCategory) {
						/*
							Add the terminating </ul> if a category has just ended.
						*/
						if (currentCategory) {
							navElement += "</ul>";
						}
						currentCategory = def.category;
						navElement += `<h6>${def.category}</h6><ul>`;
					}
					/*
						Output the definition to both the file and the <nav>
					*/
					outputElement += def.text;
					navElement += this.navLink(def);
				});

				return [outputElement, navElement];
			}
		}, props);
	},

	Markup = new Defs({
		defName: "Passage markup",
		defCode: "markup",
		regExp: /([\w ]+) markup\n/,

		definition({input, 0:title, 1:name}) {
			const slugName =  name.replace(/\s/g,'-').toLowerCase();
			let text = input.trim().replace(title, "\n<h2 class='def_title markup_title' id=markup_" + slugName + ">"
				+ "<a class='heading_link' href=#markup_" + slugName + "></a>" + title + "</h2>\n");
			const {1:category, 2:categoryOrder} = (categoryTag.exec(text) || {});

			text = processTextTerms(
				text,
				name,
				{markupNames:true, macroNames:true}
			);

			this.defs[title] = { text, anchor: "markup_" + slugName, name, category, categoryOrder };
		},
	}),

	Type = new Defs({
		defName: "Types of data",
		defCode: "type",
		regExp: /([\w]+) data\n/,

		definition({input, 0:title, 1:name}) {
			const slugName =  name.replace(/\s/g,'-').toLowerCase();
			let text = input.trim().replace(title, "\n<h2 class='def_title type_title' id=type_" + slugName + ">"
				+ "<a class='heading_link' href=#type_" + slugName + "></a>" + title + "</h2>\n");
			const {1:category, 2:categoryOrder} = (categoryTag.exec(text) || {});

			text = processTextTerms(
				text,
				name,
				{typeNames: true, macroNames:true}
			);

			this.defs[title] = { text, anchor: "type_" + slugName, name, category, categoryOrder };
		},
	}),

	Keyword = new Defs({
		defName: "Special keywords",
		defCode: "keyword",
		regExp: /([\w]+) keyword\n/,

		definition({input, 0:title, 1:name}) {
			const slugName =  name.replace(/\s/g,'-').toLowerCase();
			let text = input.trim().replace(title, "\n<h2 class='def_title keyword_title' id=keyword_" + slugName + ">"
				+ "<a class='heading_link' href=#keyword_" + slugName + "></a>" + title + "</h2>\n");

			text = processTextTerms(
				text,
				name,
				{typeNames: true, macroNames:true}
			);

			this.defs[title] = { text, anchor: "keyword_" + slugName, name };
		},
	}),

	PassageTag = new Defs({
		defName: "Special passage tags",
		defCode: "passagetag",
		regExp: /([\w\-]+) tag\n/,

		definition({input, 0:title, 1:name}) {
			const slugName =  name.replace(/\s/g,'-').toLowerCase();
			let text = input.trim().replace(title, "\n<h2 class='def_title passagetag_title' id=passagetag_" + slugName + ">"
				+ "<a class='heading_link' href=#passagetag_" + slugName + "></a>" + title + "</h2>\n");
			const categoryOrder = (categoryTag.exec(text) || {})[2];

			text = processTextTerms(
				text,
				name,
				{typeNames: true, macroNames:true}
			);

			this.defs[title] = { text, anchor: "passagetag_" + slugName, name, categoryOrder };
		},
	}),

	Macro = new Defs({
		defName: "List of macros",
		defCode: "macro",
		regExp: /\(([\w\-\d]+):([\s\w\.\,\[\]]*)\) -> ([\w]+)/,

		navLink(def) {
			return `<li><a href="#${def.anchor}">(${def.name}:)</a>
				<span class='nav_macro_return_type'>${def.returnType}</span>${
					def.aka.length ? `<div class='nav_macro_aka'>${def.aka.map(e => `(${e}:)`).join(', ')}</div>`
					: ''
				}</li>`;
		},
		/*
			Write out a macro title, which is simply "The (name:) macro",
			but with an id that allows the element to be used as an anchor target.
		*/
		title: (name) =>
			"\n<h2 class='def_title macro_title' id=macro_" + name.toLowerCase() + ">" +
				"<a class='heading_link' href=#macro_" + name.toLowerCase() + "></a>The (" + name + ": ) macro</h2>\n",
		/*
			Write out a parameter signature, highlighting the pertinent parts:
			* Type names
			* "Optional" brackets
			* "Rest" ellipsis
			...with relevant HTML.
		*/
		parameterSignature: (sig) =>
			sig
				// Highlight the optional syntax
				.replace(/([\[\]])/g,  "<span class=parameter_optional>\\$1</span>")
				// Highlight the rest syntax
				.replace(/\.{3}/g, "<span class=parameter_rest>...</span>"),
		/*
			Write out the macro's signature as the following structures:
			* A <h2> tag anchored to "macro_" + the macro's name.
			* The macro's tag, containing...
			* Its parameter signature.
			* Then, afterward, a return type signature.
		*/
		signature: (name, sig, returnType) =>
			"\n<h3 class=macro_signature>" +
				"(" + name + ": <i>" +
				Macro.parameterSignature(sig) +
				"</i>) <span class=macro_returntype>&rarr;</span> <i>" +
				returnType +
				"</i></h3>\n",

		definition({input, 0:title, 1:name, 2:sig, 3:returnType}) {
			let text = input.trim()
				/*
					Convert the title signature into an anchor and an augmented parameter signature.
				*/
				.replace(title, Macro.title(name) + Macro.signature(name, sig, returnType));

			const {1:category, 2:categoryOrder} = (categoryTag.exec(text) || {});

			const [,...aka] = macroEmpty.exec((macroAliases.exec(text) || [''])[0]) || [];

			text = processTextTerms(text, name, {typeNames: true, macroNames:true});
			
			this.defs[title] = { text, anchor: "macro_" + name.toLowerCase(), name, category, categoryOrder, sig, returnType, aka };
		}
	});

/*
	Convert various structures or terms in the passed-in body text
	into hyperlinks to their definitions, etc.
	(But don't link terms more than once, or link the title term.)
*/
function processTextTerms(text, name, allow) {
	allow = allow || {};
	/*
		A record of which names were hyperlinked.
		As a rule, only hyperlink names once each per definition.
	*/
	const
		typeNamesLinked = [],
		markupNamesLinked = [],
		headingMatch = /<h2[^]+?<\/h2>/g.exec(text);

	text =
		/*
			Exclude the heading from the forthcoming replacements by concatenating it
			separately.
		*/
		text.replace(headingMatch[0], '\ufeff')
		/*
			Remove the category tag
		*/
		.replace(categoryTag,'')

		/*
			Convert specific markup names into hyperlinks.
		*/
		.replace(/([^\-\w])(whitespace)\b/ig, function(text, $1, $2){
			if (!allow.markupNames) {
				return text;
			}
			/*
				...but don't hyperlink references to this own markup.
				(This targets mixed-case singular and plural.)
			*/
			if ($2.toLowerCase() === name.toLowerCase()) {
				return text;
			}
			if (markupNamesLinked.indexOf($2) === -1) {
				markupNamesLinked.push($2);
				return $1 + "[" + $2 + "](#markup_" + $2.toLowerCase() + ")";
			}
			return text;
		})
		/*
			Convert type names into hyperlinks.
		*/
		.replace(typeName, function(text, preceding, matchName, plural){
			if (!allow.typeNames) {
				return text;
			}
			/*
				Don't match if the preceding character is '-' or "(" (such as in (text-colour:) or (dataset:))
			*/
			if (["-","("].indexOf(preceding) >-1) {
				return text;
			}
			/*
				Don't hyperlink references to this own type.
				(This targets mixed-case singular and plural.)
			*/
			if (matchName.toLowerCase() === name.toLowerCase()) {
				return text;
			}
			if (typeNamesLinked.indexOf(matchName) === -1) {
				typeNamesLinked.push(matchName);
				return preceding + "[" + matchName + plural + "](#type_" + matchName.toLowerCase() + ")";
			}
			return text;
		})
		/*
			Convert other macro definitions into hyperlinks.
		*/
		.replace(macroEmpty, (text, $1) => {
			if (!allow.macroNames) {
				return text;
			}
			/*
				...but don't hyperlink references to this own macro.
				(e.g. don't hyperlink (goto:) in the (goto:) article.)
			*/
			if ($1.toLowerCase() === name.toLowerCase()) {
				return text;
			}
			return "[(" + $1 + ":)](#macro_" + $1.toLowerCase() + ")";
		})
		/*
			Convert the minor headings into <h4> elements.
		*/
		.replace(/\n([A-Z][\w\s\d]+:)\n/g,"\n####$1\n")
		/*
			Reinsert the heading
		*/
		.replace('\ufeff', headingMatch[0])

	return text;
}

/*
	Read the definitions from every JS file.
*/
require('fs-readdir-recursive')('js/').forEach(function(path) {
	let defs = fs.readFileSync('js/' + path, {encoding:'utf8'}).match(/\/\*d:[^]*?\*\//g);
	if (!defs) {
		return;
	}
	defs.map((e) =>
		// Remove the /*d: and */ markers, whitespace, and tabs.
		e.replace(/\t/g,'').slice(4,-2).trim()
	).forEach((defText) => {
		let match;
		[Markup,Macro,Type,Keyword,PassageTag].forEach(e=> {
			if ((match = defText.match(e.regExp))) {
				e.definition(match);
			}
		})
	});
});
/*
	Now, output the file.
*/
let outputFile = "";
let navElement = "<nav><img src='http://twinery.org/2/storyformats/Harlowe/icon.svg' width=96 height=96></img>";
/*
	Obtain the version
*/
navElement += `<div class=nav_version>Harlowe version ${JSON.parse(fs.readFileSync('package.json')).version}</div>`
let currentCategory;

[Markup,Macro,Type,Keyword,PassageTag].forEach(e=>{
	outputFile += `\n<h1 id=section_${e.defCode}>${e.defName}</h1>\n`;
	navElement += `<h5>${e.defName}</h5><ul class=list_${e.defCode}>`;

	const [out, nav] = e.output();
	outputFile += out;
	navElement += nav + "</ul>"
});

/*
	Convert to HTML with Marked
*/
outputFile = require('marked')(outputFile);
/*
	Append CSS and HTML header tags
*/
outputFile = `<!doctype html><title>Harlowe manual</title><meta charset=utf8><style>
/* Normalisation CSS */
html { font-size:110%; font-weight:lighter; }
body { font-family:Georgia, "Times New Roman", Times, serif; line-height:1.5; margin:0 25vw;}
p { margin-top:1em; }
strong,b { font-weight: bold; }
a { color:#3B8BBA; }
a:hover, a:focus, a:active { color:#22516d; }
table { background:#fafafa; border-bottom:1px solid #ccc; border-collapse:collapse; border-right:1px solid #ccc; border-spacing:0; font-size:1em; width:100%; }
table tr { border-top:1px solid #ccc; }
table tr:nth-child(2n),thead { background:#eee; }
table th,table td { border-left:1px solid #ccc; padding:4px; text-align:left; }
tfoot { background:#e3e3e3; }
h1,h2,h3,h4,h5,h6 { border-bottom:solid 1px #ddd; color:#000; font-weight:400; line-height:1em; margin:0; padding-top:1rem; }
h4,h5,h6 { font-weight:700; }
h1 { font-size:2.5em; }
h2 { font-size:2em; }
h3 { font-size:1.5em; }
h4 { font-size:1.2em; }
h5 { font-size:1em; }
h6 { font-size:.9em; }
h1,h2 { padding-top:2rem; padding-bottom:5px; }
/* Nav bar */
nav { position:fixed; width:15vw; max-width: 20vw; top:5vh;left:5vh; bottom:5vh; overflow-y:scroll; border:1px solid #888; padding:1rem; margin-bottom:2em; font-size:90% }
nav ul { list-style-type: none; margin: 0em; padding: 0em; }
nav img { display:block; margin: 0 auto;}
.nav_version { text-align:center }
@media screen and (max-width: 800px) { nav { position:relative; } }
/* Main styles */
.def_title { background:linear-gradient(180deg,white,white 70%,silver); border-bottom:1px solid silver; padding-bottom:5px; }
.macro_signature { opacity:0.75 }
.nav_macro_return_type { opacity:0.33; float:right; }
@media screen and (max-width: 1400px) { .nav_macro_return_type { display:none; } }
@media screen and (max-width: 1600px) { .nav_macro_return_type { font-size:80% } }
.nav_macro_aka { opacity: 0.75; font-size:90%; color:#3B8BBA; margin-left: 0.5em; font-style: italic; }
.nav_macro_aka::before { content: "also known as "; opacity: 0.75; }
/* Code blocks */
code { background:#FFF; border:1px solid #888; color:#000; display:block; padding:12px; }
/* Inline code */
pre { display:inline; }
:not(pre) > code { background:hsla(0,0%,100%,0.75); border:1px dotted #888; display:inline; padding:1px; white-space:nowrap; }
/* Heading links */
.heading_link::before { content: "§"; display:inline-block; margin-left:-25px; padding-right:10px; color:black; font-weight:100; visibility:hidden; text-decoration:none; }
:hover > .heading_link::before { visibility:visible; }
</style>` + navElement + "</ul></nav>" + outputFile;
/*
	Done
*/
fs.writeFileSync("dist/harloweDocs.html", outputFile);

