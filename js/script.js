define(['jquery', 'state', 'utils', 'engine', 'wordarray'], function ($, State, Utils, Engine, WordArray)
{
	"use strict";
	/*
		script: Scope in which script-based macros are evaluated.
		
		Everything in here is exposed to authors via <<script>>, etc.
	*/
	
	// The calling macro's top reference - set by every _eval() call.
	var _top,
	
	
	// Filter out NaN and Infinities, throwing an error instead.
	// This is only applied to functions that can create non-numerics,
	// namely log, sqrt, etc.
	_mathFilter = function(fn)
	{
		return function()
		{
			var result = fn.apply(this,arguments);
			if (!$.isNumeric(result))
			{
				throw new RangeError("Math result is " + result);
			}
			return result;
		};
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
	sqrt = _mathFilter(Math.sqrt),
	log = _mathFilter(Math.log),
	log10 = _mathFilter(Math.log10 || function(value) {
		return log(value) * (1 / Math.LN10);
	}),
	log2 = _mathFilter(Math.log2 || function(value) {
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
	
	/*
		Wrappers for Window (which could be redefined later).
	*/
	
	alert = window.alert,
	confirm = window.confirm,
	prompt = window.prompt,
	open = window.open,
	
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