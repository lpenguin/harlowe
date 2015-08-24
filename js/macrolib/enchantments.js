define(['jquery', 'utils', 'macros', 'datatypes/hookset', 'datatypes/changercommand', 'internaltypes/enchantment'],
($, Utils, Macros, HookSet, ChangerCommand, Enchantment) => {
	"use strict";

	const {either} = Macros.TypeSignature;
	/*
		Built-in Revision, Interaction and Enchantment macros.
		This module modifies the Macros module only, and exports nothing.
	*/

	/*
		This experimental (enchant:) macro is currently just for testing purposes.
	*/
	Macros.add("enchant",
		(section, changer, scope) => ({
			TwineScript_ObjectName: "an (enchant:) command",
			TwineScript_TypeName:   "an (enchant:) command",
			TwineScript_Print() {
				const enchantment = Enchantment.create({
					scope: section.selectHook(scope),
					changer,
				});
				section.enchantments.push(enchantment);
				enchantment.enchantScope();
				return "";
			},
		}),
		[ChangerCommand, either(HookSet,String)]
	);

	/*
		Revision macros produce ChangerCommands that redirect where the attached hook's
		text is rendered - usually rendering inside an entirely different hook.
	*/
	const revisionTypes = [
			// (replace:)
			// A macro that replaces the scope element(s) with its contents.
			"replace",
			// (append:)
			// Similar to replace, but appends the contents to the scope(s).
			"append",
			// (prepend:)
			// Similar to replace, but prepends the contents to the scope(s).
			"prepend"
		];
	
	revisionTypes.forEach((e) => {
		Macros.addChanger(e,
			(_, scope) => ChangerCommand.create(e, [scope]),
			(desc, scope) => {
				/*
					Now, if the source hook was outside the collapsing syntax,
					and its dest is inside it, then it should NOT be collapsed, reflecting
					its, shall we say, "lexical" position rather than its "dynamic" position.
					In order to obtain this information, though, we need the obscure jQuery
					context property, to obtain the original target's .context (which was
					set in the findAndFilter() call inside renderInto() in section).
					I don't like having to touch this API surface, but it has to be done, I guess.
				*/
				const collapsing = $(desc.target.context).parents().filter('tw-collapsed').length > 0;
				if (!collapsing) {
					desc.attr = [...desc.attr, { collapsing: false }];
				}
				/*
					Having done that, we may now alter the desc's target.
				*/
				desc.target = scope;
				desc.append = e;
				return desc;
			},
			either(HookSet,String)
		);
	});
	
	/*
		This large routine generates functions for enchantment macros, to be applied to
		Macros.addChanger().
		
		An "enchantment" is a process by which selected hooks in a passage are
		automatically wrapped in <tw-enchantment> elements that have certain styling classes,
		and can trigger the rendering of the attached TwineMarkup source when they experience
		an event.
		
		In short, it allows various words to become links etc., and do something when
		they are clicked, just by deploying a single macro instantiation! Just type
		"(click:"house")[...]", and every instance of "house" in the section becomes
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
		
		@method newEnchantmentMacroFns
		@param  {Function} innerFn       The function to perform on the macro's hooks
		@param  {Object}  [enchantDesc]  An enchantment description object, or null.
		@return {Function[]}             A pair of functions.
	*/
	function newEnchantmentMacroFns(enchantDesc, name) {
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
		$(() => {
			Utils.storyElement.on(
				/*
					Put this event in the "enchantment" jQuery event
					namespace, solely for personal tidiness.
				*/
				enchantDesc.event + ".enchantment",
			
				// This converts a HTML class attribute into a CSS selector
				"." + enchantDesc.classList.replace(/ /g, "."),
			
				function generalEnchantmentEvent() {
					const enchantment = $(this),
						/*
							Run the actual event handler.
						*/
						event = enchantment.data('enchantmentEvent');
				
					if (event) {
						event(enchantment);
					}
				}
			);
		});
		
		/*
			Return the macro function AND the ChangerCommand function.
			Note that the macro function's "selector" argument
			is that which the author passes to it when invoking the
			macro (in the case of "(macro: ?1)", selector will be "?1").
		*/
		return [
			(_, selector) => {
				/*
					If the selector is a HookRef (which it usually is), we must unwrap it
					and extract its plain selector string, as this ChangerCommand
					could be used far from the hooks that this HookRef selects,
					and we'll need to re-run the desc's section's selectHook() anyway.
				*/
				if (selector.selector) {
					selector = selector.selector;
				}
				return ChangerCommand.create(name, [selector]);
			},
			/*
				This ChangerCommand registers a new enchantment on the Section that the
				ChangeDescriptor belongs to.
				
				It must perform the following tasks:
				1. Silence the passed-in ChangeDescriptor.
				2. Create an enchantment for the hooks selected by the given selector.
				3. Affix an enchantment event function (that is, a function to run
				when the enchantment's event is triggered) to the <tw-enchantment> elements.
				
				You may notice some of these are side-effects to a changer function's
				proper task of altering a ChangeDescriptor. Alas...
			*/
			function makeEnchanter(desc, selector) {
				/*
					Prevent the target's source from running immediately.
					This is unset when the event is finally triggered.
				*/
				desc.enabled = false;
				
				/*
					If a rerender method was specified, then this is a "combo" macro,
					which will render its hook's code into a separate target.
					
					Let's modify the descriptor to use that target and render method.
					(Yes, the name "rerender" is #awkward.)
				*/
				if (enchantDesc.rerender) {
					desc.target = selector;
					desc.append = enchantDesc.rerender;
				}
				
				/*
					This enchantData object is stored in the descriptor's Section's enchantments
					list, to allow the Section to easily enchant and re-enchant this
					scope whenever its DOM is altered (e.g. words matching this enchantment's
					selector are added or removed from the DOM).
				*/
				const enchantData = Enchantment.create({
					attr: {
						'class': enchantDesc.classList,
					},
					data: {
						'enchantmentEvent'() {
							if (enchantDesc.once) {
								/*
									Remove this enchantment from the Section's list.
								*/
								const index = desc.section.enchantments.indexOf(enchantData);
								desc.section.enchantments.splice(index,1);
								/*
									Of course, the <tw-enchantment>s
									must also be removed.
								*/
								enchantData.disenchant();
							}
							/*
								At last, the target originally specified
								by the ChangeDescriptor can now be filled with the
								ChangeDescriptor's original source.
								
								By passing the desc as the third argument,
								all its values are assigned, not just the target.
								The second argument may be extraneous. #awkward
							*/
							desc.section.renderInto(
								desc.source,
								null,
								Object.assign({}, desc, { enabled: true })
							);
						},
					},
					scope: desc.section.selectHook(selector),
				});
				/*
					Add the above object to the section's enchantments.
				*/
				desc.section.enchantments.push(enchantData);
				/*
					Enchant the scope for the first time.
				*/
				enchantData.enchantScope();
				return desc;
			},
			either(HookSet,String)
		];
	}
	
	/*
		Interaction macros produce ChangerCommands that defer their attached
		hook's rendering, and enchantment a target hook, waiting for the
		target to be interacted with and then performing the deferred rendering.
	*/
	const interactionTypes = [
		// (click:)
		// Reveal the enclosed hook only when the scope is clicked.
		{
			name: "click",
			enchantDesc: {
				event    : "click",
				once     : true,
				rerender : "",
				classList: "link enchantment-link"
			}
		},
		// (mouseover:)
		// Perform the enclosed macros when the scope is moused over.
		{
			name: "mouseover",
			enchantDesc: {
				event    : "mouseenter",
				once     : true,
				rerender : "",
				classList: "enchantment-mouseover"
			}
		},
		// (mouseout:)
		// Perform the enclosed macros when the scope is moused away.
		{
			name: "mouseout",
			enchantDesc: {
				event    : "mouseleave",
				once     : true,
				rerender : "",
				classList: "enchantment-mouseout"
			}
		}
	];
	
	//TODO: (hover:)
	
	interactionTypes.forEach((e) => Macros.addChanger(e.name, ...newEnchantmentMacroFns(e.enchantDesc, e.name)));
	
	/*
		Combos are shorthands for interaction and revision macros that target the same hook:
		for instance, (click: ?1)[(replace:?1)[...]] can be written as (click-replace: ?1)[...]
	*/
	revisionTypes.forEach((revisionType) => {
		interactionTypes.forEach((interactionType) => {
			const enchantDesc = Object.assign({}, interactionType.enchantDesc, {
					rerender: revisionType
				}),
				name = interactionType.name + "-" + revisionType;
			Macros.addChanger(name, ...newEnchantmentMacroFns(enchantDesc, name));
		});
	});
});
