describe("the (hook:) macro", function () {
	'use strict';
	it("requires exactly 1 string argument", function() {
		expectMarkupToError("(hook:)");
		expectMarkupToError("(hook:1)");
		expectMarkupToError("(hook:'A','B')");
		expectMarkupToNotError("(hook:'A')");
	});
	it("gives a name to the hook", function (){
		runPassage("(hook:'grault')[foo]");
		expect($('tw-passage').find('tw-hook').attr('name')).toBe('grault');
	});
});
