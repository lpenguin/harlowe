describe("link macros", function() {
	'use strict';
	
	describe("(link:)", function() {
		it("accepts exactly 1 string", function() {
			expectMarkupToError("(print:(link:))");
			expectMarkupToNotError("(print:(link:'baz'))");
			expectMarkupToError("(print:(link:2))");
			expectMarkupToError("(print:(link:false))");
			expectMarkupToError("(print:(link:'baz', 'baz'))");
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(link:'A')");
			expectMarkupToNotError("(link:'A')[]");
		});
		it("when attached to a hook, creates a link", function() {
			var link = runPassage("(link:'A')[]").find('tw-link');
			expect(link.parent().is('tw-hook')).toBe(true);
			expect(link.tag()).toBe("tw-link");
		});
	});
	describe("(link-goto:)", function() {
		it("renders to a <tw-link> element if the linked passage exists", function() {
			createPassage("","mire");
			var link = runPassage("(link-goto:'mire')").find('tw-link');
			
			expect(link.parent().is('tw-expression')).toBe(true);
			expect(link.tag()).toBe("tw-link");
			expect(link.attr("passage-name")).toBe("mire");
		});
		it("becomes a <tw-broken-link> if the linked passage is absent", function() {
			var link = runPassage("(link-goto: 'mire')").find('tw-broken-link');
			
			expect(link.parent().is('tw-expression')).toBe(true);
			expect(link.tag()).toBe("tw-broken-link");
			expect(link.html()).toBe("mire");
		});
		it("produces an error if given no arguments", function() {
			var error = runPassage("(link-goto:)").find('tw-error');
			
			expect(error.length).toBe(1);
		});
		it("produces an error if given non-string arguments", function() {
			var error = runPassage("(link-goto: 2)(link-goto: true)").find('tw-error');
			
			expect(error.length).toBe(2);
		});
		it("goes to the passage when clicked", function() {
			createPassage("<p>garply</p>","mire");
			var link = runPassage("(link-goto:'mire')").find('tw-link');
			link.click();
			expect($('tw-passage p').text()).toBe("garply");
		});
		it("can be focused", function() {
			createPassage("","mire");
			var link = runPassage("(link-goto:'mire')").find('tw-link');
			expect(link.attr("tabindex")).toBe("0");
		});
		it("behaves as if clicked when the enter key is pressed while it is focused", function() {
			createPassage("<p>garply</p>","mire");
			var link = runPassage("(link-goto:'mire')").find('tw-link');
			link.trigger($.Event('keydown', { which: 13 }));
			expect($('tw-passage p').text()).toBe("garply");
		});
	});
});
