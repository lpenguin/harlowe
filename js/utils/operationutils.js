define(['utils'], function(Utils) {
	"use strict";
	
	/*
		First, a quick shortcut to determine whether the
		given value is an object (i.e. whether the "in"
		operator can be used on a given value).
	*/
	function isObject(value) {
		return !!value && (typeof value === "object" || typeof value === "function");
	}
	
	/*
		Next, a quick function used for distinguishing the 3 types of collections
		native to TwineScript.
	*/
	function collectionType(value) {
		return Array.isArray(value) ? "array" :
			value instanceof Map ? "datamap" :
			value instanceof Set ? "dataset" : "object";
	}
	/*
		Next, a shortcut to determine whether a given value should have
		sequential collection functionality (e.g. Array, String, other stuff).
	*/
	function isSequential(value) {
		return typeof value === "string" || Array.isArray(value);
	}
	/*
		Now, a function to clone arbitrary values.
	*/
	function clone(value) {
		if (!isObject(value)) {
			return value;
		}
		/*
			If it has a custom TwineScript clone method, use that.
		*/
		if (typeof value.TwineScript_Clone === "function") {
			return value.TwineScript_Clone();
		}
		/*
			If it's an array, the old standby is on call.
		*/
		if (Array.isArray(value)) {
			return [].concat(value);
		}
		/*
			For ES6 collections, we can depend on the constructors.
		*/
		if (value instanceof Map) {
			return new Map(value);
		}
		if (value instanceof Set) {
			return new Set(value);
		}
		/*
			If it's a function, Function#bind() makes a copy without altering its 'this'.
		*/
		if (typeof value === "function") {
			return value.bind();
		}
		/*
			If it's a plain object or null object, you can rely on Object.assign().
		*/
		switch (Object.getPrototypeOf(value)) {
			case Object.prototype:
				return Object.assign({}, value);
			case null:
				return Object.assign(Object.create(null), value);
		}
		/*
			If we've gotten here, something unusual has been passed in.
			(If I allow ES6 Maps into Twine userland, I'd better change this function.)
		*/
		Utils.impossible("Operations.clone", "The value " + value + " cannot be cloned!");
		return value;
	}

	/*
		Some TwineScript objects can, in fact, be coerced to string.
		HookRefs, for instance, coerce to the string value of their first
		matching hook.
		
		(Will I pay for this later???)
		
		This returns the resulting string, or false if it couldn't be performed.
		@return {String|Boolean}
	*/
	function coerceToString(fn, left, right) {
		if (typeof left  === "string" && isObject(right) &&
				"TwineScript_ToString" in right) {
			return fn(left, right.TwineScript_ToString());
		}
		/*
			We can't really replace this case with a second call to
			canCoerceToString, passing (fn, right, left), because fn
			may not be symmetric.
		*/
		if (typeof right === "string" && isObject(left) &&
				"TwineScript_ToString" in left) {
			return fn(left.TwineScript_ToString(), right);
		}
		return false;
	}
	
	/*
		Most TwineScript objects have an ObjectName method which supplies a name
		string to the error message facilities.
		@return {String}
	*/
	function objectName(obj) {
		return (isObject(obj) && "TwineScript_ObjectName" in obj)
			? obj.TwineScript_ObjectName
			: Array.isArray(obj) ? "an array"
			: obj instanceof Map ? "a datamap"
			: obj instanceof Set ? "a dataset"
			: (typeof obj === "string" || typeof obj === "number") ? 'the ' + typeof obj + " " + Utils.toJSLiteral(obj)
			/*
				If it's a null-object, it can't be stringified with String().
			*/
			: Object.getPrototypeOf(Object(obj)) === null ? "a bare object"
			/*
				For ES6 symbol compatibility, we must use String(obj) here instead of obj + "".
				I don't actually expect symbols to enter the TwineScript userland, but better safe.
			*/
			: String(obj);
	}
	/*
		The TypeName method is also used to supply error messages relating to type signature
		checks. Generally, a TwineScript datatype prototype should be supplied to this function,
		compared to objectName, which typically should receive instances.
		
		Alternatively, for Javascript types, the global constructors String, Number, Boolean,
		Map, Set, and Array may be given.
		
		Finally, certain "type descriptor" objects are used by Macros, and take the form
			{ pattern: {String, innerType: {Array|Object|String} }
		and these should be warmly received as well.
		
		@return {String}
	*/
	function typeName(obj) {
		/*
			First, check for the "either" type descriptor.
		*/
		if (obj.innerType) {
			if (obj.pattern === "either") {
				Utils.assert(Array.isArray(obj.innerType));
				
				return obj.innerType.map(typeName).join(" or ");
			}
			else if (obj.pattern === "optional") {
				return "(an optional) " + typeName(obj.innerType);
			}
			return typeName(obj.innerType);
		}
		
		return (
			/*
				Second, if it's a global constructor, simply return its name in lowercase.
			*/
			(   obj === String ||
				obj === Number ||
				obj === Boolean)  ? "a "  + obj.name.toLowerCase()
			:  (obj === Map ||
				obj === Set)      ? "a data" + obj.name.toLowerCase()
			:   obj === Array     ? "an " + obj.name.toLowerCase()
			/*
				Otherwise, defer to the TwineScript_TypeName, or TwineScript_ObjectName
			*/
			: (isObject(obj) && "TwineScript_TypeName" in obj) ? obj.TwineScript_TypeName
			: objectName(obj)
		);
	}
	
	var OperationUtils = Object.freeze({
		isObject: isObject,
		collectionType: collectionType,
		isSequential: isSequential,
		clone: clone,
		coerceToString: coerceToString,
		objectName: objectName,
		typeName: typeName,
	});
	return OperationUtils;
});
