describe("line break syntax", function() {
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
});
