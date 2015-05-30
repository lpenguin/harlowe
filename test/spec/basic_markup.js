describe("basic twinemarkup syntax", function() {
	'use strict';

	describe("line breaks", function() {
		it("turn into <br> elements", function() {
			expectMarkupToBecome(
				"Hey\nhi\nhello",
				"Hey<br>hi<br>hello"
			);
		});
		it("become <br> elements even in the absence of other text", function() {
			expectMarkupToBecome(
				"\n".repeat(4),
				"<br>".repeat(4)
			);
		});
	});

	[
		{
			name:   "bold markup",
			markup: ["''","''"],
			html:   ["<b>","</b>"],
		},
		{
			name:   "italic markup",
			markup: ["//","//"],
			html:   ["<i>","</i>"],
		},
		{
			name:   "superscript markup",
			markup: ["^^","^^"],
			html:   ["<sup>","</sup>"],
		},
		{
			name:   "deletion markup",
			markup: ["~~","~~"],
			html:   ["<del>","</del>"],
		},
	]
	.forEach(function(e) {
		describe(e.name, function() {
			it("wraps text enclosed in " + e.markup.join(" and ") +
				" with " + e.html.join(" and ") + " tags.", function() {
				expectMarkupToBecome(
					"A " + e.markup.join(" B ") + " C",
					"A " + e.html  .join(" B ") + " C"
				);
			});
			it("spans multiple lines", function() {
				expectMarkupToBecome(
					"A " + e.markup.join(" B\n ")   + " C",
					"A " + e.html  .join(" B<br> ") + " C"
				);
			});
			it("can't be nested", function() {
				expectMarkupToBecome(
					"A " + e.markup.join(e.markup.join(" B "))   + " C",
					"A  B  C"
				);
			});
			it("is ignored if there's no closing pair", function() {
				expectMarkupToBecome(
					"A " + e.markup[0] + " B",
					"A " + e.markup[0] + " B"
				);
			});
			it("works even when empty", function() {
				expectMarkupToBecome(
					"A" + e.markup.join("") + "B",
					"AB"
				);
			});
		});
	});
	
	describe("emphasis markup", function() {
		it("wraps text enclosed in single * " +
			" with <em> and </em> tags.", function() {
			expectMarkupToBecome(
				"A * B * C",
				"A <em> B </em> C"
			);
		});
		it("spans multiple lines (in a way that doesn't conflict with bulleted lists)", function() {
			expectMarkupToBecome(
				"A * B\n C * D",
				"A <em> B<br> C </em> D"
			);
		});
		it("is ignored if there's no closing pair", function() {
			expectMarkupToBecome(
				"A * B",
				"A * B"
			);
		});
	});
	
	describe("strong emphasis markup", function() {
		it("wraps text enclosed in double ** " +
			" with <strong> and </strong> tags.", function() {
			expectMarkupToBecome(
				"A ** B ** C",
				"A <strong> B </strong> C"
			);
		});
		it("spans multiple lines (in a way that doesn't conflict with bulleted lists)", function() {
			expectMarkupToBecome(
				"A ** B\n C ** D",
				"A <strong> B<br> C </strong> D"
			);
		});
		it("is ignored if there's no closing pair", function() {
			expectMarkupToBecome(
				"A ** B",
				"A ** B"
			);
		});
		it("works even when empty", function() {
			expectMarkupToBecome(
				"A****B",
				"AB"
			);
		});
		it("can combine with emphasis markup", function() {
			expectMarkupToBecome(
				"A *** B *** C",
				"A <strong><em> B </em></strong> C"
			);
		});
	});

	describe("nested markup", function() {
		it("exists", function() {
			expectMarkupToBecome(
				"''//bold italic//''.",
				"<b><i>bold italic</i></b>."
			);
		});
		it("won't work unless it's correctly nested", function() {
			expectMarkupToBecome(
				"//''error//''",
				"<i>''error</i>''"
			);
		});
	});

	describe("header markup", function() {
		[1,2,3,4,5,6].forEach(function(i) {
			it("wraps a line starting with " + "#".repeat(i) + " with a <h" + i + "> element", function() {
				expectMarkupToBecome(
					"#".repeat(i) + "A",
					"<h" + i + ">A</h" + i + ">"
				);
				expectMarkupToBecome(
					"#".repeat(i) + "A\n",
					"<h" + i + ">A</h" + i + ">"
				);
			});
		});
		it("won't work if it's preceded by text", function() {
			expectMarkupToBecome(
				"A B #C",
				"A B #C"
			);
			expectMarkupToBecome(
				"\nA B #C",
				"<br>A B #C"
			);
		});
		it("does not consume preceding line breaks", function() {
			[1,2,3,4].forEach(function(i) {
				expectMarkupToBecome(
					"A" + "\n".repeat(i) + "#A",
					"A" + "<br>".repeat(i) + "<h1>A</h1>"
				);
			});
		});
		it("does not create a <br> afterward", function() {
			expectMarkupToBecome(
				"#A\nB",
				"<h1>A</h1>B"
			);
		});
		it("(unlike Markdown) permits whitespace between the start of the line and #", function() {
			expectMarkupToBecome(
				" \f\v\t#A",
				"<h1>A</h1>"
			);
		});
	});

	describe("bulleted lists", function() {
		it("wraps 1 or more adjacent lines starting with, * plus whitespace, in <ul><li>", function() {
			expectMarkupToBecome(
				"* A",
				"<ul><li>A</li></ul>"
			);
			expectMarkupToBecome(
				"* A\n* B",
				"<ul><li>A</li><li>B</li></ul>"
			);
		});
		it("won't work unless it's at the start of a line", function() {
			expectMarkupToBecome(
				"A B * C",
				"A B * C"
			);
			expectMarkupToBecome(
				"\nA B * C",
				"<br>A B * C"
			);
		});
		it("won't work unless whitespace follows the *", function() {
			expectMarkupToBecome(
				"*Red",
				"*Red"
			);
			expectMarkupToBecome(
				" *Red",
				" *Red"
			);
		});
		it("does not consume preceding line breaks", function() {
			[1,2,3,4].forEach(function(i) {
				expectMarkupToBecome(
					"A" + "\n".repeat(i) + "* A",
					"A" + "<br>".repeat(i) + "<ul><li>A</li></ul>"
				);
			});
		});
		it("won't create <br> elements afterward", function() {
			expectMarkupToBecome(
				"* A\nB",
				"<ul><li>A</li></ul>B"
			);
		});
		it("(unlike Markdown) allows nested lists by the addition of more consecutive *'s", function() {
			expectMarkupToBecome(
				"* A\n** B\n** C\n* D",
				"<ul><li>A</li><ul><li>B</li><li>C</li></ul><li>D</li></ul>"
			);
			expectMarkupToBecome(
				"* A\n*** B\n*** C\n* D",
				"<ul><li>A</li><ul><ul><li>B</li><li>C</li></ul></ul><li>D</li></ul>"
			);
			expectMarkupToBecome(
				"*** A\n*** B",
				"<ul><ul><ul><li>A</li><li>B</li></ul></ul></ul>"
			);
			expectMarkupToBecome(
				"*** A\n* B\n*** C",
				"<ul><ul><ul><li>A</li></ul></ul><li>B</li><ul><ul><li>C</li></ul></ul></ul>"
			);
		});
		it("(unlike Markdown) permits whitespace between the start of the line and *", function() {
			expectMarkupToBecome(
				" \t* A",
				"<ul><li>A</li></ul>"
			);
			expectMarkupToBecome(
				"   * A   \n   * B   ",
				"<ul><li>A   </li><li>B   </li></ul>"
			);
		});
	});

	describe("numbered lists", function() {
		it("wraps 1 or more adjacent lines starting with 0., plus whitespace, in <ul><li>", function() {
			expectMarkupToBecome(
				"0. A",
				"<ol><li>A</li></ol>"
			);
			expectMarkupToBecome(
				"0. A\n0. B",
				"<ol><li>A</li><li>B</li></ol>"
			);
			expectMarkupToBecome(
				"0.A",
				"0.A"
			);
		});
		it("won't work unless it's at the start of a line", function() {
			expectMarkupToBecome(
				"A B 0.C",
				"A B 0.C"
			);
			expectMarkupToBecome(
				"00. \n",
				"00. <br>"
			);
			expectMarkupToBecome(
				"\nA B 0.C",
				"<br>A B 0.C"
			);
		});
		it("does not consume preceding line breaks", function() {
			[1,2,3,4].forEach(function(i) {
				expectMarkupToBecome(
					"A" + "\n".repeat(i) + "0. A",
					"A" + "<br>".repeat(i) + "<ol><li>A</li></ol>"
				);
			});
		});
		it("won't create <br> elements afterward", function() {
			expectMarkupToBecome(
				"0. A\nB",
				"<ol><li>A</li></ol>B"
			);
		});
		it("(unlike Markdown) allows nested lists by the addition of more consecutive *'s", function() {
			expectMarkupToBecome(
				"0. A\n0.0. B\n0.0. C\n0. D",
				"<ol><li>A</li><ol><li>B</li><li>C</li></ol><li>D</li></ol>"
			);
			expectMarkupToBecome(
				"0. A\n0.0.0. B\n0.0.0. C\n0. D",
				"<ol><li>A</li><ol><ol><li>B</li><li>C</li></ol></ol><li>D</li></ol>"
			);
			expectMarkupToBecome(
				"0.0.0. A\n0.0.0. B",
				"<ol><ol><ol><li>A</li><li>B</li></ol></ol></ol>"
			);
			expectMarkupToBecome(
				"0.0.0. A\n0. B\n0.0.0. C",
				"<ol><ol><ol><li>A</li></ol></ol><li>B</li><ol><ol><li>C</li></ol></ol></ol>"
			);
		});
		it("(unlike Markdown) permits whitespace between the start of the line and 0.", function() {
			expectMarkupToBecome(
				" \t0. A",
				"<ol><li>A</li></ol>"
			);
			expectMarkupToBecome(
				"   0. A   \n   0. B   ",
				"<ol><li>A   </li><li>B   </li></ol>"
			);
		});
	});

	describe("horizontal rules", function() {
		it("turns 3 or more hyphens solely occupying a single line into a <hr>", function() {
			[3,4,5,8,16].forEach(function(i) {
				expectMarkupToBecome(
					"-".repeat(i),
					"<hr>"
				);
			});
		});
		it("works consecutively", function() {
			expectMarkupToBecome(
				"---\n".repeat(3),
				"<hr><hr><hr>"
			);
		});
		it("won't work if it's preceded by text", function() {
			expectMarkupToBecome(
				"A ---",
				"A ---"
			);
			expectMarkupToBecome(
				"\nA B ---",
				"<br>A B ---"
			);
		});
		it("ignores preceding and trailing whitespace", function() {
			expectMarkupToBecome(
				"   ---   \ngarply",
				"<hr>garply"
			);
		});
		it("does not consume preceding line breaks", function() {
			[1,2,3,4].forEach(function(i) {
				expectMarkupToBecome(
					"A" + "\n".repeat(i) + "---",
					"A" + "<br>".repeat(i) + "<hr>"
				);
			});
		});
		it("won't create <br> elements afterward", function() {
			expectMarkupToBecome(
				"---\ngarply",
				"<hr>garply"
			);
		});
		it("(unlike Markdown) permits whitespace between the start of the line and ---", function() {
			expectMarkupToBecome(
				" \t---",
				"<hr>"
			);
		});
	});

	describe("HTML comments", function() {
		it("are removed from the rendered HTML", function() {
			[0,1,2].forEach(function(i) {
				expectMarkupToBecome(
					"A<!--" + "\n".repeat(i) + "-->B",
					"AB"
				);
			});
		});
		it("can handle partial syntax inside", function() {
			expectMarkupToBecome(
				"A<!--''-->B",
				"AB"
			);
		});
		it("can be nested", function() {
			expectMarkupToBecome(
				"A<!--Cool<!-- -->Cool-->B",
				"AB"
			);
		});
	});
	
	describe("verbatim syntax", function() {
		it("suppresses all other syntax between ` and `", function() {
			expectMarkupToBecome(
				"`A''B''   //C//`",
				"<tw-verbatim>A''B''   //C//</tw-verbatim>"
			);
		});
		it("preserves whitespace", function() {
			expectMarkupToBecome(
				"`        `",
				"<tw-verbatim>        </tw-verbatim>"
			);
		});
		it("spans multiple lines", function() {
			expectMarkupToBecome(
				"`A\n\n''B''`",
				"<tw-verbatim>A<br><br>''B''</tw-verbatim>"
			);
		});
		it("cannot be nested with just single `s", function() {
			expectMarkupToBecome(
				"`''A''`''B''`C",
				"<tw-verbatim>''A''</tw-verbatim><b>B</b>`C"
			);
		});
		it("can enclose a single ` with additional ``s", function() {
			expectMarkupToBecome(
				"``''A''`''B''``C",
				"<tw-verbatim>''A''`''B''</tw-verbatim>C"
			);
		});
	});
	
	describe("escaped line syntax", function() {
		it("eliminates the following line break when a \\ ends a line", function() {
			expectMarkupToPrint(
				"A\\\nB",
				"AB"
			);
		});
		it("eliminates the preceding line break when a \\ starts a line", function() {
			expectMarkupToPrint(
				"A\n\\B",
				"AB"
			);
		});
		it("still works if both backslashes are used", function() {
			expectMarkupToPrint(
				"A\\\n\\B",
				"AB"
			);
		});
		it("works to extend the heading syntax", function() {
			expectMarkupToBecome(
				"#A\n\\B",
				"<h1>AB</h1>"
			);
			expectMarkupToBecome(
				"#A\\\nB",
				"<h1>AB</h1>"
			);
		});
		it("works to extend the bulleted list syntax", function() {
			expectMarkupToBecome(
				"* A\n\\B",
				"<ul><li>AB</li></ul>"
			);
			expectMarkupToBecome(
				"* A\\\nB",
				"<ul><li>AB</li></ul>"
			);
		});
		it("works to extend the numbered list syntax", function() {
			expectMarkupToBecome(
				"0. A\n\\B",
				"<ol><li>AB</li></ol>"
			);
			expectMarkupToBecome(
				"0. A\\\nB",
				"<ol><li>AB</li></ol>"
			);
		});
	});
	describe("collapsing whitespace syntax", function() {
		it("eliminates runs of whitespace between { and }", function() {
			expectMarkupToPrint(
				"A{   \n   }B",
				"AB"
			);
		});
		it("reduces whitespace between non-whitespace to single spaces", function() {
			expectMarkupToPrint(
				"A { A  \n  B } B",
				"A A B B"
			);
		});
		it("leaves other syntax as is", function() {
			var p = runPassage("{   ''A ''   } B");
			expect(p.text()).toBe("A B");
			expect(p.find('b').length).toBe(1);
			
			expectMarkupToPrint(
				"{A '' B''}",
				"A B"
			);
			expectMarkupToPrint(
				"{''B '' C}",
				"B C"
			);
		});
		it("leaves raw HTML <br> tags as is", function() {
			var p = runPassage("{\nA<br>\n<br>B\n}");
			expect(p.find('br').length).toBe(2);
		});
		it("collapses runs of whitespace between non-whitespace down to a single space", function() {
			expectMarkupToPrint(
				"{   A   B   }",
				"A B"
			);
			expectMarkupToPrint(
				"{   A B   }",
				"A B"
			);
			expectMarkupToPrint(
				"X{   A   B   }Y",
				"XA BY"
			);
		});
		it("can be nested", function() {
			expectMarkupToPrint(
				"{{   ''A''   }}  B  C",
				"A  B  C"
			);
			expectMarkupToPrint(
				"{  A {   ''B''   }} C",
				"A B C"
			);
		});
		it("can collapse spaces in empty elements", function() {
			expectMarkupToPrint(
				"{A '' '' B}",
				"A B"
			);
		});
		it("collapses through invisible expressions", function() {
			expectMarkupToPrint(
				"{ (set: $r to 1)\n(set: $r to 2) }",
				""
			);
			expectMarkupToPrint(
				"{A(set: $r to 1)B}",
				"AB"
			);
		});
		it("works inside (display:)", function() {
			createPassage("{B\nC}", "grault");
			expect(runPassage("A\n(display:'grault')").find('tw-expression br').length).toBe(0);
		});
		it("won't affect text inside HTML tags", function() {
			var p = runPassage("{<span title='   '> </span>}");
			expect(p.find('span').attr('title')).toBe("   ");
			expect(p.text()).toBe("");
		});
		it("won't affect text inside macros", function() {
			expectMarkupToPrint("{(print:'Red   Blue''s length)}", "10");
		});
		it("won't affect text outputted by expressions", function() {
			expectMarkupToPrint("{(set: $a to 'Red   Blue')(print:$a)}", "Red   Blue");
		});
		it("won't affect text outputted by (display:)", function() {
			createPassage("B\nC", "grault");
			expect(runPassage("A\n{(display:'grault')}").find('tw-expression br').length).toBe(1);
		});
		it("...unless the (display:)ed text itself contains the syntax", function() {
			createPassage("{B\nC}", "grault");
			expect(runPassage("A\n{(display:'grault')}").find('tw-expression br').length).toBe(0);
		});
		it("won't affect text inside verbatim guards", function() {
			var p = runPassage("{   `   `   }");
			expect(p.text()).toBe("   ");
			p = runPassage("{   `  A C  `   }");
			expect(p.text()).toBe("  A C  ");
			p = runPassage("{A`   `B}");
			expect(p.text()).toBe("A   B");
			p = runPassage("{A `   ` B}");
			expect(p.text()).toBe("A     B");
		});
		it("will affect text inside nested hooks (?)", function() {
			var p;
			p = runPassage("{ A(if:true)[      ]B }");
			expect(p.text()).toBe("AB");
			p = runPassage("{ A (if:true)[    ] B }");
			expect(p.text()).toBe("A B");
			p = runPassage("{ A (if:true)[  B  ] C }");
			expect(p.text()).toBe("A B C");
			p = runPassage("{ A (if:true)[  B  C ] D }");
			expect(p.text()).toBe("A B C D");
		});
		it("will not affect text inside verbatim guards inside nested hooks", function() {
			var p = runPassage("{ A (if:true)[`    `] B }");
			expect(p.text()).toBe("A      B");
			p = runPassage("{ A (if:true)[ ` `B` ` ] C }");
			expect(p.text()).toBe("A  B  C");
		});
		it("works even when empty", function() {
			expectMarkupToNotError("{}");
		});
	});
	
	describe("aligner syntax", function() {
		it("right-aligns text with ==> on a single line, and ends right-alignment with <== on a single line", function() {
			var align = runPassage("==>\ngarply\n<==").find('tw-align');
			expect(align.css('text-align')).toBe('right');
			expect(align.text()).toBe('garply');
			expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
		});
		it("ignores preceding and trailing whitespace", function() {
			var align = runPassage("   ==>   \ngarply\n   <==   ").find('tw-align');
			expect(align.length).toBe(1);
		});
		it("must be on a single line", function() {
			var align = runPassage("==>garply\ngrault\n<==corge").find('tw-align');
			expect(align.length).toBe(0);
		});
		it("ignores the number of, and imbalance of, = signs used", function() {
			[2,3,4,5,6,7,8,9,10].forEach(function(number) {
				var align = runPassage("=".repeat(number) + ">\ngarply\n<" + "=".repeat(number+2)).find('tw-align');
				expect(align.css('text-align')).toBe('right');
				expect(align.text()).toBe('garply');
				expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
			});
		});
		it("centres text with a balanced =><=", function() {
			var align = runPassage("=><=\ngarply").find('tw-align');
			expect(align.css('text-align')).toBe('center');
			expect(align.text()).toBe('garply');
			expect(align.attr('style')).toMatch(/max-width:\s*50%/);
			expect(align.attr('style')).toMatch(/margin-left:\sauto/);
			expect(align.attr('style')).toMatch(/margin-right:\sauto/);
		});
		it("justifies text with <==>", function() {
			var align = runPassage("<==>\ngarply\n<==").find('tw-align');
			expect(align.css('text-align')).toBe('justify');
			expect(align.text()).toBe('garply');
			expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
		});
		it("aligns text with unbalanced ==><=", function() {
			var align = runPassage("==><====\ngarply").find('tw-align');
			expect(align.css('text-align')).toBe('center');
			expect(align.attr('style')).toMatch(/margin-left:\s*17%/);
			
			align = runPassage("=====><=\ngarply").find('tw-align');
			expect(align.css('text-align')).toBe('center');
			expect(align.attr('style')).toMatch(/margin-left:\s*42%/);
		});
		it("doesn't nest <tw-align> elements", function() {
			var align = runPassage("<==>\ngarply\n==>\ngrault\n<==").find('tw-align');
			expect(align.first().text()).toBe('garply');
			expect(align.last().text()).toBe('grault');
			expect(align.length).toBe(2);
		});
		it("does not consume preceding line breaks", function() {
			[1,2,3,4].forEach(function(i) {
				expect(runPassage(
					"A" + "\n".repeat(i) + "==>\ngarply\n<==\n"
				).children('br').length).toBe(i);
			});
		});
		it("won't create <br> elements afterward", function() {
			expect(runPassage("<==>\ngarply\n<==\n").find('tw-align + br').length).toBe(0);
		});
	});
	
	describe("Twine 1 macro syntax", function() {
		it("will simply print an error", function() {
			expectMarkupToError("<<set $red to 1>>");
		});
	});
});
