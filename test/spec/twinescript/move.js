describe("the (move:) macro", function() {
	'use strict';
	it("requires an 'into' assignment request", function() {
		expect("(move: 1)").markupToError();
		expect("(move: 'A')").markupToError();
		expect("(move: false)").markupToError();
		expect("(move: $a)").markupToError();
		expect("(move:)").markupToError();
		expect("(move: $b into $a)").not.markupToError();
		expect("(move: $b into $a, $c into $b)").not.markupToError();
		expect("(move: $a to 1)").markupToError();
		expect("(move: $a to $b)").markupToError();
	});
	it("when given a variable assignment request, moves one variable's value into the other", function() {
		expect("(set: $a to 1)(move: $a into $b)$b $a").markupToPrint("1 0");
	});
	it("runs on evaluation, but can't be assigned or used as a value", function() {
		runPassage("(set: $a to 3)");
		expect("(print: (move: $a into $b))").markupToError();
		expect("(print: (a:(move: $b into $c)))").markupToError();
		expect("(print: $c)").markupToPrint("3");
	});
	it("when given a hook assignment request, fills the hook with the contents, as twinemarkup", function() {
		expect("|a>[Gee] |b>[Wow](move: ?a into ?b)").markupToPrint(" Gee");
	});
	it("can replace array properties", function() {
		runPassage("(set: $a to (a:3,1))(set: $b to 2)(move: $b into $a's last)");
		expect("$b").markupToPrint("0");
		expect("(print:$a)").markupToPrint("3,2");
	});
	it("can remove array properties", function() {
		runPassage("(set: $a to (a:3,2))(move: $a's last into $b)");
		expect("$b").markupToPrint("2");
		expect("(print:$a's last)").markupToPrint("3");
	});
	it("can insert datamap properties", function() {
		runPassage("(set: $d to (datamap:))(set: $b to 3)(move: $b into $d's A)");
		expect("$b").markupToPrint("0");
		expect("(print:$d's A)").markupToPrint("3");
	});
	it("can replace datamap properties", function() {
		runPassage("(set: $d to (datamap:'B',2))(set: $b to 3)(move: $b into $d's B)");
		expect("$b").markupToPrint("0");
		expect("(print:$d's B)").markupToPrint("3");
	});
	it("can remove datamap properties", function() {
		runPassage("(set: $d to (datamap:'A',2,'B',3))(move: $d's A into $b)");
		expect("$b").markupToPrint("2");
		expect("(print:$d's A)").markupToError();
	});
	describe("doesn't pollute past turns", function() {
		it("when replacing array properties", function() {
			runPassage("(set: $a to (a:3,1))(set: $b to 2)","one");
			runPassage("(move: $b into $a's last)","two");
			Engine.goBack();
			expect("$b").markupToPrint("2");
			expect("(print:$a)").markupToPrint("3,1");
		});
		it("when removing array properties", function() {
			runPassage("(set: $a to (a:3,2))","one");
			runPassage("(move: $a's last into $b)","two");
			Engine.goBack();
			expect("$b").markupToPrint("0");
			expect("(print:$a's last)").markupToPrint("2");
		});
		it("when inserting datamap properties", function() {
			runPassage("(set: $d to (datamap:))(set: $b to 3)","one");
			runPassage("(move: $b into $d's A)","two");
			Engine.goBack();
			expect("$b").markupToPrint("3");
			expect("(print:$d's A)").markupToError();
		});
		it("when replacing datamap properties", function() {
			runPassage("(set: $d to (datamap:'B',2))(set: $b to 3)","one");
			runPassage("(move: $b into $d's B)","two");
			Engine.goBack();
			expect("$b").markupToPrint("3");
			expect("(print:$d's B)").markupToPrint("2");
		});
		it("when removing datamap properties", function() {
			runPassage("(set: $d to (datamap:'A',2,'B',3))","one");
			runPassage("(move: $d's A into $b)","two");
			Engine.goBack();
			expect("$b").markupToPrint("0");
			expect("(print:$d's A)").markupToPrint("2");
		});
	});
});
