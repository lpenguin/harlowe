define(['jquery', 'state', 'utils', 'engine', 'wordarray'],
function ($, State, Utils, Engine, WordArray)
{
	"use strict";
	/*
		Script
		Special eval() scope in which script-based macros are evaluated.
		
		Everything in here is exposed to authors via <<script>>, etc.
	*/
	
	// The calling macro's top reference - set by every _eval() call.
	var _top,
	
	// Filter out NaN and Infinities, throwing an error instead.
	// This is only applied to functions that can create non-numerics,
	// namely log, sqrt, etc.
	mathFilter = function(fn)
	{
		return function()
		{
			var result = fn.apply(this,arguments);
			if (!$.isNumeric(result))
			{
				throw new RangeError("math result is " + result);
			}
			return result;
		};
	},
	
	/*
		Wrappers for Date
	*/
	
	// The current weekday, in full
	weekday = function() {
		return ['Sun','Mon','Tues','Wednes','Thurs','Fri','Satur'][new Date().getDay()] + "day";
	},
	
	// The current day number
	monthday = function() {
		return new Date().getDate();
	},
	
	// The current time in 12-hour hours:minutes format.
	time = function() {
		var d = new Date(),
			am = d.getHours() < 12;
			
		return d.getHours() % 12 + ":" + d.getMinutes() + " " + (am ? "A" : "P") + "M";
	},
	
	// The current date in DateString format (eg. "Thu Jan 01 1970").
	date = function() {
		return new Date().toDateString();
	},
	
	/*
		Wrappers for basic Math
		(includes ES6 polyfills)
	*/
	
	min = Math.min,
	max = Math.max,
	abs = Math.abs,
	sign = Math.sign || function(val) {
		return !$.isNumeric(val) ? val : max(-1, min(1, ceil(val)));
	},
	sin = Math.sin,
	cos = Math.cos,
	tan = Math.tan,
	floor = Math.floor,
	round = Math.round,
	ceil = Math.ceil,
	pow = Math.pow,
	exp = Math.exp,
	sqrt = mathFilter(Math.sqrt),
	log = mathFilter(Math.log),
	log10 = mathFilter(Math.log10 || function(value) {
		return log(value) * (1 / Math.LN10);
	}),
	log2 = mathFilter(Math.log2 || function(value) {
		return log(value) * (1 / Math.LN2);
	}),
	
	/*
		Basic randomness
	*/

	// A random integer function
	// 1 argument: random int from 0 to a inclusive
	// 2 arguments: random int from a to b inclusive (order irrelevant)
	random = function(a, b)
	{
		var from, to;
		if (!b)
		{
			from = 0;
			to = a;
		}
		else
		{
			from = Math.min(a,b);
			to = Math.max(a,b);
		}
		to += 1;
		return ~~((Math.random()*(to-from)))+from;
	},
	
	// Choose one argument, up to 16. Can be used as such: <<display either( "pantry", "larder", "cupboard" )>>
	either = function()
	{
		return arguments[~~(Math.random()*arguments.length)];
	},
	
	/*
		Wrappers for state
	*/
	
	visited = function(name)
	{
		return name ? State.passageNameVisited(name) : State.passageIDVisited(State.passage);
	},
	
	/*
		Wrappers for engine
	*/
	
	goto = function(name)
	{
		return Engine.goToPassage(name);
	},
	
	/*
		Wrappers for WordArray
	*/
	
	Text = function(a)
	{
		return WordArray.create('"' + a + '"', _top);
	},
	
	Hook = function(a)
	{
		return WordArray.create('?' + a, _top);
	},
	
	/*
		Wrappers for Window
	*/
	
	// Keep "undefined" from being the default text.
	alert = function(text) { return window.alert(text || ""); },
	prompt = function(text, value) { return window.prompt(text || "", value || "") || ""; }, 
	confirm = function(text) { return window.confirm(text || ""); },
	openURL = window.open,
	reload = window.location.reload,
	gotoURL = window.location.assign,
	pageURL = function() { return window.location.href; },
	
	/*
		eval() the script in the context of this module.
	*/
	
	// Filter the call through this function so that 'this' points to
	// the calling <<script>> element.
	_eval = function(text, top)
	{
		_top = top;
		return eval(text + '');
	};
	
	/* Undefine previous helpers */
	mathFilter = void 0;
	
	return Object.freeze({
		
		eval: function()
		{
			var self = this;
			// Convert jQuery into WordArray
			if (self && self.jquery)
			{
				self = WordArray.create(self.find(Utils.charSpanSelector));
			}
			return _eval.apply(self, arguments);
		}
	});
});