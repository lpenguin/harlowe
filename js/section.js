define(['jquery', 'utils', 'selectors', 'renderer', 'twinescript', 'story', 'state', 'hookutils'],
function($, Utils, Selectors, Renderer, TwineScript, Story, State, HookUtils) {
	"use strict";

	var Section, HookSet, PseudoHookSet;
	
	/**
		A HookSet is an object representing a "hook selection". Hooks in
		Twine passages can have identical titles, and both can therefore be
		selected by the same hook reference. This class represents
		these selections within a given Section.
		
		These are currently exclusively created by Section.selectHook.
		
		@class HookSet
		@static
	*/
	HookSet = Object.freeze({
		
		/**
			An Array forEach-styled iteration function. The given function is
			called on every <tw-hook> in the section DOM 
			
			This is currently just used by Section.renderInto, to iterate over each
			word and render it individually.
			
			@method forEach
			@param {Function} fn The callback, which is passed the following:
				{jQuery} The <tw-hook> element to manipulate.
		*/
		forEach: function(fn) {
			/*
				hooks is a jQuery collection of every <tw-hook> in the Section
				which matches this HookSet's selector string.
				
				This is re-evaluated during every forEach call, so that it's always
				up-to-date with the DOM.
			*/
			var hooks = this.section.$(
				HookUtils.hookToSelector(
					this.selector.slice(1) /* slice off the hook sigil */
				)
			);
			hooks.each(function() {
				fn($(this));
			});
		},
		
		/**
			Creates a new HookSet. It has a selector and a section
			which determine what hooks to select, and from where.
			
			There isn't much call to ever use a HookSet as a prototype
			(especially since it's frozen, rendering section and selector
			difficult to override) but it's still available anyway. Such
			is the porous, spongy nature of JS.)
			
			@method create
			@param {Section} section The section to use for DOM lookups.
			@param {String} hookSelector The selector string.
		*/
		create: function(section, hookSelector) {
			var ret = Object.create(this);
			ret.section = section;
			ret.selector = hookSelector;
			return Object.freeze(ret);
		}
	});
	
	/**		
		A PseudoHookSet represents a "pseudo-hook", which selects
		section text using a search string, rather than a hook tag reference.
		A macro instantiation like...
			remove("cats")
		...would make a pseudo-hook that matches, or "hooks", every instance of
		the string "cats" in the passage. So, without needing to mark up
		that text with hook syntax, the author can still manipulate it intuitively.
		This is a powerful construct!
		
		PseudoHookSets, like HookSets, are exclusively created by Section.selectHook.
		
		@class PseudoHookSet
		@static
	*/
	PseudoHookSet = Object.freeze({		
		/**
			An Array forEach-styled iteration function. This wraps all
			matched words in the section DOM with a temporary element,
			then calls the passed function for each element.
			
			This is currently just used by Section.renderInto to iterate
			over each word and render it individually.
			
			@method forEach
			@param {Function} fn The callback, which is passed the following:
				{jQuery} The <tw-pseudo-hook> element to manipulate.
		*/
		forEach: function(fn) {
		
			/*
				HookUtils.findCharSpans powers the entire PseudoHook
				concept, and here is where it is invoked.
			*/
			HookUtils.findCharSpans(this.selector, this.section.dom)
				.forEach(function(e) {
				/*
					This is a bit of a #kludge, but no better solution
					exists. In order for DOM replacement jQuery methods
					to work reliably on the entire word, a temporary wrapper
					element must be placed around them, thus giving them a
					solid DOM parentage base.
					
					HookSet, of course, can simply use the <tw-hook> elements
					that already exist. As symmetry with that, the element name
					used here is <tw-pseudo-hook>.					
				*/
				e.wrapAll('<tw-pseudo-hook>');
				fn(e.parent());
				e.children().unwrap();
			});
		},
		
		/**
			Creates a new PseudoHookSet. It has a selector and a section
			which determine what words to select, and from where.
			
			@method create
			@param {Section} section The section to use for DOM lookups.
			@param {String} pseudoHookSelector The selector string.
		*/
		create: function(section, pseudoHookSelector) {
			var ret = Object.create(this);
			
			ret.section = section;
			ret.selector = pseudoHookSelector;
			return ret;
		}
	});
	
	/**
		Section objects represent a block of Twine prose rendered into the DOM.
		It contains its own DOM, a reference to any enclosing Section,
		and methods and properties related to invoking TwineScript code within it.
		
		@class Section
		@static
	*/
	
	/**
		Run a newly rendered <tw-link> element.
		
		TODO: there should perchance exist "lazy links" whose passage-exprs are not
		evaluated into passage-ids until the moment they are clicked.
		
		@method runLink
		@private
		@param {jQuery} link The <tw-link> element to run.
	*/
	function runLink(link) {
		var passage = Utils.unescape(link.attr("passage-expr")),
			text = link.text(),
			visited = -1;
		
		if (Story.passageNamed(passage)) {
			visited = (State.passageNameVisited(passage));
		} else {
			// Is it a code link?
			try {
				passage = this.eval(passage);
				Story.passageNamed(passage) && (visited = (State.passageNameVisited(passage)));
			} catch(err) { /* pass */ }
			
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
				Ideally I'd use $.fn.popAttr() here, if I made a jQuery plugin of it.
			*/
			result = this.eval(Utils.unescape(expr.attr('js')));
		
		expr.removeAttr('js');
		
		/*
			The result can be any of these values, and
			should be put to use in the following ways:
			
			falsy primitive:
				Remove the nearest hook.
			stringy primitive:
				Print into the passage.
			function with .changer property:
				Assume this was returned by a changer macro.
				Call runChangerFunction with it and the nearest hook
				as arguments.
			function:
				Run it, passing the nearest hook and innerInstance.
		*/
		if (typeof result === "function") {
			if (nextHook.length) {
				if (result.sensor) {
					runSensorFunction.call(this,result, nextHook);
				}
				else if (result.changer) {
					this.renderInto(nextHook.attr('code'), nextHook, result);
					/*
						Prevent the hook from executing normally if it wasn't
						actually the eventual target of the changer function.
						
						(I really want $.fn.popAttr() here, too...)
					*/
					nextHook.removeAttr('code');
				}
				else {
					result(nextHook, this);
				}
			}
		}
		// Having run that, print any error that resulted.
		if (result instanceof Error) {
			expr.addClass('error').text(result.message);
		}
		else if (typeof result === "string") {
			/*
				Transition the resulting Twine code into the expression's element.
			*/
			this.renderInto(result + '', expr);
		}
		// And finally, the falsy primitive case
		else if (nextHook && (result === false
				|| result === null || result === undefined)) {
			nextHook.removeAttr('code');
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
		*/
		var code = target.attr('code'),
			recursiveSensing,
			/*
				This stores the current state of the target
				hook - whether its code is rendered, or removed.
			*/
			on;
		
		/*
			Having stored the code, we remove it from the hook
			so that doExpressions() doesn't render it.
		*/
		target.removeAttr('code');
		
		/*
			This closure runs every frame from now on, until 
			the target hook is gone.
		*/
		recursiveSensing = function() {
			/*
				Check if the sensor has triggered.
			*/
			var result = sensor();
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
		}.bind(this);
		
		recursiveSensing();
	}
	
	
	/**
		This method renders TwineMarkup, executing the TwineScript expressions
		within, and returns the rendered HTML. The expressions only have visibility
		within this passage.

		@method render
		@private
		@param {ChangerDescriptor} desc The ChangerDescriptor describing what to do.
		@return {jQuery} The rendered passage.
	*/
	function render(desc) {
		var section,
			target = desc.target,
			/*
				Render the TwineMarkup prose into a HTML DOM structure.
				
				You may notice that the design of this and renderInto() means
				that, when a HookSet has multiple targets, each target has
				its own distinct rendering of the same TwineMarkup.
			*/
			dom = $(Renderer.exec(desc.code));
		
		/*
			First, check to see that the given jQuery method in the descriptor
			actually exists, and potentially tweak the name if it does not.
		*/
		if (!(desc.append in target)) {
			/*
				jQuery doesn't have a .replace method, but its .replaceAll is what
				we desire.
				
				You might wonder why, exactly, the discrepancy between the Twine
				"replace" macro and jQuery's "replaceWith" is allowed to trickle all
				the way up to here. I just don't feel like the camelCase of replaceWith
				(one of jQuery's rare camelCase cases) should have to be present
				in the remainder of the Harlowe codebase, when the exterior API
				uses "replace" for this DOM transformation action instead.
			*/
			if (desc.append === "replace") {
				desc.append += "With";
			}
			else {
				Utils.impossible("Section.render", "The target jQuery doesn't have a '" + desc.append + "' method.");
				return;
			}
		}
		
		/*
			Now, insert the DOM structure into the target element.
			
			Here are the reasons why the DOM must be connected to the target before the
			expressions are evaluated:
			
			* Various Twine macros perform DOM operations on this pre-inserted jQuery set of
			rendered elements, but assume that all the elements have a parent item, so that e.g.
			.insertBefore() can be performed on them.
			
			* Also, and perhaps more saliently, the next block uses .find() to select
			<tw-macro> elements etc., which assumes that the jQuery object has a single
			container element at its "root level".
			
			* Finally, sensor macros' interval functions deactivate themselves if the
			section is disconnected from Utils.storyElement, and if they initially
			run without being connected, they will immediately deactivate.
		*/
		target[desc.append](dom);
		
		/*
			Execute the expressions immediately.
			
			Now, I could .bind doExpressions to this, but since
			jQuery .each() is consistently dogmatic about 'this' binding,
			overruling it in this instance would be too unusual.
			
			So, instead:
		*/
		section = this;
		
		Utils.findAndFilter(dom, Selectors.hook + ","
			+ Selectors.expression + ","
			+ Selectors.internalLink).each(function doExpressions () {
			var expr = $(this);
			
			switch(this.tagName.toLowerCase()) {
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
					runLink.call(section, expr);
					break;
				}
			}
		});
		/*
			Transition it using the descriptor's given transition.
			This should ideally come last to avoid making the DOM structure needlessly
			complicated with <tw-transition> elements.
		*/
		if (desc.transition) {
			Utils.transitionIn(dom, desc.transition);
		}
		// Finally, update enchantments.
		this.updateEnchantments();
	}
	
	Section = {	
		// Used for duck-typing
		section: true,
		
		/**
			Creates a new Section which inherits from this one.
			@method create
			@param {jQuery} newDom The DOM that comprises this section.
			@return {Section} Object that inherits from this one.
		*/
		create: function(dom) {
			var ret;
			
			// Just some overweening type-checking.
			Utils.assert(dom instanceof $ && dom.length === 1);
			
			/*
				Install all of the non-referential properties
				(those that don't reference prior properties in their
				instantiation).
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
			});
			
			/*
				Sections may need to obtain data from the actual passage
				housing them.
				
				Add a reference to the 'root', the farthest parent Section, which
				corresponds to the actual passage.
			*/
			ret.root = this.root || ret;
			/*
				Add a TwineScript environ and mix in its eval() method.
			*/
			ret = TwineScript.environ(ret);
			return Object.preventExtensions(ret);
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
			This method takes a selector string and selects hooks - usually single <tw-hook>s,
			but also "pseudo-hooks", consecutive charspans that match the selector -
			querying only this section's DOM and all above it.
			
			This is most commonly invoked by TwineScript's desugaring of the HookRef
			syntax (e.g. "?cupboard" becoming "section.selectHook('?cupboard')").
			
			@method selectHook
			@return {HookSet|PseudoHookSet}
		*/
		selectHook: function(selectorString) {
			switch(HookUtils.selectorType(selectorString)) {
				case "hookRef": {
					return HookSet.create(this, selectorString);
				}
				case "string": {
					return PseudoHookSet.create(this, selectorString);
				}
			}
			return $();
		},
		
		/**
			Renders the given TwineMarkup code into a given element,
			transitioning it in. Changer functions can be provided to
			modify the ChangerDescriptor object that controls how the code
			is rendered.
			
			@method renderInto
			@param {String} code The TwineMarkup code to render into the target.
			@param target The render destination. Usually a HookSet, PseudoHookSet or jQuery.
			@param {Function|Array} [changers] The changer function(s) to run.
		*/
		//#ambiguous with .render
		renderInto: function(source, target, changers) {
			/*
				This is the "default" ChangerDescriptor.
				It simply takes the 'code' in the target hook,
				renders it to the target unaltered, appending
				the elements, with no special transition.
				
				We construct a changerDescriptor here and now
				so that those calling renderInto() need not
				construct a fully-conforming one themselves.
			*/
			var desc = {
				code:             source || target.attr('code'),
				transition:       "",
				target:           target,
				append:           "append"
			};
			
			/*
				Run all the changer functions.
				[].concat() wraps a non-array in an array, while
				leaving arrays intact.
			*/
			changers && [].concat(changers).forEach(function(e) {
				// Currently no objects are ever passed to this. #unused
				if (typeof e !== "function") {
					Object.assign(desc, e);
				}
				else {
					e(desc);
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
			if (!desc.code) {
				return;
			}
			else if (!desc.target) {
				Utils.impossible("Section.renderInto",
					"ChangerDescriptor has code but not a target!");
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
					render.call(this, Object.create(desc, { target: { value: e }}));
				}.bind(this));
			}
			else {
				render.call(this, desc);
			}
		},
		
		/**
			Updates all enchantment DOM structures in the passage.
			Currently not used!

			@method updateEnchantments
		*/
		updateEnchantments: function () {
			// Remove the old enchantments
			this.$(Selectors.pseudoHook).children().unwrap();
			this.$(Selectors.hook).attr("class", "");

			// Perform actions for each scoping macro's scope.
			this.$(Selectors.enchanter).each(function () {
				var enchantment = $(this).data("enchantment");
				if (enchantment) {
					// Refresh the scope, and enchant it.
					enchantment.refreshScope();
					enchantment.enchantScope();
				}
			});
		}
		
	};
	
	Utils.log("Section module ready!");
	return Utils.lockProperties(Section);
});