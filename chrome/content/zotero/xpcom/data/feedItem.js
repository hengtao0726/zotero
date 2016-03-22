/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2015 Center for History and New Media
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


/*
 * Constructor for FeedItem object
 */
Zotero.FeedItem = function(itemTypeOrID, params = {}) {
	Zotero.FeedItem._super.call(this, itemTypeOrID);
	
	this._feedItemReadTime = null;
	
	Zotero.Utilities.assignProps(this, params, ['guid']);
};

Zotero.extendClass(Zotero.Item, Zotero.FeedItem);

Zotero.FeedItem.prototype._objectType = 'feedItem';
Zotero.FeedItem.prototype._containerObject = 'feed';

Zotero.defineProperty(Zotero.FeedItem.prototype, 'isFeedItem', {
	value: true
});

Zotero.defineProperty(Zotero.FeedItem.prototype, 'guid', {
	get: function() this._feedItemGUID,
	set: function(val) {
		if (this.id) throw new Error('Cannot set GUID after item ID is already set');
		if (typeof val != 'string') throw new Error('GUID must be a non-empty string');
		this._feedItemGUID = val;
	}
});

Zotero.defineProperty(Zotero.FeedItem.prototype, 'isRead', {
	get: function() {
		return !!this._feedItemReadTime;
	},
	set: function(read) {
		if (!read != !this._feedItemReadTime) {
			// changed
			if (read) {
				this._feedItemReadTime = Zotero.Date.dateToSQL(new Date(), true);
			} else {
				this._feedItemReadTime = null;
			}
			this._changed.feedItemData = true;
		}
	}
});
//
//Zotero.defineProperty(Zotero.FeedItem.prototype, 'isTranslated', {
//	get: function() {
//		return !!this._feedItemTranslationTime;
//	}, 
//	set: function(state) {
//		if (state != !!this._feedItemTranslationTime) {
//			if (state) {
//				this._feedItemTranslationTime = Zotero.Date.dateToSQL(new Date(), true);
//			} else {
//				this._feedItemTranslationTime = null;
//			}
//			this._changed.feedItemData = true;
//		}
//	}
//});

Zotero.FeedItem.prototype.loadPrimaryData = Zotero.Promise.coroutine(function* (reload, failOnMissing) {
	if (this.guid && !this.id) {
		// fill in item ID
		this.id = yield this.ObjectsClass.getIDFromGUID(this.guid);
	}
	yield Zotero.FeedItem._super.prototype.loadPrimaryData.apply(this, arguments);
});

Zotero.FeedItem.prototype.setField = function(field, value) {
	if (field == 'libraryID') {
		// Ensure that it references a feed
		if (!Zotero.Libraries.get(value).isFeed) {
			throw new Error('libraryID must reference a feed');
		}
	}
	
	return Zotero.FeedItem._super.prototype.setField.apply(this, arguments);
}

Zotero.FeedItem.prototype.fromJSON = function(json) {
	// Handle weird formats in feedItems
	let dateFields = ['accessDate', 'dateAdded', 'dateModified'];
	for (let dateField of dateFields) {
		let val = json[dateField];
		if (val) {
			let d = new Date(val);
			if (isNaN(d.getTime())) {
				d = Zotero.Date.sqlToDate(val, true);
			}
			if (!d || isNaN(d.getTime())) {
				d = Zotero.Date.strToDate(val);
				d = new Date(d.year, d.month, d.day);
				Zotero.debug(dateField + " " + JSON.stringify(d), 1);
			}
			if (!d) {
				Zotero.logError("Discarding invalid " + field + " '" + val
					+ "' for item " + this.libraryKey);
				delete json[dateField];
				continue;
			}
			json[dateField] = d.toISOString();
		}
	}
	Zotero.FeedItem._super.prototype.fromJSON.apply(this, arguments);
}

Zotero.FeedItem.prototype._initSave = Zotero.Promise.coroutine(function* (env) {
	if (!this.guid) {
		throw new Error('GUID must be set before saving ' + this._ObjectType);
	}
	
	let proceed = yield Zotero.FeedItem._super.prototype._initSave.apply(this, arguments);
	if (!proceed) return proceed;
	
	if (env.isNew) {
		// verify that GUID doesn't already exist for a new item
		var item = yield this.ObjectsClass.getIDFromGUID(this.guid);
		if (item) {
			throw new Error('Cannot create new item with GUID ' + this.guid + '. Item already exists.');
		}
		
		// Register GUID => itemID mapping in cache on commit
		if (!env.transactionOptions) env.transactionOptions = {};
		var superOnCommit = env.transactionOptions.onCommit;
		env.transactionOptions.onCommit = () => {
			if (superOnCommit) superOnCommit();
			this.ObjectsClass._setGUIDMapping(this.guid, env.id);
		};
	}
	
	return proceed;
});

Zotero.FeedItem.prototype.forceSaveTx = function(options) {
	let newOptions = {};
	Object.assign(newOptions, options || {});
	newOptions.skipEditCheck = true;
	return this.saveTx(newOptions);
}

Zotero.FeedItem.prototype.save = function(options = {}) {
	options.skipDateModifiedUpdate = true;
	return Zotero.FeedItem._super.prototype.save.apply(this, arguments)
}

Zotero.FeedItem.prototype._saveData = Zotero.Promise.coroutine(function* (env) {
	yield Zotero.FeedItem._super.prototype._saveData.apply(this, arguments);
	
	if (this._changed.feedItemData || env.isNew) {
		var sql = "REPLACE INTO feedItems VALUES (?,?,?)";
		yield Zotero.DB.queryAsync(sql, [env.id, this.guid, this._feedItemReadTime]);
		
		this._clearChanged('feedItemData');
	}
});

Zotero.FeedItem.prototype.toggleRead = Zotero.Promise.coroutine(function* (state) {
	state = state !== undefined ? !!state : !this.isRead;
	let changed = this.isRead != state;
	if (changed) {
		this.isRead = state;
		yield this.saveTx({skipEditCheck: true, skipDateModifiedUpdate: true});
		
		let feed = Zotero.Feeds.get(this.libraryID);
		yield feed.updateUnreadCount();
	}
});

Zotero.FeedItem.prototype.forceEraseTx = function(options) {
	let newOptions = {};
	Object.assign(newOptions, options || {});
	newOptions.skipEditCheck = true;
	return this.eraseTx(newOptions);
};

/**
 * Uses the item url to translate an existing feed item.
 * If libraryID empty, overwrites feed item, otherwise saves
 * in the library
 * @param libraryID {int} save item in library
 * @param collectionID {int} add item to collection
 * @return {Promise<FeedItem|Item>} translated feed item
 */
Zotero.FeedItem.prototype.translate = Zotero.Promise.coroutine(function* (libraryID, collectionID) {
	let deferred = Zotero.Promise.defer();
	let error = function(e) { Zotero.debug(e, 1); deferred.reject(e); };
	
	// Load document
	let hiddenBrowser = Zotero.HTTP.processDocuments(
		this.getField('url'), 
		(item) => deferred.resolve(item),
		()=>{}, error, true
	);
	let doc = yield deferred.promise;

	// Set translate document
	let translate = new Zotero.Translate.Web();
	translate.setDocument(doc);
	
	// Load translators
	deferred = Zotero.Promise.defer();
	translate.setHandler('translators', (me, translators) => deferred.resolve(translators));
	translate.getTranslators();
	let translators = yield deferred.promise;
	if (! translators || !translators.length) {
		Zotero.debug("No translators detected for FeedItem " + this.id + " with url " + this.getField('url'), 2);
		throw new Zotero.Error("No translators detected for FeedItem " + this.id + " with url " + this.getField('url'))
	}
	translate.setTranslator(translators[0]);

	deferred = Zotero.Promise.defer();
	
	if (libraryID) {
		return translate.translate({libraryID, collections: collectionID ? [collectionID] : false})
			.then(items => items ? items[0] : false);
	}
	
	// Clear these to prevent saving
	translate.clearHandlers('itemDone');
	translate.clearHandlers('itemsDone');
	translate.setHandler('error', error);
	translate.setHandler('itemDone', (_, items) => deferred.resolve(items));
	
	translate.translate({libraryID: false, saveAttachments: false});
	
	let itemData = yield deferred.promise;
	Zotero.Browser.deleteHiddenBrowser(hiddenBrowser);
	
	// clean itemData
	const deleteFields = ['attachments', 'notes', 'id', 'itemID', 'path', 'seeAlso', 'version', 'dateAdded', 'dateModified'];
	for (let field of deleteFields) {
		delete itemData[field];
	}
	// TODO: handle no items like the ones in french history studies feed
	// set new translated data for item
	this.fromJSON(itemData);
	this.forceSaveTx();
	
	return this;
});
