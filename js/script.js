define(['jquery', 'state', 'utils', 'engine', 'wordarray'], function ($, State, Utils, Engine, WordArray)
{
	"use strict";
	/*
		script: Scope in which script-based macros are evaluated.
		
		Everything in here is exposed to authors via <<script>>, etc.
	*/
	// The calling macro's top reference - set by every _eval() call.
	var _top;
	
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
	}
	
	// Choose one argument, up to 16. Can be used as such: <<display either( "pantry", "larder", "cupboard" )>>
	function either()
	{
		return arguments[~~(Math.random()*arguments.length)];
	}
	
	/*
		Wrappers for state
	*/
	
	function visited(name)
	{
		return name ? State.passageNameVisited(name) : State.passageIDVisited(State.passage);
	}
	
	/*
		Wrappers for engine
	*/
	
	function goto(name)
	{
		return Engine.goToPassage(name);
	}
	
	/*
		Wrappers for engine
	*/
	
	function Text(a)
	{
		return WordArray.create.call(WordArray, '"' + a + '"', _top);
	}
	
	/*
		eval() the script in the context of this module.
	*/
	
	// Filter the call through this function so that 'this' points to
	// the calling <<script>> element.
	function _eval(text, top)
	{
		_top = top;
		return eval(text + '');
	}
	
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