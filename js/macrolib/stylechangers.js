define(['jquery','macros', 'utils', 'utils/selectors', 'datatypes/colour', 'datatypes/changercommand', 'internaltypes/twineerror'],
($, Macros, {insensitiveName, assert, childrenProbablyInline}, Selectors, Colour, ChangerCommand, TwineError) => {
	"use strict";

	/*
		Built-in hook style changer macros.
		These produce ChangerCommands that apply CSS styling to their attached hooks.
		
		This module modifies the Macros module only, and exports nothing.
	*/
	const
		{either, wrapped} = Macros.TypeSignature,
		IfTypeSignature = [wrapped(Boolean, "If you gave a number, you may instead want to check that the number is not 0. "
			+ "If you gave a string, you may instead want to check that the string is not \"\".")];

	Macros.addChanger
		/*d:
			(if: Boolean) -> Command
			
			This macro accepts only booleans, and produces a command that can be attached to hooks
			to hide them "if" the value was false.
			
			Example usage:
			`(if: $legs is 8)[You're a spider!]` will show the `You're a spider!` hook if `$legs` is `8`.
			Otherwise, it is not run.
			
			Rationale:
			In any story with multiple paths or threads, where certain events could occur or not occur,
			it's common to want to run a slightly modified version of a passage reflecting the current
			state of the world. The (if:), (unless:), (else-if:) and (else:) macros let these modifications be
			switched on or off depending on variables, comparisons or calculations of your choosing.
			
			Alternatives:
			The (if:) macro is not the only attachment that can hide or show hooks! In fact,
			any variable that contains a boolean can be used in its place. For example:
			
			```
			(set: $isAWizard to $foundWand and $foundHat and $foundBeard)
			
			$isAWizard[You wring out your beard with a quick twisting spell.]
			You step into the ruined library.
			$isAWizard[The familiar scent of stale parchment comforts you.]
			```
			By storing a boolean inside `$isAWizard`, it can be used repeatedly throughout the story to
			hide or show hooks as you please.
			
			See also:
			(unless:), (else-if:), (else:)
		*/
		("if",
			(_, expr) => ChangerCommand.create("if", [expr]),
			(d, expr) => d.enabled = d.enabled && expr,
		IfTypeSignature)
		
		/*d:
			(unless: Boolean) -> Command
			
			This macro is the negated form of (if:): it accepts only booleans, and returns
			a command that can be attached hooks to hide them "if" the value was true.
			
			For more information, see the documentation of (if:).
		*/
		("unless",
			(_, expr) => ChangerCommand.create("unless", [!expr]),
			(d, expr) => d.enabled = d.enabled && expr,
		IfTypeSignature)
		
		/*d:
			(else-if: Boolean) -> Command
			
			This macro's result changes depending on whether the previous hook in the passage
			was shown or hidden. If the previous hook was shown, then this command hides the attached
			hook. Otherwise, it acts like (if:), showing the attached hook if it's true, and hiding it
			if it's false. If there was no preceding hook before this, then an error message will be printed.

			Example usage:
			```
			Your stomach makes {
			(if: $size is 'giant')[
			    an intimidating rumble!
			](else-if: $size is 'big')[
			    a loud growl
			](else:​)[
			    a faint gurgle
			]}.
			```
			
			Rationale:
			If you use the (if:) macro, you may find you commonly use it in forked branches of
			source: places where only one of a set of hooks should be displayed. In order to
			make this so, you would have to phrase your (if:) expressions as "if A happened",
			"if A didn't happen and B happened", "if A and B didn't happen and C happened", and so forth,
			in that order.
			
			The (else-if:) and (else:) macros are convenient variants of (if:) designed to make this easier: you
			can merely say "if A happened", "else, if B happened", "else, if C happened" in your code.
			
			Note:
			You may be familiar with the `if` keyword in other programming languages. Do heed this, then:
			the (else-if:) and (else:) macros need *not* be paired with (if:)! You can use (else-if:) and (else:)
			in conjunction with variable attachments, like so:
			```
			$married[You hope this warrior will someday find the sort of love you know.]
			(else-if: not $date)[You hope this warrior isn't doing anything this Sunday (because
			you've got overtime on Saturday.)]
			```
			
			See also:
			(if:), (unless:), (else:)
		*/
		("elseif", (section, expr) => {
			/*
				This and (else:) check the lastHookShown expando
				property, if present.
			*/
			if (!("lastHookShown" in section.stack[0])) {
				return TwineError.create("macrocall", "There's no (if:) or something else before this to do (else-if:) with.");
			}
			return ChangerCommand.create("elseif", [section.stack[0].lastHookShown === false && !!expr]);
		},
		(d, expr) => d.enabled = d.enabled && expr,
		IfTypeSignature)
		
		/*d:
			(else:) -> Command
			
			This is a convenient limited variant of the (else-if:) macro. It will simply show
			the attached hook if the preceding hook was hidden, and hide it otherwise.
			If there was no preceding hook before this, then an error message will be printed.
			
			Rationale:
			After you've written a series of hooks guarded by (if:) and (else-if:), you'll often have one final
			branch to show, when none of the above have been shown. (else:) is the "none of the above" variant
			of (else-if:), which needs no boolean expression to be provided. It's essentially the same as
			`(else-if: true)`, but shorter and more readable.
			
			For more information, see the documentation of (else-if:).
			
			Note:
			Due to a mysterious quirk, it's possible to use multiple (else:) macro calls in succession:
			```
			$isUtterlyEvil[You suddenly grip their ankles and spread your warm smile into a searing smirk.]
			(else:​)[In silence, you gently, reverently rub their soles.]
			(else:​)[Before they can react, you unleash a typhoon of tickles!]
			(else:​)[They sigh contentedly, filling your pious heart with joy.]
			```
			This usage can result in a somewhat puzzling passage source structure, where each (else:) hook
			alternates between visible and hidden depending on the first such hook. So, it is best avoided.
		*/
		("else", (section) => {
			if (!("lastHookShown" in section.stack[0])) {
				return TwineError.create("macrocall", "There's nothing before this to do (else:) with.");
			}
			return ChangerCommand.create("else", [section.stack[0].lastHookShown === false]);
		},
		(d, expr) => d.enabled = d.enabled && expr,
		null)

		/*d:
			(hook: String) -> Command
			Allows the author to give a hook a computed tag name.
			
			Example usage:
			`(hook: $hookName)[]`
			
			Rationale:
			You may notice that it isn't possible to attach a nametag to hooks with commands
			already attached - in the case of `(font:"Museo Slab")[The Vault]<title|`, the nametag results
			in an error. This command can be added with other commands to allow the hook to be named:
			`(font:"Museo Slab")+(hook: "title")[The Vault]`.
			
			Furthermore, unlike the nametag syntax, (hook:) can be given any string expression:
			`(hook: "eyes" + (string:$eyeCount))` is valid, and will, as you'd expect, give the hook
			the name of `eyes1` if `$eyeCount` is 1.
		*/
		(["hook"],
			(_, name) => ChangerCommand.create("hook", [name]),
			(d, name) => d.attr.push({name: name}),
			[String]
		)

		/*d:
			(transition: String) -> Command
			Also known as: (t8n:)
			
			Apply a built-in CSS transition to a hook as it appears.
			
			Example usage:
			`(transition: "pulse")[Gleep!]` makes the hook `[Gleep!]` use the "pulse" transition
			when it appears.
			
			Details:
			At present, the following text strings will produce a particular transition:
			* "dissolve" (causes the hook to gently fade in)
			* "shudder" (causes the hook to instantly appear while shaking back and forth)
			* "pulse" (causes the hook to instantly appear while pulsating rapidly)
			
			All transitions are 0.8 seconds long. A means of altering transition times may be available
			in a distant future update.
			
			See also:
			(textstyle:)
		*/
		(["transition", "t8n"],
			(_, name) => {
				const validT8ns = ["dissolve", "shudder", "pulse"];
				name = insensitiveName(name);
				if (validT8ns.indexOf(name) === -1) {
					return TwineError.create(
						"macrocall",
						"'" + name + '" is not a valid (transition:)',
						"Only the following names are recognised (capitalisation and hyphens ignored): "
							+ validT8ns.join(", "));
				}
				return ChangerCommand.create("transition", [name]);
			},
			(d, name) => {
				d.transition     = name;
				return d;
			},
			[String]
		)
		
		// (font:)
		// A shortcut for applying a font to a span of text.
		("font",
			(_, family) => ChangerCommand.create("font", [family]),
			(d, family) => {
				d.styles.push({'font-family': family});
				return d;
			},
			[String]
		)
		
		// (align:)
		// A composable shortcut for the ===><== aligner syntax.
		("align",
			(_, arrow) => {
				/*
					I've decided to reimplement the aligner arrow parsing algorithm
					used in markup/Markup and Renderer here for decoupling purposes.
				*/
				let style,
					centerIndex = arrow.indexOf("><");
				
				if (!/^(==+>|<=+|=+><=+|<==+>)$/.test(arrow)) {
					return TwineError.create('macrocall', 'The (align:) macro requires an alignment arrow '
						+ '("==>", "<==", "==><=" etc.) be provided, not "' + arrow + '"');
				}
				
				if (~centerIndex) {
					/*
						Find the left-align value
						(Since offset-centered text is centered,
						halve the left-align - hence I multiply by 50 instead of 100
						to convert to a percentage.)
					*/
					const alignPercent = Math.round(centerIndex / (arrow.length - 2) * 50);
					style = Object.assign({
							'text-align'  : 'center',
							'max-width'   : '50%',
						},
						/*
							25% alignment is centered, so it should use margin-auto.
						*/
						(alignPercent === 25) ? {
							'margin-left' : 'auto',
							'margin-right': 'auto',
						} : {
							'margin-left' : alignPercent + '%',
					});
				}
				else if (arrow[0] === "<" && arrow.slice(-1) === ">") {
					style = {
						'text-align'  : 'justify',
						'max-width'   : '50%',
					};
				}
				else if (arrow.includes(">")) {
					style = {
						'text-align'  : 'right'
					};
				}
				else {
					/*
						If this is nested inside another (align:)-affected hook,
						this is necessary to assert leftward alignment.
					*/
					style = {
						'text-align'  : 'left'
					};
				}
				// This final property is necessary for margins to appear.
				style.display = 'block';
				return ChangerCommand.create("align", [style]);
			},
			(d, style) => {
				d.styles.push(style);
			},
			[String]
		)
		
		/*
			(text-colour:)
			A shortcut for applying a colour to a span of text.
			The (colour:) alias is one I feel a smidge less comfortable with. It
			should easily also refer to a value macro that coerces string to colour...
			But, I suppose this is the more well-trod use-case for this keyword.
		*/
		(["text-colour", "text-color", "color", "colour"],
			(_, CSScolour) => {
				/*
					Convert TwineScript CSS colours to bad old hexadecimal.
					This is important as it enables the ChangerCommand to be serialised
					as a string more easily.
				*/
				if (CSScolour && CSScolour.colour) {
					CSScolour = CSScolour.toHexString(CSScolour);
				}
				return ChangerCommand.create("text-colour", [CSScolour]);
			},
			(d, CSScolour) => {
				d.styles.push({'color': CSScolour});
				return d;
			},
			[either(String,Colour)]
		)
		/*
			(text-rotate:)
			A shortcut for applying a CSS rotation to a span of text.
		*/
		("text-rotate",
			(_, rotation) => ChangerCommand.create("text-rotate", [rotation]),
			(d, rotation) => {
				d.styles.push({display: 'inline-block', 'transform'() {
					let currentTransform = $(this).css('transform') || '';
					if (currentTransform === "none") {
						currentTransform = '';
					}
					return currentTransform + " rotate(" + rotation + "deg)";
				}});
				return d;
			},
			[Number]
		)
		/*
			(background:)
			This sets the changer's background-color or background-image,
			depending on what is supplied.
		*/
		("background",
			(_, value) => {
				//Convert TwineScript CSS colours to bad old hexadecimal.
				if (value && value.colour) {
					value = value.toHexString(value);
				}
				return ChangerCommand.create("background", [value]);
			},
			(d, value) => {
				let property;
				/*
					Different kinds of values can be supplied to this macro
				*/
				if (Colour.isHexString(value)) {
					property = {"background-color": value};
				}
				else {
					/*
						When Harlowe can handle base64 image passages,
						this will invariably have to be re-worked.
					*/
					/*
						background-size:cover allows the image to fully cover the area
						without tiling, which I believe is slightly more desired.
					*/
					property = {"background-size": "cover", "background-image":"url(" + value + ")"};
				}
				d.styles.push(property,
					/*
						We also need to alter the "display" property in a case where the element
						has block children - the background won't display if it's kept as
					 */
					{ display() { return childrenProbablyInline($(this)) ? "initial" : "block"; } });
				return d;
			},
			[either(String,Colour)]
		)
		
		/*d:
			(text-style: String) -> Command
			
			This applies a selected built-in text style to the hook's text.
			
			Example usage:
			`The shadow (text-style: "shadow")[flares] at you!` will style the word "flares" with a shadow.
			
			`(set: $s to (text-style: "shadow")) The shadow $s[flares] at you!` will also style it with a shadow.
			
			Rationale:
			While Twine offers markup for common formatting styles like bold and italic, having these
			styles available from a command macro provides some extra benefits: it's possible, as with all
			such style macros, to (set:) them into a variable, combine them with other commands, and re-use them
			succinctly throughout the story (by using the variable in place of the macro).
			
			Furthermore, this macro also offers many less common but equally desirable styles to the author,
			which are otherwise unavailable or difficult to produce.
			
			Details:
			At present, the following text strings will produce a particular style:
			* "bold", "italic", "underline", "strike", "superscript", "subscript", "blink", "mark", "delete"
			* "outline"
			* "shadow"
			* "emboss"
			* "condense"
			* "expand"
			* "blur"
			* "blurrier",
			* "smear"
			* "mirror"
			* "upside-down"
			* "fade-in-out"
			* "rumble"
			* "shudder"
			
			See also:
			(css:)
		*/
		/*
			For encapsulation, the helpers that these two methods use are stored inside
			this closure, and used in the addChanger call.
		*/
		(...(() => {
				var
					/*
						This is a shorthand used for the definitions below.
					*/
					colourTransparent =  { color: "transparent", },
					/*
						These map style names, as input by the author as this macro's first argument,
						to CSS attributes that implement the styles. These are all hand-coded.
					*/
					styleTagNames = Object.assign(Object.create(null), {
						bold:         { 'font-weight': 'bold' },
						italic:       { 'font-style': 'italic' },
						underline:    { 'text-decoration': 'underline' },
						strike:       { 'text-decoration': 'line-through' },
						superscript:  { 'vertical-align': 'super', 'font-size': '.83em' },
						subscript:    { 'vertical-align': 'sub', 'font-size': '.83em' },
						blink: {
							animation: "fade-in-out 1s steps(1,end) infinite alternate",
							// .css() handles browser prefixes by itself.
						},
						shudder: {
							animation: "shudder linear 0.1s 0s infinite",
							display: "inline-block",
						},
						mark: {
							'background-color': 'hsla(60, 100%, 50%, 0.6)',
						},
						condense: {
							"letter-spacing": "-0.08em",
						},
						expand: {
							"letter-spacing": "0.1em",
						},
						outline: [{
								"text-shadow"() {
									const colour = $(this).css('color');
									return "-1px -1px 0 " + colour
										+ ", 1px -1px 0 " + colour
										+ ",-1px  1px 0 " + colour
										+ ", 1px  1px 0 " + colour;
								},
							},
							{
								color() {
									return $(this).css('background-color');
								},
							}
						],
						shadow: {
							"text-shadow"() { return "0.08em 0.08em 0.08em " + $(this).css('color'); },
						},
						emboss: {
							"text-shadow"() { return "0.08em 0.08em 0em " + $(this).css('color'); },
						},
						smear: [{
								"text-shadow"() {
									const colour = $(this).css('color');
									return "0em   0em 0.02em " + colour + ","
										+ "-0.2em 0em  0.5em " + colour + ","
										+ " 0.2em 0em  0.5em " + colour;
								},
							},
							// Order is important: as the above function queries the color,
							// this one, eliminating the color, must run afterward.
							colourTransparent
						],
						blur: [{
								"text-shadow"() { return "0em 0em 0.08em " + $(this).css('color'); },
							},
							colourTransparent
						],
						blurrier: [{
								"text-shadow"() { return "0em 0em 0.2em " + $(this).css('color'); },
								"user-select": "none",
							},
							colourTransparent
						],
						mirror: {
							display: "inline-block",
							transform: "scaleX(-1)",
						},
						upsidedown: {
							display: "inline-block",
							transform: "scaleY(-1)",
						},
						fadeinout: {
							animation: "fade-in-out 2s ease-in-out infinite alternate",
						},
						rumble: {
							animation: "rumble linear 0.1s 0s infinite",
							display: "inline-block",
						},
					});
				
				return [
					"text-style",
					(_, styleName) => {
						/*
							The name should be insensitive to normalise both capitalisation,
							and hyphenation of names like "upside-down".
						*/
						styleName = insensitiveName(styleName);
						
						if (!(styleName in styleTagNames)) {
							return TwineError.create(
								"macrocall",
								"'" + styleName + '" is not a valid (textstyle:)',
								"Only the following names are recognised (capitalisation and hyphens ignored): "
									+ Object.keys(styleTagNames).join(", "));
						}
						return ChangerCommand.create("text-style", [styleName]);
					},
					(d, styleName) => {
						assert(styleName in styleTagNames);
						d.styles = d.styles.concat(styleTagNames[styleName]);
						return d;
					}
				];
			})(),
			[String]
		)
		
		/*d:
			(css: String) -> Command
			
			This takes a string of inline CSS, and applies it to the hook, as if it
			were a HTML "style" property.
			
			Usage example:
			```
			(css: "background-color:indigo")
			```
			
			Rationale:
			The built-in macros for layout and styling hooks, such as (text-style:),
			are powerful and geared toward ease-of-use, but do not entirely provide
			comprehensive access to the browser's styling. This changer macro allows
			extended styling, using inline CSS, to be applied to hooks.
			
			This is, however, intended solely as a "macro of last resort" - as it requires
			basic knowledge of CSS - a separate language distinct from TwineScript - to use,
			and requires it be provided a single inert string, it's not as accommodating as
			the other such macros.
			
			See also:
			(text-style:)
		*/
		("css",
			(_, text) => {
				/*
					Add a trailing ; if one was neglected. This allows it to
					be concatenated with existing styles.
				*/
				if (!text.trim().endsWith(";")) {
					text += ';';
				}
				return ChangerCommand.create("css", [text]);
			},
			(d, text) => {
				d.attr.push({'style'() {
					return ($(this).attr('style') || "") + text;
				}});
				return d;
			},
			[String]
		)
		;
});
