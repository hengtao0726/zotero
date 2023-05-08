describe("Item pane", function () {
	var win, doc, itemsView;
	
	before(function* () {
		win = yield loadZoteroPane();
		doc = win.document;
		itemsView = win.ZoteroPane.itemsView;
	});
	after(function () {
		win.close();
	});
	
	describe("Info pane", function () {
		it("should refresh on item update", function* () {
			var item = new Zotero.Item('book');
			var id = yield item.saveTx();
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var label = itemBox.querySelectorAll('[fieldname="title"]')[1];
			assert.equal(label.textContent, '');
			
			item.setField('title', 'Test');
			yield item.saveTx();
			
			label = itemBox.querySelectorAll('[fieldname="title"]')[1];
			assert.equal(label.textContent, 'Test');
			
			yield Zotero.Items.erase(id);
		})
		
		
		it("should swap creator names", async function () {
			var item = new Zotero.Item('book');
			item.setCreators([
				{
					firstName: "First",
					lastName: "Last",
					creatorType: "author"
				}
			]);
			await item.saveTx();
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var label = itemBox.querySelector('[fieldname="creator-0-lastName"]')
			var parent = label.parentNode;
			assert.property(parent, 'oncontextmenu');
			assert.isFunction(label.parentNode.oncontextmenu);
			
			var menupopup = itemBox.querySelector('#zotero-creator-transform-menu');
			// Fake a right-click
			doc.popupNode = parent;
			menupopup.openPopup(
				parent, "after_start", 0, 0, true, false, new MouseEvent('click', { button: 2 })
			);
			var menuitem = menupopup.getElementsByTagName('menuitem')[0];
			menuitem.click();
			await waitForItemEvent('modify');
			
			var creator = item.getCreators()[0];
			assert.propertyVal(creator, 'firstName', 'Last');
			assert.propertyVal(creator, 'lastName', 'First');
		});
		
		
		it("shouldn't show Swap Names option for single-field mode", async function () {
			var item = new Zotero.Item('book');
			item.setCreators([
				{
					name: "Name",
					creatorType: "author"
				}
			]);
			await item.saveTx();
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var label = itemBox.querySelector('[fieldname="creator-0-lastName"]')
			var firstlast = label.closest('.creator-name-box');
			firstlast.oncontextmenu(new MouseEvent('click', { bubbles: true, button: 2 }));
			
			var menuitem = doc.getElementById('creator-transform-swap-names');
			assert.isTrue(menuitem.hidden);
		});
		
		
		// Note: This issue applies to all context menus in the item box (text transform, name swap),
		// though the others aren't tested. This might go away with the XUL->HTML transition.
		it.skip("should save open field after changing creator type", function* () {
			var item = new Zotero.Item('book');
			item.setCreators([
				{
					firstName: "First",
					lastName: "Last",
					creatorType: "author"
				}
			]);
			var id = yield item.saveTx();
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var label = itemBox.querySelector('[fieldname="place"]');
			label.click();
			var textbox = itemBox.querySelector('[fieldname="place"]');
			textbox.value = "Place";
			
			var menuLabel = itemBox.querySelector('[fieldname="creator-0-typeID"]');
			menuLabel.click();
			var menupopup = itemBox._creatorTypeMenu;
			var menuItems = menupopup.getElementsByTagName('menuitem');
			menuItems[1].click();
			yield waitForItemEvent('modify');
			
			assert.equal(item.getField('place'), 'Place');
			assert.equal(Zotero.CreatorTypes.getName(item.getCreators()[0].creatorTypeID), 'contributor');
			
			// Wait for no-op saveTx()
			yield Zotero.Promise.delay(1);
		});
		
		it("should accept 'now' for Accessed", async function () {
			var item = await createDataObject('item');
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var label = itemBox.querySelector('div[fieldname="accessDate"].zotero-clicky');
			label.click();
			var textbox = itemBox.querySelector('input[fieldname="accessDate"]');
			textbox.value = 'now';
			// Blur events don't necessarily trigger if window doesn't have focus
			itemBox.hideEditor(textbox);
			
			await waitForItemEvent('modify');
			
			assert.approximately(
				Zotero.Date.sqlToDate(item.getField('accessDate'), true).getTime(),
				Date.now(),
				5000
			);
		});

		it("should persist fieldMode after hiding a creator name editor", async function () {
			let item = new Zotero.Item('book');
			item.setCreators([
				{
					name: "First Last",
					creatorType: "author",
					fieldMode: 1
				}
			]);
			await item.saveTx();
			
			let itemBox = doc.getElementById('zotero-editpane-item-box');

			itemBox.querySelector('div[fieldname="creator-0-lastName"]').click();
			itemBox.hideEditor(itemBox.querySelector('input[fieldname="creator-0-lastName"]'));
			
			assert.equal(
				itemBox.querySelector('div[fieldname="creator-0-lastName"]').getAttribute('fieldMode'),
				'1'
			);
		});
	})
	
	
	describe("Notes pane", function () {
		it("should refresh on child note change", function* () {
			var item;
			var note1;
			var note2;
			yield Zotero.DB.executeTransaction(async function () {
				item = createUnsavedDataObject('item');
				await item.save();
				
				note1 = new Zotero.Item('note');
				note1.parentID = item.id;
				note1.setNote('A');
				await note1.save();
				
				note2 = new Zotero.Item('note');
				note2.parentID = item.id;
				note2.setNote('B');
				await note2.save();
			});
			
			var tabs = doc.getElementById('zotero-editpane-tabs');
			var notesTab = doc.getElementById('zotero-editpane-notes-tab');
			var grid = doc.querySelector('#zotero-editpane-notes #notes-grid');
			tabs.selectedItem = notesTab;
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (grid.querySelectorAll('div.box > label').length !== 2);
			
			// Update note text
			note2.setNote('C');
			yield note2.saveTx();
			
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while ([...grid.querySelectorAll('div.box > label')].every(label => label.textContent != 'C'));
		});
		
		it("should refresh on child note trash", function* () {
			var item;
			var note1;
			var note2;
			yield Zotero.DB.executeTransaction(async function () {
				item = createUnsavedDataObject('item');
				await item.save();
				
				note1 = new Zotero.Item('note');
				note1.parentID = item.id;
				note1.setNote('A');
				await note1.save();
				
				note2 = new Zotero.Item('note');
				note2.parentID = item.id;
				note2.setNote('B');
				await note2.save();
			});
			
			var tabs = doc.getElementById('zotero-editpane-tabs');
			var notesTab = doc.getElementById('zotero-editpane-notes-tab');
			var grid = doc.querySelector('#zotero-editpane-notes #notes-grid');
			tabs.selectedItem = notesTab;
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (grid.querySelectorAll('div.box > label').length !== 2);
			
			// Click "-" in first note
			var promise = waitForDialog();
			grid.querySelector(".zotero-clicky-minus").click();
			yield promise;
			
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (grid.querySelectorAll('div.box > label').length !== 1);
		});
		
		it("should refresh on child note delete", function* () {
			var item;
			var note1;
			var note2;
			yield Zotero.DB.executeTransaction(async function () {
				item = createUnsavedDataObject('item');
				await item.save();
				
				note1 = new Zotero.Item('note');
				note1.parentID = item.id;
				note1.setNote('A');
				await note1.save();
				
				note2 = new Zotero.Item('note');
				note2.parentID = item.id;
				note2.setNote('B');
				await note2.save();
			});
			
			var tabs = doc.getElementById('zotero-editpane-tabs');
			var notesTab = doc.getElementById('zotero-editpane-notes-tab');
			var grid = doc.querySelector('#zotero-editpane-notes #notes-grid');
			tabs.selectedItem = notesTab;
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (grid.querySelectorAll('div.box > label').length !== 2);
			
			yield note2.eraseTx();
			
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (grid.querySelectorAll('div.box > label').length !== 1);
		});
	});
	
	
	describe("Attachment pane", function () {
		it("should refresh on file rename", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			var newName = 'test2.png';
			yield item.renameAttachmentFile(newName);
			
			var itemBox = doc.getElementById('zotero-attachment-box');
			var label = itemBox._id('fileName');
			assert.equal(label.value, newName);
		})
		
		it("should update on attachment title change", async function () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = await Zotero.Attachments.importFromFile({ file });
			var newTitle = 'New Title';
			item.setField('title', newTitle);
			await item.saveTx();
			
			var itemBox = doc.getElementById('zotero-attachment-box');
			var label = itemBox._id('title');
			assert.equal(label.textContent, newTitle);
		})
	})
	
	
	describe("Note editor", function () {
		it("should refresh on note update", function* () {
			var item = new Zotero.Item('note');
			var id = yield item.saveTx();
			
			var noteEditor = doc.getElementById('zotero-note-editor');
			
			// Wait for the editor
			yield new Zotero.Promise((resolve, reject) => {
				noteEditor.onInit(() => resolve());
			});
			assert.equal(noteEditor._editorInstance._iframeWindow.wrappedJSObject.getDataSync(), null);
			item.setNote('<p>Test</p>');
			yield item.saveTx();
			
			// Wait for asynchronous editor update
			do {
				yield Zotero.Promise.delay(10);
			} while (
				!/<div data-schema-version=".*"><p>Test<\/p><\/div>/.test(
					noteEditor._editorInstance._iframeWindow.wrappedJSObject.getDataSync().html.replace(/\n/g, '')
				)
			);
		});
	});
	
	describe("Feed buttons", function() {
		describe("Mark as Read/Unread", function() {
			it("should update label when state of an item changes", function* () {
				let feed = yield createFeed();
				yield selectLibrary(win, feed.libraryID);
				yield waitForItemsLoad(win);
				
				var stub = sinon.stub(win.ZoteroPane, 'startItemReadTimeout');
				var item = yield createDataObject('feedItem', { libraryID: feed.libraryID });
				// Skip timed mark-as-read
				assert.ok(stub.called);
				stub.restore();
				item.isRead = true;
				yield item.saveTx();
				
				let button = doc.getElementById('zotero-feed-item-toggleRead-button');
				
				assert.equal(button.textContent, Zotero.getString('pane.item.markAsUnread'));
				yield item.toggleRead(false);
				assert.equal(button.textContent, Zotero.getString('pane.item.markAsRead'));
			});
		});
	});
	
	describe("Duplicates Merge pane", function () {
		// Same as test in itemsTest, but via UI, which makes a copy via toJSON()/fromJSON()
		it("should transfer merge-tracking relations when merging two pairs into one item", async function () {
			var item1 = await createDataObject('item', { title: 'A' });
			var item2 = await createDataObject('item', { title: 'B' });
			var item3 = await createDataObject('item', { title: 'C' });
			var item4 = await createDataObject('item', { title: 'D' });
			
			var uris = [item2, item3, item4].map(item => Zotero.URI.getItemURI(item));
			
			var p;
			
			var zp = win.ZoteroPane;
			await zp.selectItems([item1.id, item2.id]);
			zp.mergeSelectedItems();
			p = waitForItemEvent('modify');
			doc.getElementById('zotero-duplicates-merge-button').click();
			await p;
			
			assert.sameMembers(
				item1.getRelations()[Zotero.Relations.replacedItemPredicate],
				[uris[0]]
			);
			
			await zp.selectItems([item3.id, item4.id]);
			zp.mergeSelectedItems();
			p = waitForItemEvent('modify');
			doc.getElementById('zotero-duplicates-merge-button').click();
			await p;
			
			assert.sameMembers(
				item3.getRelations()[Zotero.Relations.replacedItemPredicate],
				[uris[2]]
			);
			
			await zp.selectItems([item1.id, item3.id]);
			zp.mergeSelectedItems();
			p = waitForItemEvent('modify');
			doc.getElementById('zotero-duplicates-merge-button').click();
			await p;
			
			// Remaining item should include all other URIs
			assert.sameMembers(
				item1.getRelations()[Zotero.Relations.replacedItemPredicate],
				uris
			);
		});
	});
})
