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
	function hexToRGB(str) {
		// Trim off the "#".
		str = str.replace("#", '');
		return {
			r: parseInt(str.slice(0,2), 16),
			g: parseInt(str.slice(2,4), 16),
			b: parseInt(str.slice(4,6), 16),
		};
	}
	function expectColourToBe(str, colour) {
		var rgb = hexToRGB(colour);

		expect(runPassage("(print:" + str + ")").find('tw-colour').attr('style'))
			.toMatch(new RegExp(
				"background-color:\\s*(?:" + colour.toUpperCase() + "|rgb\\(\\s*"
				+ (rgb.r || 0) + ",\\s*"
				+ (rgb.g || 0) + ",\\s*"
				+ (rgb.b || 0) + "\\s*\\))"
			));
	}
	describe("RGB colours", function() {
		it("can consist of three case-insensitive hexadecimal digits preceded by #", function() {
			expectColourToBe("#000", "#000000");
			expectColourToBe("#103", "#110033");
			expectColourToBe("#fAb", "#FFAABB");
			expectMarkupToJSError("(print: #g00)");
		});
		it("can consist of six case-insensitive hexadecimal digits preceded by #", function() {
			expectColourToBe("#000000", "#000000");
			expectColourToBe("#100009", "#100009");
			expectColourToBe("#abcDEf", "#ABCDEF");
			expectMarkupToJSError("(print: #bcdefg)");
		});
		it("can only be six or three digits long", function() {
			expectMarkupToJSError("(print: #12)");
			expectMarkupToJSError("(print: #1234)");
			expectMarkupToJSError("(print: #12345)");
			expectMarkupToJSError("(print: #1234567)");
		});
	});
	describe("Harlowe colours", function() {
		it("consist of special case-insensitive keywords", function() {
			/*
				This should be the same mapping as in markup/markup.js
			*/
			var mapping = {
				"red"    : "e61919",
				"orange" : "e68019",
				"yellow" : "e5e619",
				"lime"   : "80e619",
				"green"  : "19e619",
				"cyan"   : "19e5e6",
				"aqua"   : "19e5e6",
				"blue"   : "197fe6",
				"navy"   : "1919e6",
				"purple" : "7f19e6",
				"fuchsia": "e619e5",
				"magenta": "e619e5",
				"white"  : "ffffff",
				"black"  : "000000",
				"gray"   : "888888",
				"grey"   : "888888",
			};
			Object.keys(mapping).forEach(function(colour) {
				expectColourToBe(colour, "#" + mapping[colour]);
				expectColourToBe(colour.toUpperCase(), "#" + mapping[colour]);
			});
		});
	});
});
