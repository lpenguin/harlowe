define(['jquery', 'utils', 'selectors', 'renderer', 'twinescript/environ', 'story', 'state', 'hookutils',
'datatypes/hookset', 'internaltypes/pseudohookset', 'internaltypes/changedescriptor'],
function($, Utils, Selectors, Renderer, Environ, Story, State, HookUtils, HookSet, PseudoHookSet, ChangeDescriptor) {
	"use strict";

	var Section;

	/**
		Section objects represent a block of Twine prose rendered into the DOM.
		It contains its own DOM, a reference to any enclosing Section,
		and methods and properties related to invoking TwineScript code within it.
		
		The big deal of having multiple Section objects (and the name Section itself
		as compared to "passage" or "screen") is that multiple simultaneous passages'
		(such as (display:)ed passages, or stretchtext mode) code should be
		hygenically scoped. Hook references in one passage cannot affect another,
		and so forth.
		
		@class Section
		@static
	*/
	
	/**
		This is a shortcut for rendering errors that either popped up while evaluating
		expressions, or via performing extra checks as a result.
		
		@method renderError
		@private
		@param {Error} error
		@param {jQuery} target
	*/
	function renderError(error, target) {
		/*
			Warning messages are special: they are only displayed in debug mode.
		*/
		if (error.name === "TwineWarning" && !Story.options.debug) {
			return;
		}
		target.replaceWith("<tw-error class='"
			+ ((error.name === "TwineWarning") ? "warning" : "error")
			+ "' title='" + target.attr('title') + "'>" + error.message + "</tw-error>");
	}
	
	/**
		Run a newly rendered <tw-link> element.
		
		@method runLink
		@private
		@param {jQuery} link The <tw-link> element to run.
	*/
	function runLink(link) {
		var passage = this.evaluateTwineMarkup(Utils.unescape(link.attr("passage-expr"))),
			text = link.text(),
			visited = -1;
		
		/*
			If a <tw-error> was returned by evaluateTwineMarkup, replace the link with it.
		*/
		if (passage instanceof $) {
			link.replaceWith(passage);
			return;
		}
		if (Story.passageNamed(passage)) {
			visited = (State.passageNameVisited(passage));
		} else {
			// Not an internal link?
			if (!~visited) {
				link.replaceWith(
					'<tw-broken-link passage-id="' + passage + '">'
					+ (text || passage)
					+ '</tw-broken-link>'
				);
			}
		}
		link.removeAttr("passage-expr").attr("passage-id", Story.getPassageID(passage));
		if (Story.options.debug) {
			link.attr("passage-name", passage);
		}
		if (visited) {
			link.addClass("visited");
		}
		if (Story.options.opaquelinks) {
			link.attr("title",passage);
		}
	}
	
	/**
		Run a newly rendered <tw-expression> element's code, obtain the resulting value,
		and apply it to the next <tw-hook> element, if present.
		
		@method runExpression
		@private
		@param {jQuery} expr The expression to run.
	*/
	function runExpression(expr) {
		/*
			Become cognizant of any hook connected to this expression.
		*/
		var nextHook = expr.next("tw-hook"),
			/*
				Execute the expression.
			*/
			result = this.eval(Utils.unescape(expr.popAttr('js') || ''));
		
		/*
			If result is a ChangerCommand, please run it.
		*/
		if (result && result.changer) {
			if (!nextHook.length) {
				renderError(new TypeError(
					"The (" + result.macroName + ":) macro should be assigned to a variable or attached to a hook."
				), expr);
			}
			else {
				this.renderInto(
					/*
						The use of popAttr prevents the hook from executing normally
						if it wasn't actually the eventual target of the changer function.
					*/
					nextHook.popAttr('code'),
					/*
						Don't forget: nextHook may actually be empty.
						This is acceptable - the result changer could alter the
						target appropriately.
					*/
					nextHook,
					result
				);
			}
		}	
		/*
			The result can be any of these values, and
			should be put to use in the following ways:
			
			falsy primitive:
				Remove the nearest hook.
			HookSet:
				Print the text of the first hook in the set.
			stringy primitive:
				Print into the passage.
			function with .changer property:
				Assume this was returned by a changer macro.
				Call runChangerFunction with it and the nearest hook
				as arguments.
			function:
				Run it, passing the nearest hook and innerInstance.
		*/
		else if (typeof result === "function") {
			if (result.sensor) {
				/*
					Sensors, unlike changers, require a hook to be present - hence the
					word "must" instead of "should".
				*/
				if (!nextHook.length) {
					renderError(new TypeError(
						"The (" + result.macroName + ":) macro must be attached to a hook."
					), expr);
				}
				else {
					runSensorFunction.call(this, result, nextHook);
				}
			}
			else {
				result(nextHook, this);
			}
		}
		/*
			Print any error that resulted.
			This must of course run after the sensor/changer function was run,
			in case that provided an error.
		*/
		else if (Utils.containsError(result)) {
			renderError(result, expr);
		}
		/*
			If the expression had a TwineScript_Print method, do that.
		*/
		else if (result && result.TwineScript_Print) {
			/*
				TwineScript_Print() typically emits side-effects. These
				will occur... now.
			*/
			result = result.TwineScript_Print();
			
			/*
				On rare occasions (specifically, when the passage component
				of the link syntax produces an error) TwineScript_Print
				returns a jQuery of the <tw-error>.
			*/
			if (result instanceof $) {
				expr.append(result);
			}
			/*
				Alternatively (and more commonly), TwineScript_Print() can
				return an Error object.
			*/
			else if (Utils.containsError(result)) {
				renderError(result, expr);
			}
			else {
				this.renderInto(result, expr);
			}
		}
		/*
			This prints an object if it's a string, number, or has a custom toString method
			and isn't a function.
		*/
		else if (typeof result === "string"  || typeof result === "number"
			|| (typeof result === "object" && result && result.toString !== ({}).toString)) {
			/*
				Transition the resulting Twine code into the expression's element.
			*/
			this.renderInto(result + '', expr);
		}
		/*
			And finally, the falsy primitive case.
			This is special: as it prevents hooks from being run, an (else:)
			that follows this will return true.
		*/
		else if   (result === false
				|| result === null
				|| result === undefined) {
			nextHook.removeAttr('code');
			expr.addClass("false");
			if (nextHook.length) {
				this.stack[0].lastHookShown = false;
				return;
			}
		}
		/*
			The (else:) and (elseif:) macros require a little bit of state to be
			saved after every hook interaction: whether or not the preceding hook
			was shown or hidden by the attached expression.
			Sadly, we must oblige with this overweening demand.
		*/
		if (nextHook.length) {
			this.stack[0].lastHookShown = true;
		}
	}
	
	/**
		A sensor function is a function returned from a <tw-expression> evaluation
		that represents a sensor: an expression whose value is watched.
		
		An example of a simple sensor is
			when(time > 2s)
		We must check whether the expression is true on every frame, from now until
		the passage is left.
		
		This is exclusively called by runExpression().
		
		@method runSensorFunction
		@private
		@param {Function} sensor The sensor function. 
		@param {jQuery} target The <tw-hook> that the sensor is connected to.
	*/
	function runSensorFunction(sensor, target) {
		/*
			Remember the code of the target hook
			that will be run if the sensor triggers.
			
			(We also remove (pop) the code from the hook
			so that doExpressions() doesn't render it.)
		*/
		var code = target.popAttr('code') || "",
			/*
				This stores the current state of the target
				hook - whether its code is rendered, or removed.
			*/
			on,
			recursiveSensing;
		
		/*
			This closure runs every frame from now on, until 
			the target hook is gone.
			
			Notice that as this is bound, giving it a name isn't
			all that useful.
		*/
		recursiveSensing = (function() {
			/*
				Check if the sensor has triggered.
			*/
			var result = sensor();
			
			/*
				If an error resulted (which may occur if re-evaluating the
				sensor's condition caused a TypeError or something) then
				just use that error as the result value.
			*/
			if (Utils.containsError(result)) {
				renderError(result, target);
				return;
			}
			/*
				Act on the data given - if the value differs from the previous,
				alter the target hook.
			*/
			Utils.assert("done" in result && "value" in result);
			if (result.value !== on) {
				on = result.value;
				/*
					You may note that only an off->on change is when
					rendering of the hook code occurs - and, moreover,
					each off->on change triggers a fresh re-render of
					hook code, with nothing cached. This is deliberate,
					and, I trust, intuitive.
				*/
				if (on) {
					this.renderInto(code, target);
				}
				else {
					target.empty();
				}
			}
			// If it's not done, keep sensing.
			if (!result.done || !this.inDOM()) {
				requestAnimationFrame(recursiveSensing);
			}
		}.bind(this));
		
		recursiveSensing();
	}
	
	Section = {
		// Used for duck-typing
		section: true,
		
		/**
			Creates a new Section which inherits from this one.
			Note: while all Section use the methods on this Section prototype,
			there isn't really much call for a Section to delegate to its
			parent Section.
			
			@method create
			@param {jQuery} newDom The DOM that comprises this section.
			@return {Section} Object that inherits from this one.
		*/
		create: function(dom) {
			var ret;
			
			// Just some overweening type-checking.
			Utils.assert(dom instanceof $ && dom.length === 1);
			
			/*
				Install all of the non-circular properties.
			*/
			ret = Object.assign(Object.create(this), {
				/*
					The time this Section was rendered. Of course, it's
					not been rendered yet, but it needs to be recorded this early because
					TwineScript uses it.
				*/
				timestamp: Date.now(),
				/*
					The root element for this section. Macros, hookRefs, etc.
					can only affect those in this Section's DOM.
				*/
				dom: dom || Utils.storyElement,
				/*
					The expression stack is an array of plain objects,
					each housing runtime data that is local to the expression being
					evaluated. It is used by macros such as "display" and "if" to
					keep track of prior evaluations - e.g. display loops, else().
					
					render() pushes a new object to this stack before
					running expressions, and pops it off again afterward.
				*/
				stack: [],
				/*
					This is an enchantments stack. I'll explain later.
				*/
				enchantments: []
			});
			
			/*
				Add a TwineScript environ and mix in its eval() method.
			*/
			ret = Environ(ret);
			return ret;
		},
		
		/**
			A quick check to see if this section's DOM is connected to the
			document's DOM.
			Currently only used by recursiveSensor().
			
			@method inDOM
		*/
		inDOM: function() {
			return $(document.documentElement).find(this.dom).length > 0;
		},

		/**
			This method runs Utils.$ (which is the $ function filtering out transition-out
			elements) with the dom as the context.
			
			@method $
		*/
		$: function(str) {
			return Utils.$(str, this.dom);
		},
		
		/**
			This function allows an expression of TwineMarkup to be evaluated as data, and
			determine the text within it.
			This is currently only used by runLink, to determine the link's passage name.
		
			@method evaluateTwineMarkup
			@private
			@param {String} expr
			@param {String|jQuery} text, or a <tw-error> element.
		*/
		evaluateTwineMarkup: function(expr) {
			/*
				The expression is rendered into this loose DOM element, which
				is then discarded after returning. Hopefully no leaks
				will arise from this.
			*/
			var p = $('<p>'),
				errors;
			
			/*
				Render the text, using this own section as the base (which makes sense,
				as the recipient of this function is usually a sub-expression within this section).
			
				No changers, etc. are capable of being applied here.
			*/
			this.renderInto(expr, p);
			
			/*
				But first!! Pull out any errors that were generated.
			*/
			if ((errors = p.find('tw-error')).length > 0) {
				return errors;
			}
			return p.text();
		},
		
		/**
			This method takes a selector string and selects hooks - usually single <tw-hook>s,
			but also "pseudo-hooks", consecutive charspans that match the selector -
			querying only this section's DOM and all above it.
			
			This is most commonly invoked by TwineScript's desugaring of the HookRef
			syntax (e.g. "?cupboard" becoming "section.selectHook('?cupboard')").
			
			@method selectHook
			@param {String} selectorString
			@return {HookSet|PseudoHookSet}
		*/
		selectHook: function(selectorString) {
			/*
				If a HookSet or PseudoHookSet was passed in, return it unmodified.
				TODO: Should this be a bug?
			*/
			if (HookSet.isPrototypeOf(selectorString)
				|| PseudoHookSet.isPrototypeOf(selectorString)) {
				return selectorString;
			}
			switch(HookUtils.selectorType(selectorString)) {
				case "hookRef": {
					return HookSet.create(this, selectorString);
				}
				case "string": {
					return PseudoHookSet.create(this, selectorString);
				}
			}
			return null;
		},
		
		/**
			Renders the given TwineMarkup code into a given element,
			transitioning it in. Changer functions can be provided to
			modify the ChangeDescriptor object that controls how the code
			is rendered.
			
			This is used primarily by Engine.showPassage() to render
			passage data into a fresh <tw-passage>, but is also used to
			render TwineMarkup into <tw-expression>s (by runExpression())
			and <tw-hook>s (by render() and runSensorFunction()).
			
			@method renderInto
			@param {String} code The TwineMarkup code to render into the target.
			@param target The render destination. Usually a HookSet, PseudoHookSet or jQuery.
			@param {Function|Array} [changers] The changer function(s) to run.
		*/
		renderInto: function(source, target, changers) {
			var
				/*
					This is the ChangeDescriptor that defines this rendering.
				*/
				desc = ChangeDescriptor.create({
					target: target,
					code: source,
				}),
				/*
					This stores the returned DOM created by rendering the changeDescriptor.
				*/
				dom = $(),
				/*
					This provides (sigh) a reference to this object usable by the
					inner doExpressions function, below.
				*/
				section = this;
				
			/*
				Also define a non-writable property linking it back to this section.
				This is used by enchantment macros to determine where to register
				their enchantments to.
			*/
			Object.defineProperty(desc, "section", { value:this });
			
			/*
				Run all the changer functions.
				[].concat() wraps a non-array in an array, while
				leaving arrays intact.
			*/
			changers && [].concat(changers).forEach(function(changer) {
				/*
					If a non-changer object was passed in (such as from
					specificEnchantmentEvent()), assign its values,
					overwriting the default descriptor's.
					Honestly, having non-changer descriptor-altering objects
					is a bit displeasingly rough-n-ready, but it's convenient...
				*/
				if (!changer.changer) {
					Object.assign(desc, changer);
				}
				else {
					changer.run(desc);
				}
			});
			
			/*
				As you know, in TwineScript a pseudo-hook selector is just a
				raw string. Such strings are passed directly to macros, and,
				at that point of execution inside TwineScript.eval, they don't
				have access to a particular section to call selectHook() from.
				
				So, we currently defer creating an array from the selector string
				until just here.
			*/
			if (typeof desc.target === "string") {
				desc.target = this.selectHook(desc.target);
			}
			
			/*
				If no code is left in the descriptor, do nothing.
				If there's code but no target, something
				incorrect has transpired.
			*/
			if (!desc.code && desc.append !== "remove") {
				return;
			}
			else if (!desc.target) {
				Utils.impossible("Section.renderInto",
					"ChangeDescriptor has code but not a target!");
				return;
			}
			
			/*
				Render the code into the target.
				
				When a non-jQuery is the target in the descriptor, it is bound to be
				a HookSet or PseudoHookSet, and each word or hook within that set
				must be rendered separately. This simplifies the implementation
				of render() considerably.
			*/
			if (!(desc.target instanceof $)) {
				desc.target.forEach(function(e) {
					/*
						Generate a new descriptor which has the same properties
						(rather, delegates to the old one via the prototype chain)
						but has just this hook/word as its target.
						Then, render using that descriptor.
					*/
					dom = dom.add(desc.create({ target: e }).render());
				});
			}
			else {
				dom = desc.render();
			}
			
			/*
				Before executing the expressions, put a fresh object on the
				expression data stack.
			*/
			this.stack.unshift(Object.create(null));
			
			/*
				Execute the expressions immediately.
			*/
			
			Utils.findAndFilter(dom, Selectors.hook + ","
				+ Selectors.expression + ","
				+ Selectors.internalLink).each(function doExpressions () {
				var expr = $(this);
			
				switch(expr.tag()) {
					case Selectors.hook:
					{
						if (expr.attr('code')) {
							section.renderInto(expr.attr('code'), expr);
							expr.removeAttr('code');
						}
						break;
					}
					case Selectors.expression:
					{
						runExpression.call(section, expr);
						break;
					}
					case Selectors.internalLink:
					{
						if (expr.attr("passage-expr")) {
							runLink.call(section, expr);
							break;
						}
					}
				}
			});
			
			/*
				After evaluating the expressions, pop the expression data stack.
				The data is purely temporary and can be safely discarded.
			*/
			this.stack.shift();
			
			/*
				Finally, update the enchantments now that the DOM is modified.
				TODO: this really should not be run more than once per frame,
				so some way of throttled debouncing is necessary.
			*/
			this.updateEnchantments();
			
		},
		
		/**
			Updates all enchantments in the section. Should be called after every
			DOM manipulation within the section (such as, at the end of .render()).

			@method updateEnchantments
		*/
		updateEnchantments: function () {
			this.enchantments.forEach(function(e) {
				/*
					This first method removes old <tw-enchantment> elements...
				*/
				e.refreshScope();
				/*
					...and this one adds new ones.
				*/
				e.enchantScope();
			});
		}
		
	};
	
	return Utils.lockProperties(Section);
});