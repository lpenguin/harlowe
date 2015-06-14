describe("control flow macros", function() {
	'use strict';
	describe("the (if:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expectMarkupToError("(if:)");
			expectMarkupToNotError("(if:true)");
			expectMarkupToError("(if:'1')");
		});
		it("returns its passed argument", function() {
			expectMarkupToPrint("(print:(if:false))", 'false');
			expectMarkupToPrint("(print:(if:true))", 'true');
		});
	});
	describe("the (unless:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expectMarkupToError("(unless:)");
			expectMarkupToNotError("(unless:true)");
			expectMarkupToError("(unless:'1')");
		});
		it("inverts its passed argument", function() {
			expectMarkupToPrint("(print:(unless:false))", 'true');
			expectMarkupToPrint("(print:(unless:true))", 'false');
		});
	});
	describe("the (else-if:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expectMarkupToError("(else-if:)");
			expectMarkupToError("(else-if:'1')");
		});
		it("must occur after a conditionally displayed hook", function() {
			expectMarkupToError("(else-if:false)");
			expectMarkupToNotError("(either:true)[](print:(else-if:true))");
			expectMarkupToNotError("(either:false)[](print:(else-if:true))");
		});
		it("is false if the preceding hook was displayed, else returns it argument", function() {
			expectMarkupToPrint("(either:false)[](print:(else-if:true))", 'true');
			expectMarkupToPrint("(either:false)[](print:(else-if:false))", 'false');
			expectMarkupToPrint("(either:true)[](print:(else-if:true))", 'false');
		});
		it("works even when nested", function() {
			expectMarkupToPrint("(either:true)[(either:false)[](print:(else-if:true))](print:(else-if:true))", 'truefalse');
			expectMarkupToPrint("(either:true)[(either:true)[](print:(else-if:true))](print:(else-if:true))", 'falsefalse');
		});
	});
	describe("the (else:) macro", function() {
		it("accepts exactly 0 arguments", function() {
			expectMarkupToError("(else:true)");
			expectMarkupToError("(else:'1')");
		});
		it("must occur after a conditionally displayed hook", function() {
			expectMarkupToError("(else:)");
			expectMarkupToNotError("(either:true)[](print:(else:))");
			expectMarkupToNotError("(either:false)[](print:(else:))");
		});
		it("is false if the preceding hook was displayed, else returns true", function() {
			expectMarkupToPrint("(either:false)[](print:(else-if:true))", 'true');
			expectMarkupToPrint("(either:false)[](print:(else-if:false))", 'false');
			expectMarkupToPrint("(either:true)[](print:(else-if:true))", 'false');
		});
		it("works even when nested", function() {
			expectMarkupToPrint("(either:true)[(either:false)[](print:(else:))](print:(else:))", 'truefalse');
			expectMarkupToPrint("(either:true)[(either:true)[](print:(else:))](print:(else:))", 'falsefalse');
		});
	});
});
