describe("link macros", function() {
	'use strict';
	
	describe("(link-replace:)", function() {
		it("accepts exactly 1 string", function() {
			expectMarkupToError("(print:(link-replace:))");
			expectMarkupToNotError("(print:(link-replace:'baz'))");
			expectMarkupToError("(print:(link-replace:2))");
			expectMarkupToError("(print:(link-replace:false))");
			expectMarkupToError("(print:(link-replace:'baz', 'baz'))");
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(link-replace:'A')");
			expectMarkupToNotError("(link-replace:'A')[]");
		});
		it("when attached to a hook, creates a link", function() {
			var link = runPassage("(link-replace:'A')[]").find('tw-link');
			expect(link.parent().is('tw-hook')).toBe(true);
			expect(link.tag()).toBe("tw-link");
		});
		it("when clicked, reveals the hook and removes itself", function() {
			var p = runPassage("(link-replace:'A')[B(set:$c to 12)]");
			p.find('tw-link').click();
			expect(p.text()).toBe("B");
			expectMarkupToPrint("$c", "12");
		});
		it("is aliased as (link:)", function() {
			var p = runPassage("(link:'A')[B(set:$c to 12)]");
			p.find('tw-link').click();
			expect(p.text()).toBe("B");
			expectMarkupToPrint("$c", "12");
		});
	});
	describe("(link-reveal:)", function() {
		it("accepts exactly 1 string", function() {
			expectMarkupToError("(print:(link-reveal:))");
			expectMarkupToNotError("(print:(link-reveal:'baz'))");
			expectMarkupToError("(print:(link-reveal:2))");
			expectMarkupToError("(print:(link-reveal:false))");
			expectMarkupToError("(print:(link-reveal:'baz', 'baz'))");
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(link-reveal:'A')");
			expectMarkupToNotError("(link-reveal:'A')[]");
		});
		it("when attached to a hook, creates a link", function() {
			var link = runPassage("(link-reveal:'A')[]").find('tw-link');
			expect(link.parent().is('tw-hook')).toBe(true);
			expect(link.tag()).toBe("tw-link");
		});
		it("when clicked, reveals the hook and becomes plain text", function() {
			var p = runPassage("(link-reveal:'A')[B(set:$c to 12)]");
			p.find('tw-link').click();
			expect(p.text()).toBe("AB");
			expect(p.find('tw-link').length).toBe(0);
			expectMarkupToPrint("$c", "12");
		});
	});
	describe("(link-repeat:)", function() {
		it("accepts exactly 1 string", function() {
			expectMarkupToError("(print:(link-repeat:))");
			expectMarkupToNotError("(print:(link-repeat:'baz'))");
			expectMarkupToError("(print:(link-repeat:2))");
			expectMarkupToError("(print:(link-repeat:false))");
			expectMarkupToError("(print:(link-repeat:'baz', 'baz'))");
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(link-repeat:'A')");
			expectMarkupToNotError("(link-repeat:'A')[]");
		});
		it("when attached to a hook, creates a link", function() {
			var link = runPassage("(link-repeat:'A')[]").find('tw-link');
			expect(link.parent().is('tw-hook')).toBe(true);
			expect(link.tag()).toBe("tw-link");
		});
		it("when clicked, reveals the hook and leaves the link as-is", function() {
			var p = runPassage("(link-repeat:'A')[B(set:$c to 12)]");
			p.find('tw-link').click();
			expect(p.text()).toBe("AB");
			expectMarkupToPrint("$c", "12");
			expect(p.find('tw-link').length).toBe(1);
		});
		it("the link can be clicked multiple times", function() {
			var p = runPassage("(set:$c to 0)(link-repeat:'A')[B(set:$c to it + 12)]");
			p.find('tw-link').click();
			p.find('tw-link').click();
			p.find('tw-link').click();
			expectMarkupToPrint("$c", "36");
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
