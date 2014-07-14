define(['jquery', 'utils', 'selectors', 'twinescript', 'twinemarkup', 'renderer', 'story', 'state'],
function($, Utils, Selectors, TwineScript, TwineMarkup, Renderer, Story, State) {
	"use strict";
	
	/*
		These two vars cache the previously rendered source text, and the syntax tree returned by
		TwineMarkup.lex from that.
	*/
	var renderCacheKey,
		renderCacheValue,
		PassageInstance;
	
	PassageInstance = {
		passageinstance: true,
		
		create: function() {
			var ret = Object.assign(Object.create(this), {
				/*
					The time this passage instance was rendered. Of course, it's
					not been rendered yet, but it needs to be recorded this early because
					TwineScript uses it.
				*/
				timestamp: +new Date(),
				/*
					The visible DOM that any TwineScript code can see. Macros, hookRefs, etc.
					can only affect those in this passage's DOM.
				*/
				dom: $(this.dom),
			});
			/*
				PassageInstances, despite their horrid name, are also used for hooks'
				interiors. As such, they may need to obtain data from the actual passage
				housing them.
				
				Add a reference to the 'root', the farthest parent PassageInstance, which
				corresponds to the actual passage.
			*/
			ret.root = this.root || ret;
			/*
				Add a TwineScript environ and mix in its eval() method.
			*/
			ret = TwineScript.environ(ret);
			return Object.preventExtensions(ret);
		},

		/*
			This method runs Utils.$ (which is the $ function filtering out transition-out
			elements) with the dom as the context.
		*/
		$: function(str) {
			return Utils.$(str, this.dom);
		},
	
		/**
			Given a <tw-expression js> freshly rendered from TwineScript,
			run the expression and return its value, removing the
			js attribute and rendering the <tw-expression> inert.
			
			@method runExpression
			@private
			@param {jQuery} el The element.
			@param {PassageInstance} top
			@return The result of the expression.
		*/
		runExpression: function(el) {
			var call = Utils.unescape(el.attr('js'));
			el.removeAttr('js');
			
			/*
				Execute the expression.
			*/
			return this.eval(call);
		},
	
		/**
			This runs the changer functions that changer macros
			return, and performs the augmentations that they request,
			on the hooks they specify.
			
			@method runChangerFunction
			@private
			@param {Function} fn The changer function to run.
			@param {jQuery} target The destination <tw-hook> or <tw-expression>.
		*/
		runChangerFunction: function(fn, target) {
			/*
				This is the "default" ChangerDescriptor.
				It simply takes the 'code' in the target hook,
				renders it to the target unaltered, appending
				the elements, with no special transition.
			*/
			var result,
				desc = {
					code:             target.attr('code'),
					transition:       "",
					transitionTime:   1000,
					target:           target,
					append:           "append"
				};
			
			// This line here runs the function.
			fn(desc);
			
			/*
				If no code is left in the descriptor, do nothing.
				If there's code but no target, something
				incorrect has transpired.
			*/
			if (!desc.code) {
				return;
			}
			else if (!desc.target) {
				Utils.impossible("PassageInstance.runChangerFunction",
					"ChangerDescriptor has code but not a target!");
				return;
			}
			
			// Render the code
			result = this.render(desc.code + '');
			if (result && !(result instanceof Error)) {
				// Append it using the descriptor's given jQuery method
				desc.target[desc.append](result);
				desc.target.removeAttr('code');
				// Transition it using the descriptor's given transition
				if (desc.transition) {
					Utils.transitionIn(result, desc.transition);
				}
				// and update enchantments
				this.updateEnchantments();
			}
		},
		
		/**
			Updates all enchantment DOM structures in the passage.

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
		},
		
		/**
			This method renders TwineMarkup, executing the TwineScript expressions
			within, and returns the rendered HTML. The expressions only have visibility
			within this passage.

			@method render
			@param {string} source The code to render - HTML entities must be unescaped
			@return {jQuery} The rendered passage.
		*/
		render: function render(source) {
			var ret, html, innerInstance;
			
			// If a non-string is passed into here, there's really nothing to do.
			if (typeof source !== "string") {
				Utils.impossible("PassageInstance.render", "source was not a string, but " + typeof source);
				return $();
			}
			// Let's not bother if this source solely held macros.
			if (source.trim()) {
				/*
					A rudimentary caching mechanism to save on lexing:
					if the previously rendered source is the same as this,
					recall the HTML that was produced.
				*/
				if (source === renderCacheKey) {
					html = renderCacheValue;
				}
				else {
					html = Renderer.render(TwineMarkup.lex(source));
					renderCacheKey = source;
					renderCacheValue = html;
				}
			}
			// Render the HTML
			/*
				Important: various Twine macros perform DOM operations on this pre-inserted jQuery set of
				rendered elements, but assume that all the elements have a parent item, so that e.g.
				.insertBefore() can be performed on them. Also, and perhaps more saliently, the next
				block uses .find() to select <tw-macro> elements etc., which assumes that no <tw-macro>
				elements are present at the jQuery object's "root level".
				
				So, a <tw-temp-container> is temporarily used to house the entire rendered HTML
				before it's inserted at the end of this function.
			*/
			ret = $('<tw-temp-container>' + html);
			
			/*
				The upcoming TwineScript expressions need to be able to access the elements
				just rendered. So, create a new PassageInstance which can be passed in.
			*/
			innerInstance = this.create();
			/*
				Unwrap the <tw-temp-container>, and add its elements to
				this PassageInstance's DOM.
			*/
			innerInstance.dom = innerInstance.dom.add(ret.contents());

			/*
				Execute the expressions immediately.
			*/
			ret.find(Selectors.hook + ","
				+ Selectors.expression + ","
				+ Selectors.internalLink).each(function doExpressions () {
				var expr = $(this),
					// Hoisted vars, used by the tw-link case
					passage,
					text,
					visited,
					// Hoisted vars, used by the tw-expression case
					result,
					nextHook;

				switch(this.tagName.toLowerCase()) {
					case Selectors.hook:
					{
						if (expr.attr('code')) {
							expr.append(innerInstance.render(expr.attr('code')));
							expr.removeAttr('code');
						}
						break;
					}
					case Selectors.expression:
					{
						/*
							Execute the expression.
						*/
						result = innerInstance.runExpression(expr);
						/*
							Become cognizant of any hook connected to this expression.
						*/
						nextHook = expr.next("tw-hook");
						/*
							The result can be any of these values, and
							should be put to use in the following ways:
							
							falsy primitive:
								Remove the nearest hook.
							stringy primitive:
								Print into the passage.
							thunk:
								Unwrap the thunk, then continue.
							function with .changer property:
								Assume this was returned by a changer macro.
								Call runChangerFunction with it and the nearest hook
								as arguments.
							function:
								Run it, passing the nearest hook and innerInstance.
						*/
						if (typeof result === "function" && result.thunk) {
							// Unwrap the thunk to get the result
							result = result();
						}
						if (typeof result === "function") {
							if (nextHook.length) {
								if (result.changer) {
									innerInstance.runChangerFunction(result, nextHook);
								}
								else {
									result(nextHook, innerInstance);
								}
							}
						}
						// Having run that, print any error that resulted.
						if (result instanceof Error) {
							expr.addClass('error').text(result.message);
							break;
						}
						else if (typeof result === "string") {
							/*
								Transition the resulting Twine code into the expression's element.
							*/
							result = innerInstance.render(result + '');
							if (result) {
								expr.append(result);
							}
						}
						// And finally, the falsy primitive case
						else if (nextHook && (result === false
								|| result === null || result === undefined)) {
							nextHook.removeAttr('code');
						}
						break;
					}
					
					/*
						TODO: there should perchance exist "lazy links" whose passage-exprs are not
						evaluated into passage-ids until the moment they are clicked.
					*/
					case Selectors.internalLink:
					{
						passage = Utils.unescape(expr.attr("passage-expr"));
						text = expr.text();
						visited = -1;
						
						if (Story.passageNamed(passage)) {
							visited = (State.passageNameVisited(passage));
						} else {
							// Is it a code link?
							try {
								passage = innerInstance.eval(passage);
								Story.passageNamed(passage) && (visited = (State.passageNameVisited(passage)));
							} catch(err) { /* pass */ }
							
							// Not an internal link?
							if (!~visited) {
								expr.replaceWith('<tw-broken-link passage-id="' + passage + '">' + (text || passage) + '</tw-broken-link>');
							}
						}
						expr.removeAttr("passage-expr").attr("passage-id", Story.getPassageID(passage));
						if (visited) {
							expr.addClass("visited");
						}
						if (Story.options.opaquelinks) {
							expr.attr("title",passage);
						}
						break;
					}
				}
			});
			// Unwrap the aforementioned <tw-temp-container>.
			return ret.contents();
		}
	};
	
	/*
	DEBUG
	*/
	window.REPL = function(a) { var r = TwineScript.compile(TwineMarkup.lex("print("+a+")"));console.log(r);return TwineScript.environ().eval(r);};
	window.LEX = function(a) { var r = TwineMarkup.lex(a); return (r.length===1 ? r[0] : r); };
	
	Utils.log("PassageInstance module ready!");
	return Utils.lockProperties(PassageInstance);
});