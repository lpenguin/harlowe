describe("verbatim syntax", function() {
	'use strict';
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
