define(['utils','state', 'internaltypes/twineerror', 'utils/operationutils'],
function(Utils, State, TwineError, OperationUtils) {
	'use strict';
	/*
		VarRefs are essentially objects pairing a chain of properties
		with an initial variable reference - "$red's blue's gold" would be
		a VarRef pairing $red with ["blue","gold"]. They represent variables
		in TwineScript code.
		Accessing variable values is compiled to a VarRef.get() call, setting
		them amounts to a VarRef.set() call made by the (set:) or (put:) macro,
		and deleting them amounts to a VarRef.delete() call.
	*/
	var
		/*
			In ES6, this would be a destructured assignment.
		*/
		isObject        = OperationUtils.isObject,
		isSequential    = OperationUtils.isSequential,
		objectName      = OperationUtils.objectName,
		collectionType  = OperationUtils.collectionType,
		clone           = OperationUtils.clone,
		/*
			The default defaultValue, used for all uninitialised properties
			and variables, is 0.
		*/
		defaultValue = 0;
	
	/*
		This converts a TwineScript property index into a JavaScript property indexing
		operation.
		
		While doing so, it checks if a property name is valid, and returns
		an error instead if it is not.
		@return {String|Error}
	*/
	function compilePropertyIndex(obj, prop) {
		var
			// Hoisted variables.
			match,
			error,
			// Cache this value for easy lookup.
			sequential = isSequential(obj);
		
		/*
			First, check for and propagate earlier errors.
		*/
		if((error = TwineError.containsError(obj, prop))) {
			return error;
		}
		/*
			The computed variable property syntax means that basically
			any value can be used as a property key. Currently, we only allow strings
			and numbers to be used.
			(This kind of defeats the point of (datamap:), though...
		*/
		if(typeof prop !== "string" && (!sequential || typeof prop !== "number")) {
			return TwineError.create(
				"property",
				"Only strings " + (sequential ? "and numbers " : "") +
				"can be used as property names for " + objectName(obj) + ", not " + objectName(prop) + "."
				);
		}
		/*
			This is to ensure that TwineScript properties are not exposed to userland code.
		*/
		if(typeof prop === "string" && prop.startsWith("TwineScript") && prop !== "TwineScript_Assignee") {
			return TwineError.create("property", "Only I can use data keys beginning with 'TwineScript'.");
		}
		/*
			Sequentials have special sugar property indices:
			
			length: this falls back to JS's length property for Arrays and Strings.
			1st, 2nd etc.: indices.
			last: antonym of 1st.
			2ndlast, 3rdlast: reverse indices.
		*/
		if (isSequential(obj)) {
			/*
				Number properties are treated differently from strings by sequentials:
				the number 1 is treated the same as the string "1st", and so forth.
			*/
			if (typeof prop === "number") {
				/*
					Since JS arrays are 0-indexed, we need only subtract 1 from prop
					to convert it to a JS property index.
				*/
				prop -= 1;
			}
			/*
				Given that prop is a string, convert "1st", "2ndlast", etc. into a number.
				Note that this glibly allows "1rd" or "2st".
				There's no real problem with this.
			*/
			else if ((match = /(\d+)(?:st|[nr]d|th)last/.exec(prop))) {
				/*
					obj.length cannot be trusted here: if it's an astral-plane
					string, then it will be incorrect. So, just pass a negative index
					and let Operations.get() do the work of offsetting it after it
					deals with the astral characters.
				*/
				prop = -match[1] + "";
			}
			else if ((match = /(\d+)(?:st|[nr]d|th)/.exec(prop))) {
				prop = match[1] - 1 + "";
			}
			else if (prop === "last") {
				prop = -1;
			}
			else if (prop !== "length") {
				return TwineError.create("property",
					"You can only use positions ('4th', 'last', '2ndlast', etc.) and 'length' with "
					+ objectName(obj) + ", not '" + prop + "'.");
			}
		}
		/*
			Sets, being essentially a limited kind of arrays, cannot have any
			property access other than 'length'.
		*/
		else if (obj instanceof Set) {
			if (prop !== "length") {
				return TwineError.create("property", "You can only get the 'length' of a "
					+ objectName(obj)
					+ ". To check contained values, use the 'contains' operator.");
			}
			/*
				This kludge must be used to pave over a little difference
				between Arrays and Sets.
			*/
			prop = "size";
		}
		return prop;
	}

	/*
		As Maps have a different means of accessing stored values
		than arrays, these tiny utility functions are needed.
		They have the slight bonus that they can fit into some .reduce() calls
		below, which potentially offsets the cost of being re-created for each varRef.
	*/
	function objectOrMapGet(obj, prop) {
		if (obj instanceof Map) {
			return obj.get(prop);
		} else {
			if (+prop < 0) {
				prop = obj.length + (+prop);
			}
			return obj[prop];
		}
	}
	/*
		This one should only return either undefined, or a TwineError.
	*/
	function objectOrMapSet(obj, prop, value) {
		var propDesc;
		
		if (obj instanceof Map) {
			/*
				The "sealed" expando property means that this map cannot be
				expanded (presumably because it's a system variable).
			*/
			if (obj.sealed && !obj.has(prop)) {
				return TwineError.create("operation", "I won't add '" + prop
					+ "' to " + objectName(obj)
					+ " because it's one of my special system collections.");
			}
			return obj.set(prop, value);
		} else {
			if (+prop < 0) {
				prop = obj.length + (+prop);
			}
			/*
				As sequentials have limited valid property names, subject
				the prop to some further examination.
			*/
			if (isSequential(obj)) {
				/*
					Unlike in JavaScript, you can't change the length of
					an array or string - it's fixed.
				*/
				if(prop === "length") {
					return TwineError.create(
						"operation",
						"I can't forcibly alter the length of " + objectName(obj) + "."
					);
				}
			}
			/*
				If the object is sealed and the property doesn't exist,
				or a same named property on the prototype chain is non-writable,
				then we can't set it at all.
			*/
			propDesc = Utils.getInheritedPropertyDescriptor(obj,prop);
			
			if (!propDesc ? Object.isSealed(obj) : propDesc.writable === false) {
				return TwineError.create(
					"operation",
					"I can't alter the '" + prop + "' data because it's read-only."
				);
			}
			obj[prop] = value;
		}
	}
	
	/*
		The prototype object for VarRefs.
	*/
	var VarRefProto = Object.freeze({
		varref: true,
		
		/*
			Get to the farthest object in the chain, by advancing through all
			but the last part of the chain (which must be withheld and used
			for the assignment operation).
		*/
		get deepestObject() {
			return this.propertyChain.slice(0, -1).reduce(objectOrMapGet, this.object);
		},
		
		/*
			Shortcut to the final property from the chain.
		*/
		get deepestProperty() {
			return this.propertyChain.slice(-1)[0];
		},
		
		/*
			A wrapper around Javascript's [[get]], which
			returns an error if a property is absent rather than
			returning undefined. (Or, in the case of State.variables,
			uses a default value instead of returning the error.)
			
			@method get
			@return {Error|Anything}
		*/
		get: function() {
			var obj = this.deepestObject,
				prop = this.deepestProperty,
				/*
					We save the value of prop, so that it can be used in an error message
					even after it's been compiled into a real property index.
				*/
				oldProp = prop;
			
			if (obj === null || obj === undefined) {
				return TwineError.create("property",
					"I can't get a property named '"
					+ prop
					+ "' from "
					+ typeof obj
					+ "."
				);
			}
			/*
				Compile the property index - returning the error if
				one was produced during compilation.
			*/
			prop = compilePropertyIndex(obj, prop);
			if (TwineError.containsError(prop)) {
				return prop;
			}
			/*
				Due to Javascript's regrettable use of UCS-2 for string access,
				astral plane glyphs won't be correctly regarded as single characters,
				unless the following kludge is employed, using ES6 methods.
			*/
			if (typeof obj === "string") {
				obj = Array.from(obj);
			}
			/*
				From this point on, after doing that conversion, obj's JS length can be trusted.
				So, negative indices passed into here can now be converted to proper JS indices.
			*/
			if (isSequential(obj) && +prop < 0) {
				prop = obj.length + (+prop);
			}
			/*
				An additional error condition exists for get(): if the property
				doesn't exist, don't just return undefined.
				
				I wanted to use hasOwnProperty here, but it didn't work
				with the State.variables object, which, as you know, uses
				differential properties on the prototype chain. Oh well,
				it's probably not that good an idea anyway.
			*/
			if ((obj instanceof Map)
					? !obj.has(prop)
					/*
						Notice that the 'in' operator fails on primitives, so
						Object(obj) must be used.
					*/
					: !(prop in Object(obj))) {
				/*
					If the property is actually a State.variables access,
					then it's a variable, and uses the defaultValue in place
					of undefined.
				*/
				if (obj === State.variables) {
					return defaultValue;
				}
				return TwineError.create("property", "I can't find a '" + oldProp + "' data key in "
					+ objectName(obj));
			}
			return (obj instanceof Map) ? obj.get(prop) : obj[prop];
		},
		
		set: function(value) {
			var result, assignedObj,
				/*
					Compile the property index - returning the error if
					one was produced during compilation.
				*/
				prop = compilePropertyIndex(this.deepestObject, this.deepestProperty);
			
			if (TwineError.containsError(prop)) {
				return prop;
			}
			/*
				If value has a TwineScript_AssignValue() method
				(i.e. is a HookSet) then its returned value is used
				instead of copying over the object itself.
			*/
			if (value && value.TwineScript_AssignValue) {
				value = value.TwineScript_AssignValue();
			}
			/*
				Most all objects in TwineScript are passed by value.
				Hence, setting to an object duplicates it.
			*/
			if (isObject(value)) {
				value = clone(value);
			}
			result = objectOrMapSet(this.deepestObject, prop, value);
			
			if (!TwineError.containsError(result)) {
				/*
					Tag the object with a TwineScript_ObjectName, which is used
					for providing more informative error messages involving
					this piece of data.
				*/
				if (this.deepestObject instanceof Map) {
					assignedObj = this.deepestObject.get(prop);
				}
				else {
					assignedObj = this.deepestObject[prop];
				}
				/*
					Obviously, only non-primitives can be given this expando property.
				*/
				if (isObject(assignedObj)) {
					assignedObj.TwineScript_ObjectName
						= objectName(assignedObj) + " stored in '" + this.deepestProperty + "'";
				}
			}
			return result;
		},
		
		/*
			A wrapper around Javascript's delete operation, which
			returns an error if the deletion failed, and also removes holes in
			arrays caused by the deletion.
		*/
		delete: function() {
			var obj = this.deepestObject,
				prop = this.deepestProperty;
			/*
				If it's an array, and the prop is an index,
				we should remove the item in-place without creating a hole.
			*/
			if (Array.isArray(obj) && OperationUtils.numericIndex.exec(prop)) {
				obj.splice(prop, 1);
				return;
			}
			/*
				If it's a Map or Set, use the delete() method.
			*/
			if (obj instanceof Map || obj instanceof Set) {
				obj.delete(prop);
				return;
			}
			if (!delete obj[prop]) {
				return TwineError.create("property",
					"I couldn't delete '"
					+ prop
					+ "' from "
					+ objectName(obj)
					+ "."
				);
			}
		},
		
		create: function(object, propertyChain) {
			var ret;
			
			/*
				Create the VarRefProto instance.
			*/
			ret =  Object.assign(Object.create(VarRefProto), {
				object: object,
				/*
					The propertyChain argument can be an arrays of strings, and single strings.
					So, convert a single passed string to an array of itself.
				*/
				propertyChain: [].concat(propertyChain),
			});
			return ret;
		},
		
		TwineScript_ObjectName: "a variable I'm trying to assign a value to"
	});
	
	return VarRefProto;
});
