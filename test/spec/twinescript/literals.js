describe("twinescript literals", function() {
	'use strict';
	describe("numbers", function() {
		it("can consist of positive and negative integers", function() {
			expectMarkupToPrint("(print: 1234567890)","1234567890");
			expectMarkupToPrint("(print: -1234567890)","-1234567890");
			expectMarkupToPrint("(print: 00012)","12");
			expectMarkupToPrint("(print: -00012)","-12");
		});
		it("can consist of decimal fractions (with leading 0s omitted)", function() {
			expectMarkupToPrint("(print: .120)","0.12");
			expectMarkupToPrint("(print: -.120)","-0.12");
			expectMarkupToPrint("(print: 00.120)","0.12");
			expectMarkupToPrint("(print: -00.120)","-0.12");
			expectMarkupToPrint("(print: 1.000)","1");
			expectMarkupToPrint("(print: -1.000)","-1");
		});
		it("can consist of scientific notation", function() {
			expectMarkupToPrint("(print: 1e3)","1000");
			expectMarkupToPrint("(print: 01e03)","1000");
			expectMarkupToPrint("(print: 1e-03)","0.001");
			expectMarkupToPrint("(print: 1.1e03)","1100");
			expectMarkupToPrint("(print: 1.1e-03)","0.0011");
		});
		it("can consist of CSS time values", function() {
			expectMarkupToPrint("(print: 0s)","0");
			expectMarkupToPrint("(print: 0ms)","0");
			expectMarkupToPrint("(print: 1ms)","1");
			expectMarkupToPrint("(print: 1s)","1000");
			expectMarkupToPrint("(print: 10ms)","10");
			expectMarkupToPrint("(print: 10s)","10000");
			expectMarkupToPrint("(print: 1.7ms)","1.7");
			expectMarkupToPrint("(print: 1.7s)","1700");
			expectMarkupToPrint("(print: -5ms)","-5");
			expectMarkupToPrint("(print: -5s)","-5000");
			expectMarkupToJSError("(print: 5 ms)");
			expectMarkupToJSError("(print: 5 s)");
		});
	});
	describe("booleans", function() {
		it("consist of true or false, in lowercase", function() {
			expectMarkupToPrint("(print: true)","true");
			expectMarkupToPrint("(print: false)","false");
			expectMarkupToJSError("(print: True)");
			expectMarkupToJSError("(print: False)");
		});
	});
	describe("strings", function() {
		it("can consist of zero or more characters enclosed in single-quotes", function() {
			expectMarkupToPrint("(print: 'Red')","Red");
			expectMarkupToPrint("A(print: '')B","AB");
		});
		it("can consist of zero or more characters enclosed in double-quotes", function() {
			expectMarkupToPrint('(print: "Red")',"Red");
			expectMarkupToPrint('A(print: "")B',"AB");
		});
		it("can contain line breaks", function() {
			expectMarkupToPrint('(print: "A\nB")',"A\nB");
			expectMarkupToPrint("(print: 'A\nB')","A\nB");
		});
		it("can contain C-style backslash escapes", function() {
			expectMarkupToPrint('(print: "A\\B")',"AB");
			expectMarkupToPrint("(print: 'A\\B')","AB");
			expectMarkupToPrint('(print: "A\\"B")',"A\"B");
			expectMarkupToPrint("(print: 'A\\'B')","A'B");
		});
	});
});
