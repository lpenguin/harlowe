define(['jquery', 'twinemarkup', 'story', 'state', 'macros', 'engine', 'utils'],
function($, TwineMarkup, Story, State, Macros, Engine, Utils) {
	"use strict";
	/*
		Twine macro standard library.
		Modifies the Macros module only. Exports nothing.
	*/
	
	/*
		This one-line functions returns HTML code for Twine's 
		macro error messages.
	*/
	function errorElement(message) {
		return "<tw-error class='error'>" + message + "</tw-error>";
	}
	
	/*
		Operation.runMacro() in TwineScript passes its arguments as a thunk.
		See that page for the formal explanation. These two functions convert
		regular Javascript functions to accept a such a thunk as its sole argument.
		
		Non-live macros ("eager" macros) don't actually need the thunk - they take it,
		unwrap it, and discard it. Live macros, however, need to retain
		it and re-evaluate it over and over.
	*/
	function eager(fn) {
		return function macroResult(argsThunk) {
			var args = argsThunk(),
				// Do the error check now.
				error = Utils.containsError(args);

			if (error) {
				return errorElement(error);
			}
			return fn.apply(0, args);
		};
	}
	
	/*
		Conversely, this one wrap the function, fn, in an outer function, O,
		which takes argsThunk and returns another thunk that calls the args
		on fn.
		
		Hence, this converts fn into a function that joins the argsThunk
		with the macro's call, creating a combined thunk.
	*/
	function deferred(fn) {
		return function deferredMacroResult(argsThunk) {
			/*
				While macroResultThunk's interior is similar to macroResult,
				returned up above in eagerFunction(),
				note that the scope binding of argsThunk is different,
				and thus it can't really be abstracted out.
			*/
			var t = function macroResultThunk() {
				var args = argsThunk(),
					// Do the error check now.
					error = Utils.containsError(args);
				
				if (error) {
					return errorElement(error);
				}
				return fn.apply(0, args);
			};
			/*
				The combined thunk should have the same expando properties
				("changer", "sensor", etc.) as the initial function.
			*/
			Object.assign(t, fn);
			return t;
		};
	}
	
	/*
		Takes a function, and registers it as a value macro.
	*/
	function addValue(name, fn) {
		Macros.add(name,
			"value",
			eager(fn)
		);
		// Return the function to enable "bubble chaining".
		return addValue;
	}
	
	/*
		Takes a function, and registers it as a live sensor macro.
		
		Sensors return an object signifying whether to display the
		attached hook, and whether to continue sensing.
		
		The returned object has:
			{Boolean} value Whether to display or not
			{Boolean} done Whether to stop sensing.
	*/
	function addSensor(name, fn) {
		fn.sensor = true;
		Macros.add(name,
			"sensor",
			deferred(fn)
		);
		// Return the function to enable "bubble chaining".
		return addSensor;
	}
	
	/*
		Takes a function, and registers it as a live Changer macro.
		
		Changers return a transformation function that is used to mutate
		a ChangerDescriptor object.
		
		A ChangerDescriptor is a plain object with the following values:
					
		{String} transition      Which transition to use.
		{Number} transitionTime  The duration of the transition, in ms.
		{String} code            Transformations made on the hook's code before it is run.
		{jQuery} target          Where to render the code, if not the hookElement.
		{String} append          Which jQuery method to append the code to the dest with.
	*/
	function addChanger(name, fn) {
		Macros.add(name,
			"changer",
			eager(fn)
		);
		// Return the function to enable "bubble chaining".
		return addChanger;
	}
	
	/*
		One problem is that doExpressions() has no easy way of determining
		if a function it acquired by evaluating an expression is a changer function - unlike
		for sensor functions, which aren't wrapped in this manner.
		
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
	
	addValue
		// set(), run()
		/*
			TODO: At present, all of the work in this macro is done
			within JavaScript's = operator in the act of evaluating the
			expression. Hmm.
		*/
		(["set", "run"], function set() {
			return "";
		})

		// print()
		("print", function print(_, expr) {
			return expr+"";
		})
		
		/*
			The if() macro family currently determines else() and elseif()
			by remembering the previous if() result. By "remembering", I
			mean it puts a fresh expando property, "lastIf", on the section's
			expression stack.
		*/
		("if", function _if(section, expr) {
			/*
				This and unless() set the lastIf expando
				property. Whatever was there last is no longer
				relevant, just as consecutive if()s have no
				bearing on one another.
			*/
			return !!(section.stack[0].lastIf = !!expr);
		})
		
		/*
			unless: only true if its expression is false.
		*/
		("unless", function unless(section, expr) {
			return !(section.stack[0].lastIf = !!expr);
		})
		
		/*
			elseif: only true if the previous if() was false,
			and its own expression is true.
		*/
		("elseif", function elseif(section, expr) {
			/*
				This and else() check the lastIf expando
				property, if present.
			*/
			return (!section.stack[0].lastIf && (section.stack[0].lastIf = !!expr));
		})
		
		/*
			else: only true if the previous if() was false.
		*/
		("else", function _else(section) {
			return !section.stack[0].lastIf;
		})
	
		// display()
		("display", function display(section, name) {
			try {
				
				/*
					Test for the existence of the named passage in the story.
				*/
				if (!Story.passageNamed(name)) {
					return errorElement('Can\'t display passage "' + name + '"');
				}
				
				/*
					Make a much-needed check that this display() isn't being
					recursively called without end. A limit of 5 recursions is set.
				*/
				if (section.stack.reduce(function(count,e) {
					return count + ((e.display && e.display.indexOf(name) >-1) || 0);
				},0) >= 25) {
					return errorElement('Display loop: ' + name + ' is displaying itself 25+ times.');
				}
				
				/*
					In order to make the above check work, of course,
					each call to display() must set a property on the expression
					stack of the section. So, we do it now:
				*/
				section.stack[0].display = (section.stack[0].display || []).concat(name);

				/*
					Having concluded those checks, 
				*/
				return (Story.passageNamed(name).html());
			} catch (e) {
				return errorElement(e.message);
			}
		});
	
	
	addChanger
		// transition()
		(["transition","t8n"], function transition(section, name, time) {
			return changerFn(function(d) {
				d.transition = name;
				d.transitionTime = time;
			});
		})

		// nobr()
		// Remove line breaks from the hook.
		// Manual line breaks can be inserted with <br>.
		("nobr", function nobr() {
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
		("style", function style() {
			return changerFn(function(d) {
				var selector = 'style#macro';
				if (!$(selector).length) {
					$(document.head).append($('<style id="macro">'));
				}
				$(selector).text(Utils.unescape(d.code));
				d.code = "";
			});
		});
	
	/*
		Standard sensor macros.
	*/
	addSensor
		// when()
		("when", function(_, expr) {
			return {
				value: expr,
				done: expr
			};
		})
		
		// until()
		("until", function(_, expr) {
			return {
				value: !expr,
				done: expr
			};
		})
		
		// whenever()
		("whenever", function(_, expr) {
			return {
				value: expr,
				done: false
			};
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
		"prepend",
		// remove()
		// Removes the scope(s).
		"remove"
	];
	
	revisionTypes.forEach(function(e) {
		addChanger(e, function(section, scope) {
			return changerFn(function(desc) {
				if (e === "remove") {
					desc.code = "";
					return;
				}
				desc.append = e;
				desc.target = scope;
			});
		});
	});
	
	// TODO: script()

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
	/*function newEnchantmentMacroFn(innerFn, enchantDesc) {

		// Enchantment macro? Register the enchantment's event.
		if (enchantDesc && enchantDesc.event && enchantDesc.classList) {
			// Set the event that the enchantment descriptor declares
			Macros.registerEnchantmentEvent(enchantDesc.event,
				Utils.classListToSelector(enchantDesc.classList));
		}
		return function enchantmentMacroFn(selectors /* variadic *) {
			selectors = Array.from(arguments);
			
			/*
				This hook-augmenter function transforms Hook nodes into Enchanters,
				which are hooks that "enchant" a scope.
				
				Note: some enchantments (like replace()) are executed immediately,
				and thus instantly dispel their enchantment.
				
				The scope is specified by the selectors passed to the macro.
			*
			return function makeEnchanter(hook, section) {
				var scope = section.HookArray(selectors),
					code = hook.attr('code'),
					enchantData;
				hook.removeAttr("code");

				/*
					An Enchanter's event function either executes innerFn on the hook,
					or (by default) renders the hook's code into the hook.
					
					For enchanter hooks, this function runs when the enchantment's event
					(e.g. clicking for click(), time for timed___()) is triggered.
					Otherwise...
				*
				function eventFn() {
					var rerender = enchantDesc && enchantDesc.rerender;
					
					if (innerFn && typeof innerFn === "function") {
						//TODO: make this signature less messy
						innerFn(code, hook, section, scope);
					} else {
						// Default behaviour: simply parse the inner contents.
						if (!rerender || rerender === "replace") {
							Utils.transitionOut(hook.children(), "fade-in");
						}
						/*
							Transition the resulting Twine code into the expression's element.
						*
						renderInto(code + '', hook, section, rerender === "prepend");
					}
				}
				/*
					...it runs immediately.
				*
				if (!enchantDesc) {
					eventFn();
					return;
				}
				/*
					Enchanters differ from normal hooks in that they have the
					"enchanter" attribute, and they have enchantment jQuery data, which
					is an object holding the macro's enchantment descriptor,
					the eventFn, and the section, plus some tiny methods.
				*
				enchantData = {
					fn: eventFn,
					enchantDesc: enchantDesc,
					scope: scope,
					section: section,
					/*
						Enchants the scope, applying the macro's enchantment's classes
						to the matched elements.
					*
					enchantScope: function () {
						if (this.scope && this.enchantDesc) {
							this.scope = this.scope.map(HookUtils.wrapPseudoHook);
							this.scope.forEach(function(e) {
								if (e.length > 0) {
									e = e.wrapAll("<tw-pseudo-hook>").parent();
								}
								e.addClass(this.enchantDesc.classList);
							}
						}
					},
					/*
						Refresh the scope to reflect the current passage DOM state.
						Necessary if the scope selector is a WordArray or jQuery selector,
						or if a hook was removed or inserted for some other reason.
						
						@method refreshScope
					*
					refreshScope: function () {
						this.scope = this.scope.map(HookUtils.unwrapPseudoHook);
						this.scope.forEach(function(e) {
							e.removeClass(this.enchantDesc.classList);
						});
						this.scope = section.HookArray(selectors);
						this.enchantScope();
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
*/

	
	/*
		Combos
	*/
	
	/*revisionTypes.forEach(function(revisionType) {
		interactionTypes.forEach(function(interactionType) {
			// Enchantment macros
			Macros.add(interactionType.name + "-" + revisionType,
				newEnchantmentMacroFn(function (code, hook, section, scope) {
					scope[revisionType](section.render.bind(section, code));
					section.updateEnchantments();
				},
				interactionType.enchantDesc)
			);
		});
	});*/
	
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
					/*
						Of course, the mandatory first argument of all macro
						functions is section, so we have to convert the above
						to use a contract that's amenable to this requirement.
					*/
					addValue(key, function() {
						/*
							As none of the above actually need or use section,
							we can safely discard it.
							
							Aside: in ES6 this function would be:
							(section, ...rest) => this[key](...rest)
						*/
						return this[key].apply(0, Array.from(arguments).slice(1));
					}.bind(this));
				}
			}.bind(this));
		}
	}[""]());
	
	Utils.log("Macrolib module ready!");
});