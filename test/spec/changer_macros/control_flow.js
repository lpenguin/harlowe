describe("control flow macros", function() {
	'use strict';
	describe("the (if:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expectMarkupToError("(if:)[]");
			expectMarkupToNotError("(if:true)[]");
			expectMarkupToError("(if:'1')[]");
		});
		it("returns its passed argument", function() {
			expectMarkupToPrint("(if:false)[Gosh]", '');
			expectMarkupToPrint("(if:true)[Gosh]", 'Gosh');
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(if:true)");
		});
	});
	describe("the (unless:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expectMarkupToError("(unless:)[]");
			expectMarkupToNotError("(unless:true)[]");
			expectMarkupToError("(unless:'1')[]");
		});
		it("inverts its passed argument", function() {
			expectMarkupToPrint("(unless:false)[Gosh]", 'Gosh');
			expectMarkupToPrint("(unless:true)[Gosh]", '');
		});
	});
	describe("the (else-if:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expectMarkupToError("(else-if:)[]");
			expectMarkupToError("(else-if:'1')[]");
		});
		it("must occur after a conditionally displayed hook", function() {
			expectMarkupToError("(else-if:false)[]");
			expectMarkupToNotError("(either:true)[](else-if:true)[]");
			expectMarkupToNotError("(either:false)[](else-if:true)[]");
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(if:true)[](else-if:true)");
		});
		it("is false if the preceding hook was displayed, else returns its argument", function() {
			expectMarkupToPrint("(either:false)[Wow](else-if:true)[Gee]", 'Gee');
			expectMarkupToPrint("(either:false)[Wow](else-if:false)[Gee]", '');
			expectMarkupToPrint("(either:true)[Wow](else-if:true)[Gee]", 'Wow');
		});
		it("works even when nested", function() {
			expectMarkupToPrint("(either:true)[(either:false)[Wow](else-if:true)[Gee]](else-if:true)[Gosh]", 'Gee');
			expectMarkupToPrint("(either:true)[(either:true)[Wow](else-if:true)[Gee]](else-if:true)[Gosh]", 'Wow');
		});
	});
	describe("the (else:) macro", function() {
		it("accepts exactly 0 arguments", function() {
			expectMarkupToError("(else:true)[]");
			expectMarkupToError("(else:'1')[]");
		});
		it("must occur after a conditionally displayed hook", function() {
			expectMarkupToError("(else:)[]");
			expectMarkupToNotError("(either:true)[](else:)[]");
			expectMarkupToNotError("(either:false)[](else:)[]");
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(if:true)[](else:)");
		});
		it("is false if the preceding hook was displayed, else returns true", function() {
			expectMarkupToPrint("(either:false)[Wow](else:)[Gee]", 'Gee');
			expectMarkupToPrint("(either:true)[Wow](else:)[Gee]", 'Wow');
		});
		it("works even when nested", function() {
			expectMarkupToPrint("(either:true)[(either:false)[Wow](else:)[Gee]](else:)[Gosh]", 'Gee');
			expectMarkupToPrint("(either:true)[(either:true)[Wow](else:)[Gee]](else:)[Gosh]", 'Wow');
		});
	});
});
