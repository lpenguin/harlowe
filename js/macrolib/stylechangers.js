define(['jquery','macros', 'utils', 'utils/selectors', 'datatypes/colour', 'datatypes/changercommand'],
function($, Macros, Utils, Selectors, Colour, ChangerCommand) {
	"use strict";

	/*
		Built-in hook style changer macros.
		These produce ChangerCommands that apply CSS styling to their attached hooks.
		
		This module modifies the Macros module only, and exports nothing.
	*/
	var
		either = Macros.TypeSignature.either,
		optional = Macros.TypeSignature.optional;
	
	Macros.addChanger
	
		// (hook:)
		// Allows the author to give a hook a computed tag name.
		(["hook"],
			function hook(_, name) {
				return ChangerCommand.create("hook", [name]);	
			},
			function(d, name) {
				d.attr = Object.assign(d.attr || {}, {
					name: name
				});
			},
			[String]
		)

		// (transition:)
		// Apply a CSS transition to a hook as it is inserted.
		// Accepts a string name, and an OPTIONAL delay time.
		(["transition", "t8n"],
			function transition(_, name, time) {
				return ChangerCommand.create("transition", [name, time]);
			},
			function(d, name, time) {
				d.transition     = name;
				d.transitionTime = time;
				return d;
			},
			[String, optional(Number)]
		)
		
		// (font:)
		// A shortcut for applying a font to a span of text.
		("font",
			function font(_, family) {
				return ChangerCommand.create("font", [family]);
			},
			function(d, family) {
				d.styles.push({'font-family': family});
				return d;
			},
			[String]
		)
		
		// (position-y:)
		// A shortcut for positioning the element.
		("position-y",
			function positiony(_, percent) {
				return ChangerCommand.create("position-y", percent);
			},
			function(d, percent) {
				d.styles.push({
					position:'absolute',
					/*
						This is necessary to retain the normal width of the element,
						but it will supplant any previously defined width.
						Ideally this should be a special "defaulting" object which
						gets sorted out before.
					*/
					width: "100%",
					top: percent * 100 + "%" });
				return d;
			},
			[Number]
		)
		// (position-x:)
		("position-x",
			function positionx(_, percent) {
				return ChangerCommand.create("position-x", percent);
			},
			function(d, percent) {
				d.styles.push({
					position:'absolute',
					/*
						As it is for position-y, so it is here.
					*/
					width: "100%",
					left: percent * 100 + "%" });
				return d;
			},
			[Number]
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
				return ChangerCommand.create("text-colour", [CSScolour]);
			},
			function (d, CSScolour) {
				d.styles.push({'color': CSScolour});
				return d;
			},
			[either(String,Colour)]
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
				return ChangerCommand.create("background", [value]);
			},
			function (d, value) {
				var property;
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
				d.styles.push(property);
				return d;
			},
			[either(String,Colour)]
		)
		
		/*
			(text-style:)
		*/
		("text-style",
			function textstyle(_, styleName) {
				return ChangerCommand.create("text-style", [styleName]);
			},
			(function() {
				/*
					This is a closure in which to cache the style-tagname mappings.
				*/
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
						"shudder": {
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
								"text-shadow": function() {
									var colour = $(this).css('color');
									return "-1px -1px 0 " + colour
										+ ", 1px -1px 0 " + colour
										+ ",-1px  1px 0 " + colour
										+ ", 1px  1px 0 " + colour;
								},
							},
							{
								color: function() {
									var elem = $(this),
										colour;
									/*
										We need the visible background colour, but there
										isn't a reliable way to retrieve it
										without traversing up through the element tree.
										So, alas, it must be done.
									*/
									while (elem[0] !== document
										&& (colour = elem.css('background-color')) === "transparent") {
										elem = elem.parent();
										/*
											If <tw-story> element is detached, we use the <body>,
											colour as an emergency fallback.
										*/
										if (elem.length === 0) {
											elem = $('body');
										}
									}
									return colour;
								},
							}
						],
						shadow: {
							"text-shadow": function() { return "0.08em 0.08em 0.08em " + $(this).css('color'); },
						},
						emboss: {
							"text-shadow": function() { return "0.08em 0.08em 0em " + $(this).css('color'); },
						},
						smear: [{
								"text-shadow": function() {
									var colour = $(this).css('color');
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
								"text-shadow": function() { return "0em 0em 0.08em " + $(this).css('color'); },
							},
							colourTransparent
						],
						blurrier: [{
								"text-shadow": function() { return "0em 0em 0.2em " + $(this).css('color'); },
								"user-select": "none",
							},
							colourTransparent
						],
						mirror: {
							display: "inline-block",
							transform: "scaleX(-1)",
						},
						"upsidedown": {
							display: "inline-block",
							transform: "scaleY(-1)",
						},
						"fadeinout": {
							animation: "fade-in-out 2s ease-in-out infinite alternate",
						},
						"rumble": {
							animation: "rumble linear 0.1s 0s infinite",
							display: "inline-block",
						},
					});
				
				return function text_style(d, styleName) {
					/*
						The name should be insensitive to normalise both capitalisation,
						and hyphenation of names like "upside-down".
					*/
					styleName = Utils.insensitiveName(styleName);
					
					if (styleName in styleTagNames) {
						/*
							This uses [].concat's behaviour of behaving like [].push() when
							given non-arrays.
						*/
						d.styles = d.styles.concat(styleTagNames[styleName]);
					}
					return d;
				};
			}()),
			[String]
		);
});
