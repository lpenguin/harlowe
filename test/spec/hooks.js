describe("hooks", function () {
	'use strict';
	describe("named hooks", function () {
		it("consist of a |, a name, and a >, attached to a hook", function (){
			expectMarkupToPrint("|hook>[foo]","foo");
		});
		it("may also alternatively have a mirrored nametag on the other side", function (){
			expectMarkupToPrint("[foo]<hook|","foo");
		});
		it("names may not contain whitespace", function (){
			expectMarkupToPrint("|hook >[foo]","|hook >[foo]");
		});
		it("become <tw-hook> elements", function (){
			runPassage("[foo]<hook|");
			expect($('tw-passage').find('tw-hook').text()).toBe('foo');
		});
	});
	describe("macro attached hooks", function () {
		it("consist of a macro, then a hook", function (){
			expectMarkupToPrint("|hook>[foo]","foo");
		});
		it("may not have a mirrored nametag on the other side", function (){
			expectMarkupToError("(if:true)[foo]<hook|","foo");
		});
		it("will error if the hook has no closing bracket", function (){
			expectMarkupToError("(if:true)[(if:true)[Good golly]");
		});
	});
});
