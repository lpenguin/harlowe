describe("list markup", function() {
	'use strict';
	
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
});
