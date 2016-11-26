describe("basic text style markup", function() {
	'use strict';
	
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
});
