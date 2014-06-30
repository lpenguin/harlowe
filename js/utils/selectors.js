define([], function() {
	"use strict";
	/*
		Static namespace containing CSS/jQuery selectors for Harlowe DOM elements
	*/
	return Object.freeze({
		passage: "tw-passage",
		story: "tw-story",
		sidebar: "tw-sidebar",
		charSpan: "tw-char, br",
		internalLink: "tw-link",
		brokenLink: "tw-broken-link",
		hook: "tw-hook",
		pseudoHook: "tw-pseudo-hook",
		expression: "tw-expression",
		enchanter: "[enchanter]",
		script: "[data-role=script]",
		stylesheet: "[data-role=stylesheet]",
		storyData: "tw-storydata",
		passageData: "tw-passagedata"
	});
});
