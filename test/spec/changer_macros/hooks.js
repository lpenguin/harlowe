describe("the (hook:) macro", function () {
	'use strict';
	it("requires exactly 1 string argument", function() {
		expectMarkupToError("(print:(hook:))");
		expectMarkupToError("(print:(hook:1))");
		expectMarkupToError("(print:(hook:'A','B'))");
		expectMarkupToNotError("(print:(hook:'A'))");
	});
	it("errors when placed in passage prose while not attached to a hook", function() {
		expectMarkupToError("(hook:'A')");
		expectMarkupToNotError("(hook:'A')[]");
	});
	it("gives a name to the hook", function (){
		runPassage("(hook:'grault')[foo]");
		expect($('tw-passage').find('tw-hook').attr('name')).toBe('grault');
	});
});
