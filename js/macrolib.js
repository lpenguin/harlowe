define(['jquery', 'twinemarkup', 'story', 'state', 'macros', 'wordarray', 'scope', 'engine', 'utils'],
function($, TwineMarkup, Story, State, Macros, WordArray, Scope, Engine, Utils) {
	"use strict";
	/*
		Twine macro standard library.
		Modifies the Macros module only. Exports nothing.
	*/
	
	/*
		Macros are primarily defined by their fn: a function which determines what
		the macro evaluates to.
		
	*/
	function renderInto(code, dest, top, prepend) {
		var result = top.render(code + '');
		if (result) {
			prepend ? dest.prepend(result) : dest.append(result);
			Utils.transitionIn(result, "fade-in");
			top.updateEnchantments();
		}
	}
	
	/*
		Takes a function, and registers it as a live sensor macro.
		
		Sensors' functions produce booleans, and may also cause side-effects.
	
	function addSensor(name, fn) {
		Macros.add(name, {
			type: "sensor",
			live: true,
			fn: fn
		});
	}
	*/
	
	/*
		Takes a function, and registers it as a live Changer macro.
		
		Changers return a transformation function that is passed
		a ChangerDescriptor object.
		
		A ChangerDescriptor is a plain object with the following values:
					
		{String} transition      Which transition to use.
		{Number} transitionTime  The duration of the transition, in ms.
		{String} code            Transformations made on the hook's code before it is run.
		{jQuery} target          Where to render the code, if not the hookElement.
		{String} append          Which jQuery method to append the code to the dest with.
	*/
	function addChanger(name, fn) {
		Macros.add(name, {
			type: "changer",
			live: false,
			fn: fn
		});
	}
	
	/*
		One problem is that doExpressions() has no easy way of determining
		if a function it acquired by evaluating an expression is a changer function.
		
		So, by tagging all changer functions with an expando property, they can be duck-typed.
		
		It's mandatory that all changer functions' return values pass through
		this function, sadly.
		
		Alternative solution rejected: all changer functions must have the name 'changerFn'
		or something. (Relying on a function's inner name for anything other than metadata is,
		I feel, overly ad-hoc.) 
	*/
	function changerFn(fn) {
		fn.changer = true;
		return fn;
	}
	
	/*
		Basic Macros
	*/

	// set()
	Macros.add("set", function () {
		return "";
	});

	// run()
	Macros.add("run", function() {
		return "";
	});

	// print()
	Macros.add("print", function (expr) {
		return expr+"";
	});

	// if() / elseif() / else()
	(function() {
		/*
			In order to make elseif() work, 
			the if() macro's implementation must have private state.
			This is something of a hack, and should probably be reconsidered.
		*/
		var lastIf,
			// The state of the last if() is reset on passage change.
			currentPassage = "",
			initState = function() {
				if (State.passage !== currentPassage) {
					currentPassage = State.passage;
					lastIf = false;
				}
			};
			
		Macros
		.add("if", function _if(expr) {
			initState();
			return !!(lastIf = !!expr);
		})
		.add("unless", function unless(expr) {
			initState();
			return !(lastIf = !!expr);
		})
		.add("elseif", function elseif(expr) {
			initState();
			// Only run if the previous if() failed
			return (!lastIf && (lastIf = !!expr));
		})
		.add("else", function _else() {
			initState();
			// Only run if the previous if() failed
			return !lastIf;
		});
	}());
	
	// display()
	Macros.add("display", function display(name) {
		try {
			// Test for existence
			if (!Story.passageNamed(name)) {
				//this.error('Can\'t <<display>> passage "' + name + '"', true);
				return;
			}
			// Test for recursion
			/*if (this.contextQuery("display").filter(function (e) {
				return e.el.filter("[display='" + name + "']").length > 0;
			}).length >= 5) {
				this.error('<<display>> loop: "' + name + '" is displaying itself 5+ times.', true);
				return;
			}
			this.el.attr("display", name);*/
			return (Story.passageNamed(name).html());
		} catch (e) {
			//this.error(e.message);
		}
	});
	
	// transition()
	addChanger("transition", function transition(name, time) {
		return changerFn(function(d) {
			d.transition = name;
			d.transitionTime = time;
		});
	});

	// nobr()
	// Remove line breaks from the hook.
	// Manual line breaks can be inserted with <br>.
	addChanger("nobr", function nobr() {
		return changerFn(function(d) {
			// To prevent keywords from being created by concatenating lines,
			// replace the line breaks with a zero-width space.
			d.code = d.code.replace(/\n/g, "&zwnj;");
		});
	});

	// style()
	// Insert the enclosed raw CSS into a <style> tag that exists for the
	// duration of the current passage only.
	// contents: raw CSS.
	addChanger("style", function style() {
		return changerFn(function(d) {
			var selector = 'style#macro';
			if (!$(selector).length) {
				$(document.head).append($('<style id="macro">'));
			}
			$(selector).text(Utils.unescape(d.code));
			d.code = "";
		});
	});

	// TODO: script()

	// time()
	// Perform the enclosed macros after the delay has passed.
	// If multiple delay are given, run the macro multiple times,
	// using each delay in order.
	function newTimedMacroFn(innerFn) {
		return function timedMacroFn(delays /*variadic */) {
			// TODO: proper type checking
			delays = Array.from(arguments).filter(
				function(e) {
					// This is a deliberate window.isNaN invocation.
					return !isNaN(+e);
				});
			if (delays.length) {
				return function(hook, top) {
					var code = hook.attr('code');
					hook.removeAttr('code');
					
					function timeMacroTimeout() {
						if ($('html').find(hook).length > 0) {
							
							if (innerFn) {
								innerFn(code, hook, top);
							}
							else {
								renderInto(code, hook, top);
							}
							// Re-run the timer with the next number.
							if (delays.length) {
								setTimeout(timeMacroTimeout, delays.shift());
							}
						}
					}
					setTimeout(timeMacroTimeout, delays.shift());
				};
			} else {
				//this.error("'" + this.rawArgs + "' isn't " + (delays.length <= 1 ? "a " : "") + "valid time delay" + (delays.length >
				//	1 ? "s" : ""));
				return;
			}
		};
	}
	Macros.add("time", newTimedMacroFn());

	// TODO: key()
	// Perform the enclosed macros after the given keyboard letter is pushed
	
	/*
		Generate a function for enchantment macros or scope macros.
		If no enchantDesc is passed, then it's a plain scope macro.
		Otherwise, it's an enchantment macro.
		
		The enchantDesc object contains the following:
		- event: the DOM event that triggers the rendering of this macro's contents.
		- classList: the list of classes to 'enchant' the hook with, to denote that it is ready for the player to
		trigger an event on it.
		- rerender: a String determining whether to clear the span before rendering into it ("replace", default),
		append the rendering to its current contents ("append") or prepend it ("prepend").
		- once: Boolean whether or not the enchanted DOM elements can trigger this macro multiple times.
		- filterFn: a Function to determines whether to apply the enchantment class to said hook. First arg is the
		
		@method newEnchantmentMacroFn
		@param {Function} innerFn The function to perform on the macro's hooks
		@param {Object} [enchantDesc] An enchantment description object, or null.
		@return {Function} An enchantment macro function.
	*/
	function newEnchantmentMacroFn(innerFn, enchantDesc) {

		// Enchantment macro? Register the enchantment's event.
		if (enchantDesc && enchantDesc.event && enchantDesc.classList) {
			// Set the event that the enchantment descriptor declares
			Macros.registerEnchantmentEvent(enchantDesc.event,
				Utils.classListToSelector(enchantDesc.classList));
		}
		return function enchantmentMacroFn(selectors /* variadic */) {
			selectors = Array.from(arguments);
			
			/*
				This hook-augmenter function transforms Hook nodes into Enchanters,
				which are hooks that "enchant" a scope.
				
				Note: some enchantments (like replace()) are executed immediately,
				and thus instantly dispel their enchantment.
				
				The scope is specified by the selectors passed to the macro.
			*/
			return function makeEnchanter(hook, top) {
				var scope = Scope.create(selectors, top),
					code = hook.attr('code'),
					enchantData;
				hook.removeAttr("code");

				/*
					An Enchanter's event function either executes innerFn on the hook,
					or (by default) renders the hook's code into the hook.
					
					For enchanter hooks, this function runs when the enchantment's event
					(e.g. clicking for click(), time for timed___()) is triggered.
					Otherwise...
				*/
				function eventFn() {
					var rerender = enchantDesc && enchantDesc.rerender;
					
					if (innerFn && typeof innerFn === "function") {
						//TODO: make this signature less messy
						innerFn(code, hook, top, scope);
					} else {
						// Default behaviour: simply parse the inner contents.
						if (!rerender || rerender === "replace") {
							Utils.transitionOut(hook.children(), "fade-in");
						}
						/*
							Transition the resulting Twine code into the expression's element.
						*/
						renderInto(code + '', hook, top, rerender === "prepend");
					}
				}
				/*
					...it runs immediately.
				*/
				if (!enchantDesc) {
					eventFn();
					return;
				}
				/*
					Enchanters differ from normal hooks in that they have the
					"enchanter" attribute, and they have enchantment jQuery data, which
					is an object holding the macro's enchantment descriptor,
					the eventFn, and the "top", plus some tiny methods.
				*/
				enchantData = {
					fn: eventFn,
					enchantDesc: enchantDesc,
					scope: scope,
					top: top,
					/*
						Enchants the scope, applying the macro's enchantment's classes
						to the matched elements.
					*/
					enchantScope: function () {
						if (this.scope && this.enchantDesc) {
							this.scope.enchant(this.enchantDesc.classList, this.top);
						}
					},
					/*
						Refresh the scope to reflect the current passage DOM state.
						Necessary if the scope selector is a WordArray or jQuery selector,
						or if a hook was removed or inserted for some other reason.
						
						@method refreshScope
					*/
					refreshScope: function () {
						if (this.scope) {
							this.scope.refresh(this.top);
						}
					}
				};
				hook.attr("enchanter", "")
					.data("enchantment", enchantData);
				enchantData.enchantScope();
			};
		};
	}
	
	var interactionTypes = [
		// click()
		// Reveal the enclosed hook only when the scope is clicked.
		{
			name: "click",
			enchantDesc: {
				event: "click",
				once: true,
				rerender: "replace",
				classList: "link enchantment-link"
			}
		},
		// mouseover()
		// Perform the enclosed macros when the scope is moused over.
		{
			name: "mouseover",
			enchantDesc: {
				event: "mouseenter",
				once: true,
				rerender: "replace",
				classList: "enchantment-mouseover"
			}
		},
		// mouseout()
		// Perform the enclosed macros when the scope is moused away.
		{
			name: "mouseout", 
			enchantDesc: {
				event: "mouseleave",
				once: true,
				rerender: "replace",
				classList: "enchantment-mouseout"
			}
		}];
	
	//TODO: hover()
	
	interactionTypes.forEach(function(e) {
		Macros.add(e.name, newEnchantmentMacroFn(null, e.enchantDesc));
	});


	/*
		Revision macros
	*/

	var revisionTypes = [
		// replace()
		// A macro that replaces the scope element(s) with its contents.
		"replace",
		// append()
		// Similar to replace, but appends the contents to the scope(s).
		"append",
		// prepend()
		// Similar to replace, but prepends the contents to the scope(s).
		"prepend"
	];
	
	revisionTypes.forEach(function(e) {
		Macros.add(e, newEnchantmentMacroFn(function (code, hook, top, scope) {
			/*
				By passing a function here (a bound call to Engine.render)
				then the passed code is re-evaluated on every time, allowing
				random macros like either() to behave correctly.
			*/
			scope[e](top.render.bind(top, code));
			top.updateEnchantments();
		}));
	});

	// remove()
	// Removes the scope(s).
	Macros.add("remove", function (code, hook, top, scope) {
		scope.remove();
		top.updateEnchantments();
	});

	/*
		Combos
	*/
	
	revisionTypes.forEach(function(revisionType) {
		interactionTypes.forEach(function(interactionType) {
			// Enchantment macros
			Macros.add(interactionType.name + "-" + revisionType,
				newEnchantmentMacroFn(function (code, hook, top, scope) {
					scope[revisionType](top.render.bind(top, code));
					top.updateEnchantments();
				},
				interactionType.enchantDesc)
			);
		});
		// Timed macros
		Macros.add("timed-" + revisionType, 
			newTimedMacroFn(function (code, hook, top, scope) {
				scope[revisionType](top.render.bind(top, code));
				top.updateEnchantments();
			})
		);
	});
	
	/*
		JS library wrapper macros
	*/
	
	/*
		Filter out NaN and Infinities, throwing an error instead.
		This is only applied to functions that can create non-numerics,
		namely log, sqrt, etc.
	*/
	function mathFilter (fn) {
		return function () {
			var result = fn.apply(this, arguments);
			if (!$.isNumeric(result)) {
				throw new RangeError("math result is " + result);
			}
			return result;
		};
	}
		
	({
		/*
			Wrappers for Date
		*/

		// The current weekday, in full
		weekday: function () {
			return ['Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Satur'][new Date().getDay()] + "day";
		},

		// The current day number
		monthday: function () {
			return new Date().getDate();
		},

		// The current time in 12-hour hours:minutes format.
		currenttime: function () {
			var d = new Date(),
				am = d.getHours() < 12;

			return d.getHours() % 12 + ":" + d.getMinutes() + " " + (am ? "A" : "P") + "M";
		},

		// The current date in DateString format (eg. "Thu Jan 01 1970").
		currentdate: function () {
			return new Date().toDateString();
		},

		/*
			Wrappers for basic Math
			(includes ES6 polyfills)
		*/

		min: Math.min,
		max: Math.max,
		abs: Math.abs,
		sign: Math.sign || function (val) {
			return !$.isNumeric(val) ? val : Math.max(-1, Math.min(1, Math.ceil(val)));
		},
		sin: Math.sin,
		cos: Math.cos,
		tan: Math.tan,
		floor: Math.floor,
		round: Math.round,
		ceil: Math.ceil,
		pow: Math.pow,
		exp: Math.exp,
		sqrt: mathFilter(Math.sqrt),
		log: mathFilter(Math.log),
		log10: mathFilter(Math.log10 || function (value) {
			return Math.log(value) * (1 / Math.LN10);
		}),
		log2: mathFilter(Math.log2 || function (value) {
			return Math.log(value) * (1 / Math.LN2);
		}),

		/*
			Basic randomness
		*/

		// A random integer function
		// 1 argument: random int from 0 to a inclusive
		// 2 arguments: random int from a to b inclusive (order irrelevant)
		random: function (a, b) {
			var from, to;
			if (!b) {
				from = 0;
				to = a;
			} else {
				from = Math.min(a, b);
				to = Math.max(a, b);
			}
			to += 1;
			return~~ ((Math.random() * (to - from))) + from;
		},

		// Choose one argument, up to 16. Can be used as such: <<display either( "pantry", "larder", "cupboard" )>>
		either: function either() {
			if (Array.isArray(arguments[0]) && arguments.length === 1) {
				return either.apply(this,arguments[0]);
			}
			return arguments[~~(Math.random() * arguments.length)];
		},

		/*
			Wrappers for state
		*/

		// Return the number of times the named passage was visited.
		// For multiple arguments, return the smallest visited value.
		visited: function visited(name) {
			var ret, i;
			if (arguments.length > 1) {
				for (i = 0, ret = State.pastLength; i < arguments.length; i++) {
					ret = Math.min(ret, visited(arguments[i]));
				}
				return ret;
			}
			return name ? State.passageNameVisited(name) : State.passageIDVisited(State.passage);
		},
		
		// Return the name of the previous visited passage.
		previous: function () {
			return Story.getPassageName(State.previousPassage() || Story.startPassage);
		},

		/*
			Wrappers for engine
		*/

		goto: function (name) {
			return Engine.goToPassage(name);
		},

		/*
			Wrappers for Window
		*/

		// Keep "undefined" from being the default text.
		alert: function (text) {
			return window.alert(text || "");
		},
		prompt: function (text, value) {
			return window.prompt(text || "", value || "") || "";
		},
		confirm: function (text) {
			return window.confirm(text || "");
		},
		openURL: window.open,
		reload: window.location.reload,
		gotoURL: window.location.assign,
		pageURL: function () {
			return window.location.href;
		},
		/*
			This method takes all of the above and registers them
			as Twine macros.
			
			By giving this JS's only falsy object key,
			this method is prohibited from affecting itself.
		*/
		"": function() {
			Object.keys(this).forEach(function(key) {
				if (key) {
					Macros.add(key, this[key]);
				}
			}.bind(this));
		}
	}[""]());
	
	Utils.log("Macrolib module ready!");
});