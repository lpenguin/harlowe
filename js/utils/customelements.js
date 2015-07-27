define([], () => {
	"use strict";
	/*
		Custom Elements
		
		This uses the draft Web Components specification (http://www.w3.org/TR/custom-elements/)
		and the document.register() function to define new semantic HTML elements for use in Twine 2.
		
		Browsers which do not support this will create HTMLUnknownElement elements.
		Thus, extending the prototypes of these elements isn't currently feasible (without a polyfill).
	*/
	if (!document.registerElement) {
		return;
	}
	const CustomElements = {};
	/*
		This is technically useless at the moment - not registering a custom element that has a conformant name
		(i.e. features a hyphen anywhere after the first character) will just mean that element uses HTMLElement.prototype.
		Nevertheless, this lays ground if the polyfill route is taken, and documents the custom elements used in Harlowe.
	*/
	(function register(name, ...props) {
		const
			proto = Object.create(HTMLElement.prototype),
			propDef = {};
		
		/*
			Load up the prototype with the passed properties
			while making them non-configurable, non-writable etc.
		*/
		props.forEach((p) => {
			propDef[p] = { value: null };
		});
		Object.defineProperties(proto,propDef);
		// Register the element!
		const el = document.registerElement(name, { prototype: proto });
		CustomElements[name] = el;
		return register;
	} // No semicolon - chained calls follow
	
	/*
		Elements created by Twine 2's IDE
	*/
	
	// Story data (display: none)
	// - storyname: the name.
	// - startnode: a passage ID denoting which to display on startup.
	// - creator: which application created this. Metadata only.
	// - creator-version: version number of the creator application. Metadata only.
	// - options: space-separated runtime options.
	('tw-storydata', 'storyname', 'startnode', 'creator', 'creator-version', 'options')
	('tw-passagedata', 'name', 'pid', 'position')
	('tw-story') // Stories (block)
	('tw-debugger') // The debug pane
	
	('tw-passage') // Passage (block)
	('tw-link', 'passage-name') // Internal link to another passage (inline)
	('tw-broken-link', 'passage-name') // Broken link
	
	// Expression instance (inline)
	// - name: Used only by debugmode.css.
	// - type: Can be "hookRef", "variable" or "macro".
	// - js: raw JS code to execute in order to evaluate this expr.
	// Classes:
	// .hook-macro: is a hook macro.
	// .false: name is "if" but it evaluated to false.
	// .error: a problem occurred while running.
	('tw-expression', 'type', 'name', 'js')
	('tw-sidebar') // Sidebar (block)
	('tw-icon') // Sidebar button (block)
	
	/*
		Style elements
	*/
	
	('tw-align') // Alignment (block)
	('tw-collapsed') // Collapsed whitespace area
	('tw-verbatim') // Verbatim text
	
	/*
		Structural elements
	*/
	
	// Hooks (inline)
	// - name: the name of the hook.
	// - source: the source that it should render, if it's not yet rendered.
	// Classes:
	// .link: Is a hook-link.
	('tw-hook', 'name', 'source')
	// Pseudo-hooks (inline)
	// Classes:
	// .link: Is a hook-link.
	('tw-pseudo-hook')
	('tw-transition-container') // Transition container (inline)
	
	/*
		Error elements
	*/
	('tw-error')
	('tw-error-explanation')
	('tw-error-explanation-button')
	('tw-notifier', 'message')
	);
	
	return Object.freeze(CustomElements);
});
