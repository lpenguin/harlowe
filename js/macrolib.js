define(['jquery', 'twinemarkup', 'story', 'state', 'macros', 'engine', 'utils', 'changercommand', 'colour'],
function($, TwineMarkup, Story, State, Macros, Engine, Utils, ChangerCommand, Colour) {
	"use strict";
	/*
		Twine macro standard library.
		Modifies the Macros module only. Exports nothing.
	*/
	
	/*
		Basic Macros
	*/
	
	Macros.addValue
		/*
			(set:) Set Twine variables.
			Evaluates to nothing if no error occurred.
		*/
		("set", function set(_, ar) {
			var propertyChain;
			/*
				Reject the arguments if they're not an assignment
				request, or if it incorrectly uses the "into" operator
			*/
			if (!ar.assignmentRequest || ar.operator === "into") {
				return new SyntaxError("This isn't how you should use the (set:) macro.");
			}
			propertyChain = ar.dest.propertyChain;
			
			/*
				Now, perform the operation.
			*/
			ar.dest.set(ar.src);
			return "";
		})
		
		/*
			(put:) A left-to-right version of (set:) that requires the "into" operator.
			Evaluates to nothing if no error occured.
		*/
		("put", function put(_, ar) {
			var propertyChain;
			/*
				Reject the arguments if they're not an assignment
				request, or if it doesn't use the "into" operator
			*/
			if (!ar.assignmentRequest || ar.operator !== "into") {
				return new SyntaxError("Please say 'into' when using the (put:) macro.");
			}
			propertyChain = ar.dest.propertyChain;
			/*
				Now, perform the operation.
			*/
			ar.dest.set(ar.src);
			return "";
		})
		
		/*
			(move:) A variant of (put:) that deletes the source's binding after
			performing the operation. Ideally used as an equivalent
			to Javascript's "x = arr.pop();"
		*/
		("move", function move(_, ar) {
			var get, error;
			if (!ar.assignmentRequest) {
				return new SyntaxError("This isn't how you use the 'move' macro.");
			}
			if (ar.src && ar.src.varref) {
				get = ar.src.get();
				if ((error = Utils.containsError(get))) {
					return error;
				}
				ar.dest.set(get);
				ar.src.delete();
			}
			else {
				/*
					Fallback behaviour: when phrased as
					(move: 2 into $red)
				*/
				ar.dest.set(ar.src);
			}
			return "";
		})

		/*
			(print:), (text:): convert the expression to text.
			This provides explicit coercion to String for TwineScript values.
			Evaluates to a text string.
		*/
		(["print", "text"], function print(_, expr) {
			return expr+"";
		})

		/*
			(num:), (number:)
			This provides explicit coercion to Number.
		*/
		(["num", "number"], function number(_, expr) {
			return +expr;
		})
		
		/*
			(if:) converts the expression to boolean, affecting subsequent
			else() and elseif() calls. Evaluates to a boolean.
		
			The (if:) macro family currently determines (else:) and (elseif:)
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
			(unless:) the negated form of if().
			Evaluates to a boolean.
		*/
		("unless", function unless(section, expr) {
			return !!(section.stack[0].lastIf = !expr);
		})
		
		/*
			(elseif:) only true if the previous if() was false,
			and its own expression is true.
			Evaluates to a boolean.
		*/
		("elseif", function elseif(section, expr) {
			/*
				This and else() check the lastIf expando
				property, if present.
			*/
			return (!section.stack[0].lastIf && (section.stack[0].lastIf = !!expr));
		})
		
		/*
			(else:) only true if the previous if() was false.
			Evaluates to a boolean.
		*/
		("else", function _else(section) {
			return !section.stack[0].lastIf;
		})
		
		/*
			(display:) evaluates to the TwineMarkup source of the passage
			with the given name.
			Evaluates to a DisplayCommand, an object which is by-and-large
			unusable as a stored value, but renders to the full TwineMarkup
			source of the given passage.
		*/
		("display", function display(_, name) {
			/*
				Test for the existence of the named passage in the story.
			*/
			if (!Story.passageNamed(name)) {
				return new ReferenceError(
					"I can't display the passage '"
					+ name
					+ "' because it doesn't exist."
				);
			}
			/*
				Create a DisplayCommand.
			*/
			return {
				TwineScript_ObjectName: "a (display:) command",
				toString: function() {
					// TODO: Reimplement the (display:) loop.
					return Story.passageNamed(name).html();
				}
			};
		})
		/*
			(remove:) Removes the given hook or pseudo-hook from the section.
			It accepts a standard selector, does a side-effect, and returns "".
		*/
		("remove", function remove(section, selector) {
			section.selectHook(selector).forEach(function(e) { e.remove(); });
			return "";
		});
	
	/*
		TODO: Maybe it would be better, or at least more functional, if
		ChangerCommands returned a fresh ChangerDescriptor instead of permuting
		the passed-in one.
	*/
	Macros.addChanger
		// (transition:)
		// Apply a CSS transition to a hook as it is inserted.
		(["transition", "t8n"],
			function transition(_, name, time) {
				return Macros.ChangerCommand("transition", name, time);
			},
			function(d, name, time) {
				d.transition     = name;
				d.transitionTime = time;
				return d;
			}
		)
		
		// (font:)
		// A shortcut for applying a font to a span of text.
		("font",
			function font(_, family) {
				return Macros.ChangerCommand("font", family);
			},
			function(d, family) {
				d.code = "<span style='font-family:" + family + "'>" + d.code + "</span>";
				return d;
			}
		)
		
		/*
			(text-colour:)
			A shortcut for applying a colour to a span of text.
			The (colour:) alias is one I feel a smidge less comfortable with. It
			should easily also refer to a value macro that coerces string to colour...
			But, I suppose this is the more well-trod use-case for this keyword.
		*/
		(["text-colour", "text-color", "color", "colour"],
			function textcolour(_, CSScolour) {
				/*
					Convert TwineScript CSS colours to bad old hexadecimal.
					This is important as it enables the ChangerCommand to be serialised
					as a string more easily.
				*/
				if (CSScolour && CSScolour.colour) {
					CSScolour = CSScolour.toHexString(CSScolour);
				}
				return Macros.ChangerCommand("text-colour", CSScolour);
			},
			function (d, CSScolour) {
				d.code = "<span style='color:" + CSScolour + "'>" + d.code + "</span>";
				return d;
			}
		)
		/*
			(background:)
			This sets the changer's background-color or background-image,
			depending on what is supplied.
		*/
		("background",
			function backgroundcolour(_, value) {
				//Convert TwineScript CSS colours to bad old hexadecimal.
				if (value && value.colour) {
					value = value.toHexString(value);
				}
				return Macros.ChangerCommand("background", value);
			},
			function (d, value) {
				var property;
				/*
					Different kinds of values can be supplied to this macro
				*/
				if (Colour.isHexString(value)) {
					property = "background-color";
				}
				else {
					/*
						When Harlowe can handle base64 image passages,
						this will invariably have to be re-worked.
					*/
					property = "background-image";
					value = "url(" + value + ")";
				}
				d.code = "<span style='" + property + ":" + value + "'>" + d.code + "</span>";
				return d;
			}
		)
		
		/*
			(nobr:)
			Remove line breaks from the hook.
			Manual line breaks can be inserted with <br>.
		*/
		("nobr",
			function nobr() {
				return Macros.ChangerCommand("nobr");
			},
			function(d) {
				// To prevent keywords from being created by concatenating lines,
				// replace the line breaks with a zero-width space.
				d.code = d.code.replace(/\n/g, "&zwnj;");
				return d;
			}
		)

		/*
			(CSS:)
			Insert the enclosed raw CSS into a <style> tag that exists for the
			duration of the current passage only.
			contents: raw CSS.
		*/
		("CSS",
			function CSS() {
				return Macros.ChangerCommand("CSS");
			},
			function style(d) {
				var selector = 'style#macro';
				if (!$(selector).length) {
					$(document.head).append($('<style id="macro">'));
				}
				$(selector).text(Utils.unescape(d.code));
				d.code = "";
				return d;
			}
		)
		
		/*
			(text-style:)
		*/
		("text-style",
			function textstyle(_, styleName) {
				return Macros.ChangerCommand("text-style", styleName);
			},
			(function() {
				/*
					This is a closure in which to cache the style-tagname mappings.
					
					These map style names, as input by the author as this macro's first argument,
					to HTML element tag names to wrap them with.
				*/
				var styleTagNames = Object.assign(Object.create(null), {
						bold:         "b",
						italic:       "i",
						underline:    "u",
						strike:       "s",
						superscript:  "sup",
						subscript:    "sub",
						blink:        "blink",
						mark:         "mark",
						delete:       "del",
					},
					/*
						These are the Twine extra styles.
					*/
					["outline", "shadow", "emboss", "condense", "expand", "blur", "blurrier",
						"smear", "mirror", "upside-down", "fade-in-out", "rumble", "shudder"]
						.reduce(function(obj, e) {
							obj[Utils.insensitiveName(e)] = "tw-" + e;
							return obj;
						}, {})
					);
				
				return function text_style(d, styleName) {
					var
						/*
							A pair of HTML strings to wrap the hook in. 
						*/
						wrapperHTML = ['', ''];
					
					/*
						The name should be insensitive to normalise both capitalisation,
						and hyphenation of names like "upside-down".
					*/
					styleName = Utils.insensitiveName(styleName);
					
					if (styleName in styleTagNames) {
						/*
							This is a bit of a hack to split the return value of
							wrapHTMLTag into an array of just the wrapper components.
						*/
						wrapperHTML = Utils.wrapHTMLTag("_", styleTagNames[styleName]).split("_");
					}
					d.code = wrapperHTML.join(d.code);
					return d;
				};
			}())
		);
	
	/*
		Standard sensor macros.
	*/
	Macros.addSensor
		/*
			(when:)
			Triggers once when the expression is true.
		*/
		("when", function(_, expr) {
			return {
				value: expr,
				done: expr
			};
		})
		
		/*
			(until:)
			Triggers once when the expression is false.
		*/
		("until", function(_, expr) {
			return {
				value: !expr,
				done: expr
			};
		})
		
		/*
			(whenever:)
			Triggers any time the expression changes from false to true.
		*/
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
		"prepend"
	];
	
	revisionTypes.forEach(function(e) {
		Macros.addChanger(e,
			function(_, scope) {
				return Macros.ChangerCommand(e, scope);
			},
			function(desc, scope) {
				desc.target = scope;
				desc.append = e;
				return desc;
			}
		);
	});
	
	/*
		This large routine generates functions for enchantment macros, to be applied to
		Macros.addChanger().
		
		An "enchantment" is a process by which selected hooks in a passage are
		automatically wrapped in <tw-enchantment> elements that have certain styling classes,
		and can trigger the rendering of the attached TwineMarkup code when they experience
		an event.
		
		In short, it allows various words to become links etc., and do something when
		they are clicked, just by deploying a single macro instantiation! Just type 
		"click("house")[...]", and every instance of "house" in the section becomes
		a link that does something.
		
		The enchantDesc object is a purely internal structure which describes the
		enchantment. It contains the following:
		
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
		@return {Function[]}             A pair of functions.
	*/
	function newEnchantmentMacroFn(enchantDesc, name) {
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
			Return the macro function AND the ChangerCommand function.
			Note that the macro function's "selector" argument
			is that which the author passes to it when invoking the
			macro (in the case of "(macro: ?1)", selector will be "?1").
		*/
		return [
			function enchantmentMacroFn(_, selector, target) {
				/*
					If the selector is a HookRef (which it usually is), we must unwrap it
					and extract its plain selector string, as this ChangerCommand
					could be used far from the hooks that this HookRef selects,
					and we'll need to re-run the desc's section's selectHook() anyway.
				*/
				if ("selector" in selector) {
					selector = selector.selector;
				}
				return Macros.ChangerCommand(name, selector, target);
			},
			/*
				This ChangerCommand registers a new enchantment on the Section that the
				ChangerDescriptor belongs to.
				
				It must perform the following tasks:
				1. Silence the passed-in ChangerDescriptor.
				2. Call Section.selectHook() to find which hooks are
				selected by the given selector.
				3. Set up the <tw-enchantment> elements around the hooks.
				4. Affix an enchantment event function (that is, a function to run
				when the enchantment's event is triggered) to the <tw-enchantment> elements.
				5. Provide an API for refreshing/resetting the enchantment's
				<tw-enchantment> elements to the Section (usually performing steps
				2-4 again).
				
				You may notice most of these are side-effects to a changer function's
				proper task of altering a ChangerDescriptor. Alas... it is something of
				a #kludge that it piggybacks off the changer macro concept.
			*/
			function makeEnchanter(desc, selector, target) {
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
						additional argument to the macro (e.g. (click-replace: ?1, ?2) )
						or, if absent, the enchantment selector.
						
						TODO: Need a way to target just the triggering enchantment.
					*/
					desc.target = target || selector;
					desc.append = enchantDesc.rerender;
				}
				
				/*
					This enchantData object is stored in the descriptor's Section's enchantments
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
						scope = desc.section.selectHook(selector);
						
						/*
							In the unlikely event that no scope could be created, call it quits.
							Q: should it make a fuss?
						*/
						if (!scope) {
							return;
						}
						/*
							Reset the enchantments store, to prepare for the insertion of
							a fresh set of <tw-enchantment>s.
						*/
						enchantments = $();
						
						/*
							Now, enchant each selected word or hook within the scope.
						*/
						scope.forEach(function(e) {
							var wrapping;
							
							/*
								Create a fresh <tw-enchantment>, and wrap the elements in it.
							*/
							e.wrapAll("<tw-enchantment class='"
								+ enchantDesc.classList +"'>");
							/*
								It's a little odd that the generated wrapper must be retrieved in
								this roundabout fashion, but oh well. That's how jQuery works.
							*/
							wrapping = e.parent();
							
							/*
								Store the wrapping in the Section's enchantments list.
							*/
							enchantments = enchantments.add(wrapping);
							/*
								Affix to it an event function, to run when it experiences the
								enchantment event.
								
								Alas, this is a #kludge to allow the jQuery event handler
								function above to access this inner data (as in, call this.event).
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
										index = desc.section.enchantments.indexOf(enchantData);
										desc.section.enchantments.splice(index,1);
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
									desc.section.renderInto(code + '', null, desc);
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
						enchantments.each(function() {
							$(this).children().unwrap();
						});
					}
				};
				/*
					Add the above object to the section's enchantments.
				*/
				desc.section.enchantments.push(enchantData);
				/*
					Enchant the scope for the first time.
				*/
				enchantData.enchantScope();
				return desc;
			}
		];
	}
	
	var interactionTypes = [
		// (click:)
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
		// (mouseover:)
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
		// (mouseout:)
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
	
	//TODO: (hover:)
	
	interactionTypes.forEach(function(e) {
		Macros.addChanger.apply(0, [e.name].concat(newEnchantmentMacroFn(e.enchantDesc, e.name)));
	});

	
	/*
		Combos
	*/
	revisionTypes.forEach(function(revisionType) {
		interactionTypes.forEach(function(interactionType) {
			var enchantDesc = Object.assign({}, interactionType.enchantDesc, {
					rerender: revisionType
				}),
				name = interactionType.name + "-" + revisionType;
			Macros.addChanger.apply(0, [name].concat(newEnchantmentMacroFn(enchantDesc, name)));
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
	
	/*
		Choose one argument, up to 16. Can be used as such: (either: "pantry", "larder", "cupboard" )
	*/
	function either() {
		return arguments[~~(Math.random() * arguments.length)];
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

		/*
			A random integer function
			1 argument: random int from 0 to a inclusive
			2 arguments: random int from a to b inclusive (order irrelevant)
			Identical to Twine 1's version.
		*/
		random: function random(a, b) {
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
		
		either: either,
		
		/*
			Array/Sequence macros
		*/
		
		/*
			(a:), (array:)
			Used for creating Array literals.
			TODO: Make it "concat-spread" arrays passed into it??
		*/
		a: Array.of,
		array: Array.of,
		
		/*
			(any-of:)
			Similar to (either:), but flattens arrays to retrieve a random value.
			(either:) originally implicitly did this in Twine 1, but now it's 
			more explicit, to enable better-sounding expressions,
			like (print: (any-of: $bag))
		*/
		anyof: function any_of() {
			if(arguments.length === 1) {
				if (Array.isArray(arguments[0])) {
					return either.apply(this, arguments[0]);
				}
				return arguments[0];
			}
			return any_of(either.apply(this, arguments));
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
		previous: function previous() {
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
					Macros.addValue(key, function(/* variadic */) {
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