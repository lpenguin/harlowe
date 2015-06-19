describe("headers and rules", function() {
	'use strict';
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
});
