/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2013 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

/**
 * @property {String} (readOnly) objectType
 * @property {String} (readOnly) libraryKey
 * @property {String|null} parentKey Null if no parent
 * @property {Integer|false|undefined} parentID False if no parent. Undefined if not applicable (e.g. search objects)
 */

Zotero.DataObject = function () {
	let objectType = this._objectType;
	this._ObjectType = objectType[0].toUpperCase() + objectType.substr(1);
	this._objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
	
	this._id = null;
	this._libraryID = null;
	this._key = null;
	this._dateAdded = null;
	this._dateModified = null;
	this._version = null;
	this._synced = null;
	this._identified = false;
	
	this._loaded = {};
	for (let i=0; i<this._dataTypes.length; i++) {
		this._loaded[this._dataTypes[i]] = false;
	}
	
	this._clearChanged();
};

Zotero.DataObject.prototype._objectType = 'dataObject';
Zotero.DataObject.prototype._dataTypes = [];

Zotero.Utilities.Internal.defineProperty(Zotero.DataObject, 'objectType', {
	get: function() this._objectType
});
Zotero.Utilities.Internal.defineProperty(Zotero.DataObject, 'libraryKey', {
	get: function() this._libraryID + "/" + this._key
});
Zotero.Utilities.Internal.defineProperty(Zotero.DataObject, 'parentKey', {
	get: function() this._parentKey,
	set: function(v) this._setParentKey(v)
});
Zotero.Utilities.Internal.defineProperty(Zotero.DataObject, 'parentID', {
	get: function() this._getParentID(),
	set: function(v) this._setParentID(v)
});


Zotero.DataObject.prototype._get = function (field) {
	if (this['_' + field] !== null) {
		return this['_' + field];
	}
	this._requireData('primaryData');
	return null;
}


Zotero.DataObject.prototype._setIdentifier = function (field, value) {
	// If primary data is loaded, the only allowed identifier change is libraryID
	// (allowed mainly for the library switcher in the advanced search window),
	// and then only for unsaved objects (i.e., those without an id or key)
	if (this._loaded.primaryData) {
		if (field != 'libraryID' || this._id || this._key) {
			throw new Error("Cannot set " + field + " after object is already loaded");
		}
	}
	
	switch (field) {
	case 'id':
		if (this._key) {
			throw new Error("Cannot set id if key is already set");
		}
		value = Zotero.DataObjectUtilities.checkDataID(value);
		this._identified = true;
		break;
		
	case 'libraryID':
		value = Zotero.DataObjectUtilities.checkLibraryID(value);
		break;
		
	case 'key':
		if (this._libraryID === null) {
			throw new Error("libraryID must be set before key");
		}
		if (this._id) {
			throw new Error("Cannot set key if id is already set");
		}
		value = Zotero.DataObjectUtilities.checkKey(value);
		this._identified = true;
	}
	
	if (value === this['_' + field]) {
		return;
	}
	
	this['_' + field] = value;
}


/**
 * Get the id of the parent object
 *
 * @return {Integer|false|undefined}  The id of the parent object, false if none, or undefined
 *                                      on object types to which it doesn't apply (e.g., searches)
 */
Zotero.DataObject.prototype._getParentID = function () {
	if (this._parentID !== null) {
		return this._parentID;
	}
	if (!this._parentKey) {
		return false;
	}
	return this._parentID = this._getClass().getIDFromLibraryAndKey(this._libraryID, this._parentKey);
}


/**
 * Set the id of the parent object
 *
 * @param {Number|false} [id=false]
 * @return {Boolean} True if changed, false if stayed the same
 */
Zotero.DataObject.prototype._setParentID = function (id) {
	return this._setParentKey(
		id
		? this._getClass().getLibraryAndKeyFromID(Zotero.DataObjectUtilities.checkDataID(id))[1]
		: null
	);
}

/**
 * Set the key of the parent object
 *
 * @param {String|null} [key=null]
 * @return {Boolean} True if changed, false if stayed the same
 */
Zotero.DataObject.prototype._setParentKey = function(key) {
	key = Zotero.DataObjectUtilities.checkKey(key);
	
	if (this._parentKey == key) {
		return false;
	}
	this._markFieldChange('parentKey', this._parentKey);
	this._changed.parentKey = true;
	this._parentKey = key;
	this._parentID = null;
	return true;
}


/**
 * Returns all relations of the object
 *
 * @return {object} Object with predicates as keys and URI[], or URI (as string)
 *   in the case of a single object, as values
 */
Zotero.DataObject.prototype.getRelations = function () {
	this._requireData('relations');
	
	var relations = {};
	for (let i=0; i<this._relations.length; i++) {
		let relation = this._relations[i];
		
		// Relations are stored internally as predicate-object pairs
		let predicate = relation[0];
		if (relations[predicate]) {
			// If object with predicate exists, convert to an array
			if (typeof relations[predicate] == 'string') {
				relations[predicate] = [relations[predicate]];
			}
			// Add new object to array
			relations[predicate].push(relation[1]);
		}
		// Add first object as a string
		else {
			relations[predicate] = relation[1];
		}
	}
	return relations;
}


/**
 * Updates the object's relations
 *
 * @param {Object} newRelations Object with predicates as keys and URI[] as values
 * @return {Boolean} True if changed, false if stayed the same
 */
Zotero.DataObject.prototype.setRelations = function (newRelations) {
	this._requireData('relations');
	
	// There can be more than one object for a given predicate, so build
	// flat arrays with individual predicate-object pairs so we can use
	// array_diff to determine what changed
	var oldRelations = this._relations;
	
	var sortFunc = function (a, b) {
		if (a[0] < b[0]) return -1;
		if (a[0] > b[0]) return 1;
		if (a[1] < b[1]) return -1;
		if (a[1] > b[1]) return 1;
		return 0;
	};
	
	var newRelationsFlat = [];
	for (let predicate in newRelations) {
		let object = newRelations[predicate];
		for (let i=0; i<object.length; i++) {
			newRelationsFlat.push([predicate, object[i]]);
		}
	}
	
	var changed = false;
	if (oldRelations.length != newRelationsFlat.length) {
		changed = true;
	}
	else {
		oldRelations.sort(sortFunc);
		newRelationsFlat.sort(sortFunc);
		
		for (let i=0; i<oldRelations.length; i++) {
			if (oldRelations[i] != newRelationsFlat[i]) {
				changed = true;
				break;
			}
		}
	}
	
	if (!changed) {
		Zotero.debug("Relations have not changed for " + this._objectType + " " + this.libraryKey, 4);
		return false;
	}
	
	this._markFieldChange('relations', this._relations);
	this._changed.relations = true;
	// Store relations internally as array of predicate-object pairs
	this._relations = newRelationsFlat;
	return true;
}


/**
 * Return an object in the specified library equivalent to this object
 * @param {Integer} [libraryID=0]
 * @return {Object|false} Linked item, or false if not found
 */
Zotero.DataObject.prototype._getLinkedObject = Zotero.Promise.coroutine(function* (libraryID) {
	if (libraryID == this._libraryID) {
		throw new Error(this._ObjectType + " is already in library " + libraryID);
	}
	
	var predicate = Zotero.Relations.linkedObjectPredicate;
	var uri = Zotero.URI['get' + this._ObjectType + 'URI'](this);
	
	var links = yield Zotero.Promise.all([
		Zotero.Relations.getSubject(false, predicate, uri),
		Zotero.Relations.getObject(uri, predicate, false)
	]);
	links = links[0].concat(links[1]);
	
	if (!links.length) {
		return false;
	}
	
	if (libraryID) {
		var libraryObjectPrefix = Zotero.URI.getLibraryURI(libraryID) + "/" + this._objectTypePlural + "/";
	}
	else {
		var libraryObjectPrefix = Zotero.URI.getCurrentUserURI() + "/" + this._objectTypePlural + "/";
	}
	
	for (let i=0; i<links.length; i++) {
		let link = links[i];
		if (link.indexOf(libraryObjectPrefix) == 0) {
			var obj = yield Zotero.URI['getURI' + this._ObjectType](link);
			if (!obj) {
				Zotero.debug("Referenced linked " + this._objectType + " '" + link + "' not found "
					+ "in Zotero." + this._ObjectType + ".getLinked" + this._ObjectType + "()", 2);
				continue;
			}
			return obj;
		}
	}
	return false;
});


/**
 * Reloads loaded, changed data
 *
 * @param {String[]} [dataTypes] - Data types to reload, or all loaded types if not provide
 * @param {Boolean} [reloadUnchanged=false] - Reload even data that hasn't changed internally.
 *                                            This should be set to true for data that was
 *                                            changed externally (e.g., globally renamed tags).
 */
Zotero.DataObject.prototype.reload = Zotero.Promise.coroutine(function* (dataTypes, reloadUnchanged) {
	if (!this._id) {
		return;
	}
	
	if (!dataTypes) {
		dataTypes = Object.keys(this._loaded).filter(
			val => this._loaded[val]
		);
	}
	
	if (dataTypes && dataTypes.length) {
		for (let i=0; i<dataTypes.length; i++) {
			let dataType = dataTypes[i];
			if (!this._loaded[dataType] || (!reloadUnchanged && !this._changed[dataType])) {
				continue;
			}
			yield this._loadDataType(dataType, true);
		}
	}
});

/**
 * Checks wheteher a given data type has been loaded
 *
 * @param {String} [dataType=primaryData] Data type to check
 * @throws {Zotero.DataObjects.UnloadedDataException} If not loaded, unless the
 *   data has not yet been "identified"
 */
Zotero.DataObject.prototype._requireData = function (dataType) {
	if (this._loaded[dataType] === undefined) {
		throw new Error(dataType + " is not a valid data type for " + this._ObjectType + " objects");
	}
	
	if (dataType != 'primaryData') {
		this._requireData('primaryData');
	}
	
	if (!this._identified) {
		this._loaded[dataType] = true;
	}
	else if (!this._loaded[dataType]) {
		throw new Zotero.Exception.UnloadedDataException(
			"'" + dataType + "' not loaded for " + this._objectType + " ("
				+ this._id + "/" + this._libraryID + "/" + this._key + ")",
			dataType
		);
	}
}

/**
 * Returns a global Zotero class object given a data object. (e.g. Zotero.Items)
 * @return {obj} One of Zotero data classes
 */
Zotero.DataObject.prototype._getClass = function () {
	return Zotero.DataObjectUtilities.getClassForObjectType(this._objectType);
}

/**
 * Loads data for a given data type
 * @param {String} dataType
 * @param {Boolean} reload
 */
Zotero.DataObject.prototype._loadDataType = function (dataType, reload) {
	return this["load" + dataType[0].toUpperCase() + dataType.substr(1)](reload);
}


/**
 * Save old version of data that's being changed, to pass to the notifier
 * @param {String} field
 * @param {} oldValue
 */
Zotero.DataObject.prototype._markFieldChange = function (field, oldValue) {
	// Only save if object already exists and field not already changed
	if (!this.id || typeof this._previousData[field] != 'undefined') {
		return;
	}
	this._previousData[field] = oldValue;
}

/**
 * Clears log of changed values
 * @param {String} [dataType] data type/field to clear. Defaults to clearing everything
 */
Zotero.DataObject.prototype._clearChanged = function (dataType) {
	if (dataType) {
		delete this._changed[dataType];
		delete this._previousData[dataType];
	}
	else {
		this._changed = {};
		this._previousData = {};
	}
}

/**
 * Clears field change log
 * @param {String} field
 */
Zotero.DataObject.prototype._clearFieldChange = function (field) {
	delete this._previousData[field];
}

/**
 * Generates data object key
 * @return {String} key
 */
Zotero.DataObject.prototype._generateKey = function () {
	return Zotero.Utilities.generateObjectKey();
}
