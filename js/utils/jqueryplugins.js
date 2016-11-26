"use strict";
define(['jquery'], ($) => {
	
	$.prototype.extend({
		/*
			popAttr: returns an attribute while removing it. Accepts only 1 argument.
		*/
		popAttr(attr) {
			const ret = this.attr(attr);
			this.removeAttr(attr);
			return ret;
		},
		/*
			popAttr: return data while removing it. Accepts only 1 argument.
		*/
		popData(name) {
			const ret = this.data(name);
			this.removeData(name);
			return ret;
		},
		/*
			tag: returns the **lowercase** tag name of the first matched element.
			This is only a getter.
		*/
		tag() {
			return this[0] && this[0].tagName && this[0].tagName.toLowerCase();
		},
		/*
			This slightly complicated procedure is necessary to select all
			descendent text nodes.
			This returns a sorted Array, not a jQuery.
		*/
		textNodes() {
			/*
				Base case: this collection contains a single text node.
			*/
			if (this.length === 1 && this[0] instanceof Text) {
				return [this[0]];
			}
			/*
				First, create an array containing all descendent and contents nodes
				which are text nodes.
			*/
			return Array.from(this.add(this.contents().add(this.find('*').contents())).filter(function() {
				return this instanceof Text;
			}))
			/*
				the addBack() call adds back the descendents in an unwanted order, so we must
				sort the returned array using compareDocumentPosition.
			*/
			.sort((left, right) => (left.compareDocumentPosition(right)) & 2 ? 1 : -1);
		},
		
		/*
			Both of these navigates up the tree to find the nearest text node outside this element,
			earlier or later in the document.
			These return an unwrapped Text node, not a jQuery.
		*/
		prevTextNode() {
			const elem = this.first()[0],
				parent = this.parent();
			/*
				Quit early if there's no parent.
			*/
			if (!parent.length) {
				return null;
			}
			/*
				Get the parent's text nodes, and obtain only the last one which is
				earlier (or later, depending on positionBitmask) than this element.
			*/
			let textNodes = parent.textNodes().filter((e) => {
				const pos = e.compareDocumentPosition(elem);
				return pos & 4 && !(pos & 8);
			});
			textNodes = textNodes[textNodes.length-1];
			/*
				If no text nodes were found, look higher up the tree, to the grandparent.
			*/
			return !textNodes ? parent.prevTextNode() : textNodes;
		},
		
		nextTextNode() {
			const elem = this.last()[0],
				parent = this.parent();
			/*
				Quit early if there's no parent.
			*/
			if (!parent.length) {
				return null;
			}
			/*
				Get the parent's text nodes, and obtain only the last one which is
				earlier (or later, depending on positionBitmask) than this element.
			*/
			const textNodes = parent.textNodes().filter((e) => {
				const pos = e.compareDocumentPosition(elem);
				return pos & 2 && !(pos & 8);
			})[0];
			/*
				If no text nodes were found, look higher up the tree, to the grandparent.
			*/
			return !textNodes ? parent.nextTextNode() : textNodes;
		},
	});
});
