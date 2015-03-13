define(['jquery', 'utils'], function($, Utils) {
	"use strict";
	/*
		TwineNotifiers are special debug notifications created by the TwineScript runtime in debug mode.
		They are used to signify when a special event has occurred.
	*/
	
	var TwineNotifier = {
		
		create: function(message) {
			if (!message) {
				Utils.impossible("TwineNotifier.create", "called with only 1 string.");
			}
			return Object.assign(Object.create(TwineNotifier), {
				message: message
			});
		},
		
		render: function() {
			return $("<tw-notifier>" + Utils.escape(this.message) + "</tw-notifier>");
		},
	};
	return TwineNotifier;
});
