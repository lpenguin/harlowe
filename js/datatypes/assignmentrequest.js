define(['utils'], ({assert}) => {
	/*
		AssignmentRequests represent an assignment statement. Different
		macros may handle this request differently (for instance,
		a (remember:) macro may save the value to localStorage).
		
		They take a VarRef (a basic object with "object" and "propertyChain" properties)
		and do something to it with a value (which could be another VarRef, in case
		a macro wished to manipulate it somehow).
	*/
	"use strict";
	
	const assignmentRequest = Object.freeze({
		
		assignmentRequest: true,
		
		TwineScript_TypeName: "an assignment operation",
		TwineScript_ObjectName: "an assignment operation",
		
		TwineScript_Print() {
			return "[an assignment operation]";
		},
		
		create(dest, src, operator) {
			// Assert: dest is a varRef
			assert("propertyChain" in dest && "object" in dest);
			
			return Object.assign(Object.create(this), {
				dest:              dest,
				src:               src,
				operator:          operator,
			});
		},
		
		TwineScript_Clone() {
			return assignmentRequest.create(this.dest, this.src, this.operator);
		},
	});
	return assignmentRequest;
});
