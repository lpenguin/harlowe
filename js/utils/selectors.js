define([], () => {
	"use strict";
	/*
		Static namespace containing CSS/jQuery selectors for Harlowe DOM elements
	*/
	return Object.freeze({
		passage     : "tw-passage",
		story       : "tw-story",
		sidebar     : "tw-sidebar",
		internalLink: "tw-link",
		brokenLink  : "tw-broken-link",
		hook        : "tw-hook",
		anonymousHook : "tw-hook:not([name])",
		pseudoHook  : "tw-pseudo-hook",
		enchantment : "tw-enchantment",
		expression  : "tw-expression",
		script      : "[role=script]",
		stylesheet  : "[role=stylesheet]",
		storyData   : "tw-storydata",
		passageData : "tw-passagedata",
		collapsed   : "tw-collapsed",
	});
});
