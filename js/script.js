define(['jquery', 'state', 'utils', 'engine', 'wordarray'], function ($, state, utils, engine, WordArray)
{
	"use strict";
	/*
		script: Scope in which script-based macros are evaluated.
		
		Everything in here is exposed to authors via <<script>>, etc.
	*/
	// The calling macro's top reference - set by every _eval() call.
	var _top,
	// Constant - the selector for charspans
		_selector = "span.char, br";
	
	/*
		Basic randomness
	 */

	// A random integer function
	// 1 argument: random int from 0 to a inclusive
	// 2 arguments: random int from a to b inclusive (order irrelevant)
	function random(a, b)
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
	};
	
	// Choose one argument, up to 16. Can be used as such: <<display either( "pantry", "larder", "cupboard" )>>
	function either()
	{
		return arguments[~~(Math.random()*arguments.length)];
	};
	
	/*
		Wrappers for state
	*/
	
	function visited(name)
	{
		return state.passageNameVisited(name);
	};
	
	/*
		Wrappers for engine
	*/
	
	function goto(name)
	{
		return engine.goToPassage(name);
	};
	
	/*
		Text selectors and manipulators
	 */
	
	// eval() the script in the context of this module.
	function _eval(text, top)
	{
		_top = top;
		return eval(text);
	};
	
	return Object.freeze({
		
		Text: Text,
		
		// Filter for _eval()
		eval: function()
		{
			var self = this;
			
			// Convert jQuery into WordArray
			if (self && self.jquery)
			{
				self = WordArray.create(self.find(utils.charSpanSelector));
			}
			return _eval.apply(self, arguments);
		}
	});
});