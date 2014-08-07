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
		See that page for the formal explanation. These two functions, eager and deferred,
		convert regular Javascript functions to accept a such a thunk as its sole argument.
		
		Non-live macros ("eager" macros) don't actually need the thunk - they take it,
		unwrap it, and discard it. Live macros, however, need to retain
		it and re-evaluate it over and over.
		
		These should currently (August 2014) only be called by addChanger and addValue.
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
		
		Again, this should currently (August 2014) only be called by addSensor.
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
				This and unless() both set the lastIf expando
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
	
	/*
		TODO: Maybe it would be better, or at least more functional, if
		changerFns returned a fresh ChangerDescriptor instead of permuting
		the passed-in one.
	*/
	addChanger
		// transition()
		(["transition","t8n"], function transition(_, name, time) {
			return changerFn(function(d) {
				d.transition = name;
				d.transitionTime = time;
			});
		})

		// nobr()
		// Remove line breaks from the hook.
		// Manual line breaks can be inserted with <br>.
		("nobr", function nobr() {
			return changerFn(function(_, d) {
				// To prevent keywords from being created by concatenating lines,
				// replace the line breaks with a zero-width space.
				d.code = d.code.replace(/\n/g, "&zwnj;");
			});
		})

		// style()
		// Insert the enclosed raw CSS into a <style> tag that exists for the
		// duration of the current passage only.
		// contents: raw CSS.
		("style", function style() {
			return changerFn(function(_, d) {
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
		Generates a function for enchantment macros, to ideally be used as the second
		argument to addChanger().
		
		An "enchantment" is a process by which selected hooks in a passage are
		automatically wrapped in <tw-enchantment> elements that have certain styling classes,
		and can trigger the rendering of the attached TwineMarkup code when they experience
		an event.
		
		In short, it allows various words to become links etc., and do something when
		they are clicked, just by deploying a single macro instantiation! Just type 
		"click("house")[...]", and every instance of "house" in the section becomes
		a link that does something.
		
		The enchantDesc object describes the enchantment. It contains the following:
		
		* {String} event The DOM event that triggers the rendering of this macro's contents.
		* {String} classList The list of classes to 'enchant' the hook with, to denote that it 
		is ready for the player to trigger an event on it.
		* {String} rerender Determines whether to clear the span before rendering into it ("replace"),
		append the rendering to its current contents ("append") or prepend it ("prepend").
		Only used for "combos", like click-replace().
		* {Boolean} once Whether or not the enchanted DOM elements can trigger this macro
		multiple times.
		
		@method newEnchantmentMacroFn
		@param  {Function} innerFn       The function to perform on the macro's hooks
		@param  {Object}  [enchantDesc]  An enchantment description object, or null.
		@return {Function}               An enchantment macro function.
	*/
	function newEnchantmentMacroFn(enchantDesc) {
		// enchantDesc is a mandatory argument.
		Utils.assert(enchantDesc);
		
		/*
			Register the event that this enchantment responds to
			in a jQuery handler.
			
			Sadly, since there's no permitted way to attach a jQuery handler
			directly to the triggering element, the "actual" handler
			is "attached" via a jQuery .data() key, and must be called
			from this <html> handler.
		*/
		$(document.documentElement).on(
			/*
				Put this event in the "enchantment" jQuery event
				namespace, solely for personal tidiness.
			*/
			enchantDesc.event + ".enchantment",
			Utils.classListToSelector(enchantDesc.classList),
			function generalEnchantmentEvent() {
				var enchantment = $(this),
					/*
						Run the actual event handler.
					*/
					event = enchantment.data('enchantmentEvent');
				
				if (event) {
					event(enchantment);
				}
			}
		);
		
		/*
			Return the macro function. Note that its "selector" argument
			is that which the author passes to it when invoking the
			macro (in the case of "macro(?1)", selector will be "?1").
		*/
		return function enchantmentMacroFn(section, selector, target) {
			/*
				This changer function registers a new enchantment
				in the passed-in Section.
				
				It must perform the following tasks:
				1. Silence the passed-in ChangerDescriptor.
				2. Call Section.selectHook() to find which hooks are
				selected by the given selector.
				3. Set up the <tw-enchantment> elements around the hooks.
				4. Affix an enchantment event function (that is, a function to run
				when the enchantment's event is trigggere) to the <tw-enchantment> elements.
				5. Provide an API for refreshing/resetting the enchantment's
				<tw-enchantment> elements to the Section (usually performing steps
				2-4 again).
				
				You may notice most of these are side-effects to a changer function's
				proper task of altering a ChangerDescriptor. Alas... it is something of
				a #kludge that it piggybacks off the changer macro concept.
			*/
			return changerFn(function makeEnchanter(desc) {
				var enchantData,
					/*
						The scope is shared with both enchantData methods:
						refreshScope removes the <tw-enchantment> elements
						set on the scope, and enchantScope creates an updated
						scope to enchant.
					*/
					scope,
					/*
						A store for the <tw-enchantment> wrappers created
						by enchantScope. Used by the enchantment's event function.
						
						This is a case of a jQuery object being used as a
						data structure rather than as a query result set.
						Search function calls for DOM elements 'contained' in
						these enchantments is more succinct using jQuery
						than using a plain Array or Set.
					*/
					enchantments = $(),
					code = desc.code;
				
				/*
					Prevent the target from being run normally. 
					(This idiom is #awkward...)
				*/
				delete desc.code;
				
				/*
					If a rerender method was specified, then this is a "combo" macro,
					which will render its hook's code into a separate target.
					
					Let's modify the descriptor to use that target and render method.
					(Yes, the name "rerender" is #awkward.)
				*/
				if (enchantDesc.rerender) {
					/*
						The target can either be a separate selector passed as an
						additional argument to the macro (e.g. click-replace(?1, ?2) )
						or, if absent, the enchantment selector.
						
						TODO: Need a way to target just the triggering enchantment.
					*/
					desc.target = target || selector;
					desc.append = enchantDesc.rerender;
				}
				
				/*
					This enchantData object is stored in the Section's enchantments
					list, to allow the Section to easily enchant and re-enchant this
					scope whenever its DOM is altered (e.g. words matching this enchantment's
					selector are added or removed from the DOM).
				*/
				enchantData = {
				
					/*
						This method enchants the scope, applying the macro's enchantment's
						classes to the matched elements.
					*/
					enchantScope: function () {
						/*
							Create the scope, which is a HookSet or PseudoHookSet
							depending on the selector.
						*/
						scope = section.selectHook(selector);
						
						/*
							In the unlikely event that no scope could be
							created, call it quits.
							Q: should it make a fuss?
						*/
						if (!scope) {
							return;
						}
						
						/*
							Reset the enchantments store, to prepare for the
							insertion of a fresh set of <tw-enchantment>s.
						*/
						enchantments = $();
						
						/*
							Now, enchant each selected word 
							or hook within the scope.
						*/
						scope.forEach(function(e) {
							var wrapping;
							
							/*
								Create a fresh <tw-enchantment>,
								and wrap the elements in it.
							*/
							e.wrapAll("<tw-enchantment class='"
								+ enchantDesc.classList +"'>");
							/*
								It's a little odd that the generated wrapper
								must be retrieved in this roundabout fashion,
								but oh well. That's how jQuery works.
							*/
							wrapping = e.parent();
							
							/*
								Store the wrapping in the Section's
								enchantments list.
							*/
							enchantments = enchantments.add(wrapping);
							/*
								Affix to it an event function, to run when
								it experiences the enchantment event.
								
								Alas, this is a #kludge to allow the
								jQuery event handler function above
								to access this inner data (as in, call
								this.event).
							*/
							e.parent().data('enchantmentEvent', 
								function specificEnchantmentEvent() {
									var index;
									if (enchantDesc.once) {
										/*
											Remove this enchantment from the Section's list.
											This must be done now, so that renderInto(), when
											it calls updateEnchantments(), will not re-enchant
											the scope using this very enchantment.
										*/
										index = section.enchantments.indexOf(enchantData);
										section.enchantments.splice(index,1);
										/*
											Of course, the <tw-enchantment>s
											must also be removed.
										*/
										enchantData.refreshScope();
									}
									/*
										At last, the target originally specified
										by the ChangerDescriptor can now be filled with the
										ChangerDescriptor's original code.
										
										By passing the desc as the third argument,
										all its values are assigned, not just the target.
										The second argument may be extraneous. #awkward
									*/
									section.renderInto(code + '', null, desc);
								}
							);
						});
					},
					/*
						This method refreshes the scope to reflect the current passage DOM state.
					*/
					refreshScope: function () {
						/*
							Clear all existing <tw-enchantment> wrapper elements placed by
							the previous call to enchantScope().
						*/
						scope.forEach(function(e) {
							if (e.parent()[0].tagName.toLowerCase() === "tw-enchantment") {
								e.unwrap();
							}
						});
					}
				};
				/*
					Add the above object to the section's enchantments.
				*/
				section.enchantments.push(enchantData);
				/*
					Enchant the scope for the first time.
				*/
				enchantData.enchantScope();
			});
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
				rerender: "",
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
				rerender: "",
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
				rerender: "",
				classList: "enchantment-mouseout"
			}
		}];
	
	//TODO: hover()
	
	interactionTypes.forEach(function(e) {
		addChanger(e.name, newEnchantmentMacroFn(e.enchantDesc));
	});

	
	/*
		Combos
	*/
	
	revisionTypes.forEach(function(revisionType) {
		interactionTypes.forEach(function(interactionType) {
			var enchantDesc = Object.assign({}, interactionType.enchantDesc, {
					rerender: revisionType
				});
			addChanger(
				interactionType.name + "-" + revisionType,
				newEnchantmentMacroFn(enchantDesc)
			);
		});
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
					/*
						Of course, the mandatory first argument of all macro
						functions is section, so we have to convert the above
						to use a contract that's amenable to this requirement.
					*/
					addValue(key, function(/* variadic */) {
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