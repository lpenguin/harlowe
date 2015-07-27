describe("control flow macros", function() {
	'use strict';
	describe("the (if:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expectMarkupToError("(if:)[]");
			expectMarkupToNotError("(if:true)[]");
			expectMarkupToError("(if:'1')[]");
		});
		it("returns a command that shows/hides the attached hook based on the provided boolean", function() {
			expectMarkupToPrint("(if:false)[Gosh]", '');
			expectMarkupToPrint("(if:true)[Gosh]", 'Gosh');
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(if:true)");
		});
		it("can be composed with itself", function() {
			expectMarkupToPrint("(set: $a to (if: true) + (if:true))$a[Gee]","Gee");
			expectMarkupToPrint("(set: $a to (if: false) + (if:true))$a[Gee]","");
		});
		it("has structural equality", function() {
			expectMarkupToPrint("(print: (if: true) is (if:true))","true");
			expectMarkupToPrint("(print: (if: true) is not (if:false))","true");
		});
		it("can be composed with other style macros", function() {
			expectMarkupToPrint("(set: $a to (if: true) + (text-style:'bold'))$a[Gee]","Gee");
			expectMarkupToPrint("(set: $a to (if: false) + (text-style:'bold'))$a[Gee]","");
		});
	});
	describe("the (unless:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expectMarkupToError("(unless:)[]");
			expectMarkupToNotError("(unless:true)[]");
			expectMarkupToError("(unless:'1')[]");
		});
		it("behaves as the inverse of (if:)", function() {
			expectMarkupToPrint("(unless:false)[Gosh]", 'Gosh');
			expectMarkupToPrint("(unless:true)[Gosh]", '');
		});
		it("can be composed with itself", function() {
			expectMarkupToPrint("(set: $a to (unless: false) + (unless:false))$a[Gee]","Gee");
			expectMarkupToPrint("(set: $a to (unless: true) + (unless:false))$a[Gee]","");
		});
		it("has structural equality", function() {
			expectMarkupToPrint("(print: (unless: true) is (unless:true))","true");
			expectMarkupToPrint("(print: (unless: true) is not (unless:false))","true");
		});
		it("can be composed with other style macros", function() {
			expectMarkupToPrint("(set: $a to (unless: false) + (text-style:'bold'))$a[Gee]","Gee");
			expectMarkupToPrint("(set: $a to (unless: true) + (text-style:'bold'))$a[Gee]","");
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
		it("hides the hook if the preceding hook was displayed, otherwise acts like (if:)", function() {
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
		it("hides the hook if the preceding hook was displayed, otherwise shows it", function() {
			expectMarkupToPrint("(either:false)[Wow](else:)[Gee]", 'Gee');
			expectMarkupToPrint("(either:true)[Wow](else:)[Gee]", 'Wow');
		});
		it("works even when nested", function() {
			expectMarkupToPrint("(either:true)[(either:false)[Wow](else:)[Gee]](else:)[Gosh]", 'Gee');
			expectMarkupToPrint("(either:true)[(either:true)[Wow](else:)[Gee]](else:)[Gosh]", 'Wow');
		});
	});
});
