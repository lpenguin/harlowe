describe("twinescript operators", function () {
	'use strict';
	describe("the + operator", function () {
		it("adds numbers", function (){
			expect("(print: 3 + 5)").markupToPrint("8");
		});
		it("can be unary", function (){
			expect("(print: + 5)").markupToPrint("5");
		});
		it("has correct precedence", function () {
			expect("(print: 3 + 5 * 2)").markupToPrint("13");
			expect("(print: 5 * 2 + 3)").markupToPrint("13");
		});
		it("can be used to concatenate strings", function () {
			expect("(print: '15' + '2')").markupToPrint("152");
		});
		it("can be used to concatenate arrays", function () {
			expect("(print: (a:1) + (a:2))").markupToPrint("1,2");
			expect("(print: (a:1,3) + (a:2,4))").markupToPrint("1,3,2,4");
		});
	});
	describe("the - operator", function () {
		it("subtracts numbers", function (){
			expect("(print: 3 - 5)").markupToPrint("-2");
		});
		it("can be unary", function (){
			expect("(print: - 5)").markupToPrint("-5");
		});
		it("has correct precedence", function () {
			expect("(print: 3 - 5 * 2)").markupToPrint("-7");
			expect("(print: 5 * 2 - 3)").markupToPrint("7");
		});
		it("can be used on strings", function () {
			expect("(print: '51' - '5')").markupToPrint("1");
			expect("(print: 'reeeed' - 'e')").markupToPrint("rd");
		});
		it("can be used on arrays", function () {
			expect("(print: (a:1,3,5,3) - (a:3))").markupToPrint("1,5");
		});
	});
	describe("the * operator", function () {
		it("multiplies numbers", function (){
			expect("(print: 3 * 5)").markupToPrint("15");
		});
		it("can't be used on strings or arrays", function () {
			expect("(print: '15' * '2')").markupToError();
			expect("(print: 2 * (a:2))").markupToError();
		});
	});
	describe("the / operator", function () {
		it("divides numbers", function (){
			expect("(print: 15 / 5)").markupToPrint("3");
		});
		it("can't be used on strings or arrays", function () {
			expect("(print: '15' / '2')").markupToError();
			expect("(print: 2 / (a:2))").markupToError();
		});
		it("can't divide by zero", function () {
			expect("(print: 15 / 0)").markupToError();
		});
	});
	describe("the % operator", function () {
		it("remainders numbers", function (){
			expect("(print: 31 % 10)").markupToPrint("1");
		});
		it("can't be used on strings", function () {
			expect("(print: '15' * '2')").markupToError();
		});
		it("can't divide by zero", function (){
			expect("(print: 15 % 0)").markupToError();
		});
	});
	describe("the 'and' operator", function () {
		it("ANDs booleans", function (){
			expect("(print: true and true)").markupToPrint("true");
			expect("(print: true and false)").markupToPrint("false");
			expect("(print: false and true)").markupToPrint("false");
			expect("(print: false and false)").markupToPrint("false");
			expect("(print: true and true and true and true)").markupToPrint("true");
		});
		it("has correct precedence", function () {
			expect("(print: 2 is 2 and true)").markupToPrint("true");
		});
		it("can't be used on non-booleans", function () {
			expect("(print: true and 2)").markupToError();
			expect("(print: true and '2')").markupToError();
			expect("(print: true and (a:))").markupToError();
		});
	});
	describe("the 'or' operator", function () {
		it("ORs booleans", function (){
			expect("(print: true or true)").markupToPrint("true");
			expect("(print: true or false)").markupToPrint("true");
			expect("(print: false or true)").markupToPrint("true");
			expect("(print: false or false)").markupToPrint("false");
			expect("(print: false or false or true or false)").markupToPrint("true");
		});
		it("has correct precedence", function () {
			expect("(print: 2 is 2 or false)").markupToPrint("true");
		});
		it("can't be used on non-booleans", function () {
			expect("(print: true or 2)").markupToError();
			expect("(print: true or '2')").markupToError();
			expect("(print: true or (a:))").markupToError();
		});
	});
	describe("the 'not' operator", function () {
		it("performs unary NOT on booleans", function (){
			expect("(print: not true)").markupToPrint("false");
			expect("(print: not false)").markupToPrint("true");
			expect("(print: not not not false)").markupToPrint("true");
		});
		it("has correct precedence", function () {
			expect("(print: not true is false)").markupToPrint("true");
		});
		it("can't be used on non-booleans", function () {
			expect("(print: not 2)").markupToError();
			expect("(print: not '2')").markupToError();
			expect("(print: not (a:))").markupToError();
		});
	});
	describe("the 'is' operator", function () {
		it("compares primitives by value", function (){
			expect("(print: 2 is 2)").markupToPrint("true");
			expect("(print: '2' is '2')").markupToPrint("true");
			expect("(print: true is true)").markupToPrint("true");
			expect("(print: 2 is 1)").markupToPrint("false");
			expect("(print: '3' is '2')").markupToPrint("false");
			expect("(print: true is false)").markupToPrint("false");
		});
		it("doesn't coerce values", function (){
			expect("(print: 2 is '2')").markupToPrint("false");
			expect("(print: 1 is true)").markupToPrint("false");
		});
		it("can be used as an expression", function (){
			expect("(print: 2 is '2' is true)").markupToPrint("false");
			expect("(print: 1 is true is false)").markupToPrint("false");
		});
		it("compares arrays by value", function (){
			expect("(print: (a:) is (a:))").markupToPrint("true");
			expect("(print: (a:2,3,4) is (a:2,3,4))").markupToPrint("true");
			expect("(print: (a:2,3,4) is (a:2,3,5))").markupToPrint("false");
			expect("(print: (a:(a:)) is (a:(a:)))").markupToPrint("true");
		});
		it("compares datamaps by value", function (){
			expect("(print: (datamap:) is (datamap:))").markupToPrint("true");
			expect("(print: (datamap:'a',2,'b',4) is (datamap:'b',4,'a',2))").markupToPrint("true");
			expect("(print: (datamap:) is (datamap:1))").markupToPrint("false");
			expect("(print: (datamap:'a',2,'b',4) is (datamap:'b',4,'a',3))").markupToPrint("false");
		});
		it("compares datasets by value", function (){
			expect("(print: (dataset:) is (dataset:))").markupToPrint("true");
			expect("(print: (dataset:2,3,4) is (dataset:2,3,4))").markupToPrint("true");
			expect("(print: (dataset:2,3,4) is (dataset:2,3,4,5))").markupToPrint("false");
		});
		it("won't be matched from within text", function (){
			expect("(print: typeof xxisxx)").markupToPrint("undefined");
		});
	});
	describe("the 'is not' operator", function () {
		it("compares primitives by value", function (){
			expect("(print: 2 is not 2)").markupToPrint("false");
			expect("(print: '2' is not '2')").markupToPrint("false");
			expect("(print: true is not true)").markupToPrint("false");
			expect("(print: 2 is not 1)").markupToPrint("true");
			expect("(print: '3' is not '2')").markupToPrint("true");
			expect("(print: true is not false)").markupToPrint("true");
		});
		it("doesn't coerce values", function (){
			expect("(print: 2 is not '2')").markupToPrint("true");
			expect("(print: 1 is not true)").markupToPrint("true");
		});
		it("can be used as an expression", function (){
			expect("(print: 2 is not '2' is not true)").markupToPrint("true");
			expect("(print: true is not true is not false)").markupToPrint("false");
		});
		it("compares arrays by value", function (){
			expect("(print: (a:) is not (a:))").markupToPrint("false");
			expect("(print: (a:2,3,4) is not (a:2,3,4))").markupToPrint("false");
			expect("(print: (a:2,3,4) is not (a:2,3,5))").markupToPrint("true");
			expect("(print: (a:(a:)) is not (a:(a:)))").markupToPrint("false");
		});
		it("compares datamaps by value", function (){
			expect("(print: (datamap:) is not (datamap:))").markupToPrint("false");
			expect("(print: (datamap:'a',2,'b',4) is not (datamap:'b',4,'a',2))").markupToPrint("false");
			expect("(print: (datamap:) is not (datamap:1))").markupToPrint("true");
			expect("(print: (datamap:'a',2,'b',4) is not (datamap:'b',4,'a',3))").markupToPrint("true");
		});
		it("compares datasets by value", function (){
			expect("(print: (dataset:) is not (dataset:))").markupToPrint("false");
			expect("(print: (dataset:2,3,4) is not (dataset:2,3,4))").markupToPrint("false");
			expect("(print: (dataset:2,3,4) is not (dataset:2,3,4,5))").markupToPrint("true");
		});
		it("won't be matched from within text", function (){
			expect("(print: typeof xxisxx)").markupToPrint("undefined");
		});
	});
	describe("the 'contains' operator", function () {
		it("checks for substrings in strings", function (){
			expect("(print: 'Bee' contains 'Be')").markupToPrint("true");
			expect("(print: 'Bee' contains 'Bee')").markupToPrint("true");
			expect("(print: 'Bee' contains 'eeB')").markupToPrint("false");
		});
		it("checks for elements in arrays", function (){
			expect("(print: (a:'Bee') contains 'Bee')").markupToPrint("true");
			expect("(print: (a: 2) contains 2)").markupToPrint("true");
			expect("(print: (a:'Bee') contains 'eeB')").markupToPrint("false");
		});
		it("checks for keys in datamaps", function (){
			expect("(print: (datamap:'Bee',1) contains 'Bee')").markupToPrint("true");
			expect("(print: (datamap:'Bee',1) contains 1)").markupToPrint("false");
		});
		it("checks for elements in datasets", function (){
			expect("(print: (dataset:'Bee','Boo') contains 'Bee')").markupToPrint("true");
			expect("(print: (dataset:'Bee','Boo') contains 'ooB')").markupToPrint("false");
		});
		it("reverts to 'is' comparison for non-string primitives", function (){
			expect("(print: 2 contains 2)").markupToPrint("true");
			expect("(print: true contains true)").markupToPrint("true");
		});
		it("can be used as an expression", function (){
			expect("(print: 'Bee' contains 'Be' is true)").markupToPrint("true");
			expect("(print: 'Bee' contains 'eeB' is false)").markupToPrint("true");
		});
		it("compares arrays by value", function (){
			expect("(print: (a:(a:)) contains (a:))").markupToPrint("true");
			expect("(print: (a:(a:2,3,4)) contains (a:2,3,4))").markupToPrint("true");
		});
		it("compares datamaps by value", function (){
			expect("(print: (a:(datamap:)) contains (datamap:))").markupToPrint("true");
			expect("(print: (a:(datamap:'a',2,'b',4)) contains (datamap:'b',4,'a',2))").markupToPrint("true");
		});
		it("compares datasets by value", function (){
			expect("(print: (a:(dataset:)) contains (dataset:))").markupToPrint("true");
			expect("(print: (a:(dataset:2,3,4)) contains (dataset:2,3,4))").markupToPrint("true");
		});
		it("won't be matched from within text", function (){
			expect("(print: typeof xxcontainsxx)").markupToPrint("undefined");
		});
	});
	describe("the 'is in' operator", function () {
		it("checks for substrings in strings", function (){
			expect("(print: 'Be' is in 'Bee')").markupToPrint("true");
			expect("(print: 'Bee' is in 'Bee')").markupToPrint("true");
			expect("(print: 'Bee' is in 'eeB')").markupToPrint("false");
		});
		it("checks for elements in arrays", function (){
			expect("(print: 'Bee' is in (a:'Bee'))").markupToPrint("true");
			expect("(print: 2 is in (a: 2))").markupToPrint("true");
			expect("(print: 'eeB' is in (a:'Bee'))").markupToPrint("false");
		});
		it("checks for keys in datamaps", function (){
			expect("(print: (datamap:'Bee',1) contains 'Bee')").markupToPrint("true");
			expect("(print: (datamap:'Bee',1) contains 1)").markupToPrint("false");
		});
		it("checks for elements in datasets", function (){
			expect("(print: 'Bee' is in (dataset:'Bee','Boo'))").markupToPrint("true");
			expect("(print: 'ooB' is in (dataset:'Bee','Boo'))").markupToPrint("false");
		});
		it("reverts to 'is' comparison for non-string primitives", function (){
			expect("(print: 2 is in 2)").markupToPrint("true");
			expect("(print: true is in true)").markupToPrint("true");
		});
		it("can be used as an expression", function (){
			expect("(print: true is 'Be' is in 'Bee')").markupToPrint("true");
			expect("(print: false is 'Bee' is in 'eeB')").markupToPrint("true");
		});
		it("compares arrays by value", function (){
			expect("(print: (a:) is in (a:(a:)))").markupToPrint("true");
			expect("(print: (a:2,3,4) is in (a:(a:2,3,4)))").markupToPrint("true");
		});
		it("compares datamaps by value", function (){
			expect("(print: (datamap:) is in (a:(datamap:)))").markupToPrint("true");
			expect("(print: (datamap:'b',4,'a',2) is in (a:(datamap:'a',2,'b',4)))").markupToPrint("true");
		});
		it("compares datasets by value", function (){
			expect("(print: (dataset:) is in (a:(dataset:)))").markupToPrint("true");
			expect("(print: (dataset:2,3,4) is in (a:(dataset:2,3,4)))").markupToPrint("true");
		});
		it("won't be matched from within text", function (){
			expect("(print: typeof xxis in Object)").markupToPrint("false");
		});
	});
	describe("the '...' operator", function () {
		it("spreads strings into positional macro arguments, as characters", function (){
			expect("(a: ...'ABC')").markupToPrint("A,B,C");
		});
		it("spreads arrays into positional macro arguments, as elements", function (){
			expect("(a: ...(a:1,2,'ABC'))").markupToPrint("1,2,ABC");
		});
		it("spreads datasets into positional macro arguments, as elements", function (){
			expect("(a: ...(dataset:1,2,2,'ABC'))").markupToPrint("1,2,ABC");
		});
		it("fails for non-sequential data types", function (){
			expect("(a: ...1)").markupToError();
			expect("(a: ...true)").markupToError();
			expect("(a: ...(datamap:1,'A'))").markupToError();
		});
		it("works with variables", function (){
			expect("(set:$a to (a:1,2,3))(a: ...$a)").markupToPrint("1,2,3");
		});
		it("works with other positional arguments", function (){
			expect("(a: 1, ...(a:2,3))").markupToPrint("1,2,3");
			expect("(a: ...(a:1, 2),3)").markupToPrint("1,2,3");
			expect("(a: 1, ...(a:2),3)").markupToPrint("1,2,3");
		});
	});
});
