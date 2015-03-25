(function() {
	'use strict';
	var lex, harloweStyles, beforeChange;
	
	/*
		Import the TwineMarkup lexer function, and store it locally.
	*/
	if(typeof define === 'function' && define.amd) {
		define('markup', [], function (markup) {
			lex = markup.lex;
		});
	}
	else if (typeof StoryFormat === 'function' && this instanceof StoryFormat) {
		lex = this.modules.Markup.lex;
	}
	
	/*
		This function, used as an event handler, applies a hack to CodeMirror to force it
		to rerender the entire text area whenever a change is made, not just the change.
		This allows 'backtrack' styling, such as unclosed brackets, to be possible
		under CodeMirror.
	*/
	var beforeChange = _.throttle(function(_, changeObj) {
		if (!changeObj.update) {
			return;
		}
		console.log('beforeChange');
		/*
			First, obtain the text area's full text line array, truncated
			to just the line featuring the change.
		*/
		var line = changeObj.from.line,
			newText = CodeMirror.modes.harlowe.cm.doc.getValue()
				.split('\n')
				.slice(0, changeObj.from.line + 1);
		/*
			Join it with the change's text.
		*/
		newText[line] =
			newText[line].slice(0, changeObj.from.ch)
			+ changeObj.text[0];
		
		/*
			If the change is multi-line, the additional lines should be added.
		*/
		newText = newText.concat(changeObj.text.slice(1));
		/*
			Now, register this change.
		*/
		changeObj.update({line:0,ch:0}, changeObj.to, newText);
	}, 500, {leading:true});
	
	/*
		The mode is defined herein.
	*/
	window.CodeMirror && CodeMirror.defineMode('harlowe', function() {
		return {
			/*
				The startState is vacant because all of the computation is done
				inside token().
			*/
			startState: function() {
				/*
					Attach the all-important beforeChanged event, but make sure it's only attached once.
				*/
				var doc = CodeMirror.modes.harlowe.cm.doc;
				doc.off('beforeChange');
				doc.on('beforeChange', beforeChange);
				
				return {
					tree: null,
					pos: 0,
				};
			},
			/*
				Since we can't cheaply serialise the entire tree for each state,
				we just resort to forcing a re-creation every time one of these copied
				states is referred to.
			*/
			copyState: function(state) {
				var ret = {
					tree: state.tree,
					pos: state.pos,
				};
				state.tree = null;
				return ret;
			},
			blankLine: function(state) {
				state.pos++;
			},
			token: function token(stream, state) {
				var currentBranch, currentToken;
				
				if (!state.tree) {
					/*
						CodeMirror doesn't allow modes to have full access to the text of
						the document. This hack overcomes this respectable limitation:
						TwineJS's PassageEditor stashes a reference to the doc in
						the CodeMirror modes object - and here, we retrieve it,
						and use it to compute a full parse tree.
					*/
					state.tree = lex(CodeMirror.modes.harlowe.cm.doc.getValue());
				}
				/*
					We must render each token using the cumulative styles of all parent tokens
					above it. So, we obtain the full path.
				*/
				currentBranch = state.tree.pathAt(state.pos);
				// The path is deepest-first - the bottom token is at 0.
				currentToken = currentBranch[0];
				
				/*
					If, say, the doc had no text in it, the currentToken would be null.
					In which case, quit early.
				*/
				if (!currentToken) {
					state.pos++;
					stream.next();
					return null;
				}
				/*
					Advance pos until the end of this token. This is determined by either:
					- the pos reaching the current token's end,
					- the currentToken's children suddenly appearing as the deepest
					token at the pos.
					- the pos reaching the line's end,
					currentToken.tokenAt() handles the first and second cases.
				*/
				while(currentToken === currentToken.tokenAt(state.pos)
						&& !stream.eol()) {
					state.pos++;
					stream.next();
				}
				if (stream.eol()) {
					state.pos++;
				}
				return currentBranch.reduce(function(a, e){
					var name = "harlowe-" + e.type,
						// If this name has been used earlier in the chain, suffix
						// this name with an additional number.
						count = ((a.split(name) || '').length);
					
					if (count > 1) {
						name += "-" + (count);
					}
					return a + name + " ";
				},'');
			},
		};
	});
	/*
		In order to provide styling to the Harlowe mode, CSS must be dynamically injected
		when the mode is defined. This is done now, by creating a <style> element with ID
		"cm-harlowe" and placing our CSS in it.
	*/
	/*
		If the style element already exists, it is reused. Otherwise, it's created.
		(Let's use pure DOM calls in the absence of a jQuery require() call.)
	*/
	harloweStyles = document.querySelector('style#cm-harlowe');
	if (!harloweStyles) {
		harloweStyles = document.createElement('style');
		harloweStyles.setAttribute('id','cm-harlowe');
		document.head.appendChild(harloweStyles);
	}
	/*
		This large function dynamically constructs a CSS string containing all of
		the styles used by the editor. Each property in the returned object indirectly maps to
		a CSS selector, and the value maps directly to CSS attributes assigned by the selector.
	*/
	harloweStyles.innerHTML = (function() {
		function nestedBG(h,s,l) {
			return function(e) {
				return "background-color: hsla(" + h + "," + s + "%," + l + "%," + e +");";
			};
		}
		var hookBG       = nestedBG(220, 100, 50),
			macro        = "color: #a84186;",
			macroName    = macro + "font-style:italic;",
			twineLink    = "color: #3333cc;",
			invalid      = "color: firebrick; background-color: lightsalmon;"
			;
		
		/*
			If a property includes commas, then it's a multiple-name selector.
			It will be converted to "[selector], [selector]" etc.
		*/
		return {
			hook:        hookBG(0.05),
			"hook-2":    hookBG(0.1),
			"hook-3":    hookBG(0.15),
			"hook-4":    hookBG(0.2),
			"hook-5":    hookBG(0.25),
			"hook-6":    hookBG(0.3),
			"hook-7":    hookBG(0.35),
			"hook-8":    hookBG(0.4),
			
			// The bottommost element is a hook
			"^=hook":    "font-weight:bold;",
			
			//TODO: whitespace within collapsed
			error:       invalid,
			
			macro:       macro,
			macroName:   macroName,
			
			// The bottommost element is a macro open/close bracket
			"^=macro ":    "font-weight:bold;",
			
			"bold, strong":
				"font-weight:bold;",
			"italic, em":
				"font-style:italic;",
			
			twineLink:   twineLink,
			tag:         "color: #4d4d9d;",
			
			boolean:     "color: #626262;",
			string:      "color: #008282;",
			number:      "color: #A15000;",
			variable:    "color: #005682;",
			hookRef:     "color: #007f54;",
			
			"property, belongingProperty":
				"color: #0076b2;",
			
			toString: function() {
				return Object.keys(this).reduce(function(a, e) {
					var selector;
					if (e === 'toString') {
						return a;
					}
					/*
						Comma-containing names are handled by splitting them here,
						and then re-joining them. If the property lacks a comma,
						then this merely creates an array of 1 element and runs .map()
						on that.
					*/
					selector = e.split(", ")
						/*
							This does a few things:
							- It adds the cm- CodeMirror prefix to the CSS classes.
							- It adds the harlowe- storyformat prefix as well.
							- It converts the keys to a selector (by consequence of the above)
							and the values to a CSS body.
						*/
						.map(function(e) {
							if (e.indexOf("^=") === 0) {
								return "[class^='cm-harlowe-" + e.slice(2) + "']";
							}
							return ".cm-harlowe-" + e;
						});
					return a + selector.join(', ') + "{" + this[e] + "}";
				}.bind(this), '');
			},
		}+"";
	}());
}.call(this));
