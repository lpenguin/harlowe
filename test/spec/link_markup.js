'use strict';

describe("link syntax", function() {
	describe("simple link syntax", function() {
		it("consists of [[, text, then ]], and desugars to a (link-goto:) macro", function() {
			var expression = runPassage("[[flea]]").find('tw-expression');
			
			expect(expression.tag()).toBe("tw-expression");
			expect(expression.attr("type")).toBe("macro");
			expect(expression.attr("name")).toBe("link-goto");
			expect(expression.text()).toBe("flea");
		});
		it("may have non-sequential ]s in the text", function() {
			var expression = runPassage("[[fl]e]a]]").find('tw-expression');
			
			expect(expression.tag()).toBe("tw-expression");
			expect(expression.attr("type")).toBe("macro");
			expect(expression.attr("name")).toBe("link-goto");
			expect(expression.text()).toBe("fl]e]a");
		});
		it("renders to a <tw-link> element if the linked passage exists", function() {
			createPassage("","glen");
			var link = runPassage("[[glen]]").find('tw-link');
			
			expect(link.parent().is('tw-expression')).toBe(true);
			expect(link.tag()).toBe("tw-link");
			expect(link.attr("passage-id")).toBe("glen");
		});
		it("becomes a <tw-broken-link> if the linked passage is absent", function() {
			var link = runPassage("[[glen]]").find('tw-broken-link');
			
			expect(link.parent().is('tw-expression')).toBe(true);
			expect(link.tag()).toBe("tw-broken-link");
			expect(link.html()).toBe("glen");
		});
		it("may contain markup, and links to the correct passage based on the plain text", function() {
			createPassage("","glen");
			var link = runPassage("[[gl''e''n]]").find('tw-link');
			
			expect(link.tag()).toBe("tw-link");
			expect(link.html()).toBe("gl<b>e</b>n");
			expect(link.attr("passage-id")).toBe("glen");
		});
		it("may contain line breaks", function() {
			createPassage("","glen");
			var link = runPassage("[[\nglen\n]]").find('tw-link');
			
			expect(link.tag()).toBe("tw-link");
			expect(link.html()).toBe("<br>glen<br>");
			expect(link.attr("passage-id")).toBe("glen");
		});
	});
	describe("proper link syntax", function() {
		it("consists of a simple link with <- or ->", function() {
			var expression = runPassage("[[in->out]]").find('tw-expression');
			
			expect(expression.tag()).toBe("tw-expression");
			expect(expression.attr("type")).toBe("macro");
			expect(expression.attr("name")).toBe("link-goto");
		});
		it("only displays the text on the other side of the arrow", function() {
			var expression = runPassage("[[in->out]]").find('tw-expression');
			
			expect(expression.text()).toBe("in");
		});
		it("links to the passage pointed to by the arrow", function() {
			createPassage("", "out");
			
			var link = runPassage("[[in->out]]").find('tw-link');
			
			expect(link.parent().is('tw-expression')).toBe(true);
			expect(link.attr("passage-id")).toBe("out");
			
			link = runPassage("[[out<-in]]").find('tw-link');
			
			expect(link.parent().is('tw-expression')).toBe(true);
			expect(link.attr("passage-id")).toBe("out");
		});
		it("uses the rightmost right arrow (or, in its absence, leftmost left arrow) as the separator", function() {
			createPassage("", "E");
			
			var link = runPassage("[[A->B->C->D->E]]").find('tw-link');
			
			expect(link.text()).toBe("A->B->C->D");
			expect(link.attr("passage-id")).toBe("E");
			
			link = runPassage("[[E<-D<-C<-B<-A]]").find('tw-link');
			
			expect(link.text()).toBe("D<-C<-B<-A");
			expect(link.attr("passage-id")).toBe("E");
			
			link = runPassage("[[A<-B<-C->D->E]]").find('tw-link');
			
			expect(link.attr("passage-id")).toBe("E");
			
			createPassage("", "C<-D<-E");
			link = runPassage("[[A->B->C<-D<-E]]").find('tw-link');
			
			expect(link.attr("passage-id")).toBe("C<-D<-E");
		});
	});
});
