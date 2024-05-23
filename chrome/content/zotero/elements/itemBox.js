/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
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

"use strict";

{
	class ItemBox extends ItemPaneSectionElementBase {
		constructor() {
			super();
			
			this.clickable = false;
			this.saveOnEdit = false;
			this.showTypeMenu = false;
			this.hideEmptyFields = false;
			this.clickByRow = false;
			this.preventFocus = false;
			
			this.eventHandlers = [];
			this.itemTypeMenu = null;
			
			this._mode = 'view';
			this._visibleFields = [];
			this._hiddenFields = [];
			this._clickableFields = [];
			this._editableFields = [];
			this._fieldAlternatives = {};
			this._fieldOrder = [];
			this._initialVisibleCreators = 5;
			this._draggedCreator = false;
			this._selectField = null;
			this._selectFieldSelection = null;
		}

		get content() {
			return MozXULElement.parseXULToFragment(`
				<collapsible-section data-l10n-id="section-info" data-pane="info" style="width:100%">
					<html:div class="body">
						<div id="item-box" xmlns="http://www.w3.org/1999/xhtml">
							<popupset xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
								<menupopup id="creator-type-menu" position="after_start"/>
								<menupopup id="zotero-creator-transform-menu">
									<menuitem id="creator-transform-swap-names" label="&zotero.item.creatorTransform.nameSwap;"/>
									<menuitem id="creator-transform-capitalize" label="&zotero.item.creatorTransform.fixCase;"/>
									<menuitem id="creator-transform-switch"/>
									<menuseparator id="zotero-creator-move-sep"/>
									<menuitem id="zotero-creator-move-to-top" class="zotero-creator-move" data-l10n-id="item-creator-moveToTop"/>
									<menuitem id="zotero-creator-move-up" class="zotero-creator-move" data-l10n-id="item-creator-moveUp"/>
									<menuitem id="zotero-creator-move-down" class="zotero-creator-move" data-l10n-id="item-creator-moveDown"/>
								</menupopup>
								<menupopup id="zotero-link-menu">
									<menuitem id="zotero-link-menu-view-online" data-l10n-id="item-menu-option-view-online"/>
									<menuitem id="zotero-link-menu-copy" label="&zotero.item.copyAsURL;"/>
								</menupopup>
								<guidance-panel id="zotero-author-guidance" about="authorMenu" position="after_end" x="-25"/>
							</popupset>
							<div id="retraction-box" hidden="hidden">
								<div id="retraction-header">
									<div id="retraction-header-text"/>
								</div>
								<div id="retraction-details">
									<p id="retraction-date"/>
									
									<dl id="retraction-reasons"/>
									
									<p id="retraction-notice"/>
									
									<div id="retraction-links"/>
									
									<p id="retraction-credit"/>
									<div id="retraction-hide"><button/></div>
								</div>
							</div>
							<div id="info-table"></div>
						</div>
					</html:div>
				</collapsible-section>
			`, ['chrome://zotero/locale/zotero.dtd']);
		}
		
		init() {
			this.initCollapsibleSection();
			this._creatorTypeMenu.addEventListener('command', async (event) => {
				var typeBox = document.popupNode;
				var index = parseInt(typeBox.getAttribute('fieldname').split('-')[1]);
				
				var typeID = event.explicitOriginalTarget.getAttribute('typeid');
				var row = typeBox.parentNode;
				var fields = this.getCreatorFields(row);
				fields.creatorTypeID = typeID;
				typeBox.querySelector("#creator-type-label-inner").textContent = Zotero.getString(
					'creatorTypes.' + Zotero.CreatorTypes.getName(typeID)
				);
				typeBox.setAttribute('typeid', typeID);
				
				this.modifyCreator(index, fields);
				if (this.saveOnEdit) {
					await this.item.saveTx();
				}
			});

			this._id('zotero-creator-transform-menu').addEventListener('popupshowing', (_event) => {
				var row = document.popupNode.closest('.meta-row');
				var typeBox = row.querySelector('.creator-type-label').parentNode;
				var index = parseInt(typeBox.getAttribute('fieldname').split('-')[1]);
				var item = this.item;
				var exists = item.hasCreatorAt(index);
				var fieldMode = row.querySelector("[fieldMode]").getAttribute("fieldMode");
				
				var moreCreators = item.numCreators() > index + 1;
				
				var hideMoveToTop = !exists || index < 2;
				var hideMoveUp = !exists || index == 0;
				var hideMoveDown = !exists || !moreCreators;
				var hideMoveSep = hideMoveUp && hideMoveDown;
				var hideNameSwap = fieldMode == '1' || !exists;
				
				this._id('creator-transform-swap-names').hidden = hideNameSwap;
				this._id('creator-transform-capitalize').disabled = !this.canCapitalizeCreatorName(row);
				this._id('zotero-creator-move-sep').setAttribute('hidden', hideMoveSep);
				this._id('zotero-creator-move-to-top').setAttribute('hidden', hideMoveToTop);
				this._id('zotero-creator-move-up').setAttribute('hidden', hideMoveUp);
				this._id('zotero-creator-move-down').setAttribute('hidden', hideMoveDown);
				var creatorNameBox = row.getElementsByClassName("creator-name-box")[0];
				this._id('creator-transform-switch').setAttribute("label", creatorNameBox.getAttribute("switch-mode-label"));
			});

			// Ensure no button is forced to stay visible once the menu is cloed
			this.querySelector('#zotero-creator-transform-menu').addEventListener('popuphidden', (_) => {
				let row = document.popupNode.closest('.meta-row');
				for (let node of row.querySelectorAll('toolbarbutton.show-on-hover')) {
					node.style.removeProperty('visibility');
					node.style.removeProperty('display');
				}
			});

			this._id('zotero-creator-transform-menu').addEventListener('command', async (event) => {
				var row = document.popupNode.closest('.meta-row');
				var typeBox = row.querySelector('.creator-type-label').parentNode;
				var index = parseInt(typeBox.getAttribute('fieldname').split('-')[1]);
				
				if (event.explicitOriginalTarget.className == 'zotero-creator-move') {
					let dir;
					switch (event.explicitOriginalTarget.id) {
						case 'zotero-creator-move-to-top':
							dir = 'top';
							break;
						
						case 'zotero-creator-move-up':
							dir = 'up';
							break;
						
						case 'zotero-creator-move-down':
							dir = 'down';
							break;
					}
					this.moveCreator(index, dir);
				}
				else if (event.explicitOriginalTarget.id == "creator-transform-switch") {
					// Switch creator field mode action
					var creatorNameBox = row.getElementsByClassName("creator-name-box")[0];
					var lastName = creatorNameBox.firstChild;
					let fieldMode = parseInt(lastName.getAttribute("fieldMode"));
					this.switchCreatorMode(row, fieldMode == 1 ? 0 : 1, false, true, index);
				}
			});

			this._id('creator-transform-swap-names').addEventListener('command',
				event => this.swapNames(event));

			this._id('creator-transform-capitalize').addEventListener('command',
				event => this.capitalizeCreatorName(event));
			
			this._linkMenu.addEventListener('popupshowing', () => {
				let menu = this._linkMenu;
				let link = menu.dataset.link;
				let val = menu.dataset.val;

				let viewOnline = this._id('zotero-link-menu-view-online');
				let copy = this._id('zotero-link-menu-copy');
				
				viewOnline.disabled = !link;
				copy.disabled = !link;
				copy.hidden = link === val;
				
				let existingCopyMenuitem = menu.querySelector('menuitem[data-action="copy"]');
				if (existingCopyMenuitem) {
					existingCopyMenuitem.after(copy);
				}
				else {
					menu.append(copy);
				}
			});
			
			this._id('zotero-link-menu-view-online').addEventListener(
				'command',
				event => ZoteroPane.loadURI(this._linkMenu.dataset.link, event)
			);
			this._id('zotero-link-menu-copy').addEventListener(
				'command',
				() => Zotero.Utilities.Internal.copyTextToClipboard(this._linkMenu.dataset.link)
			);

			// If the focus leaves the itemBox, clear the last focused element
			this._infoTable.addEventListener("focusout", (e) => {
				let destination = e.relatedTarget;
				if (!(destination && this._infoTable.contains(destination))) {
					this._clearSavedFieldFocus();
				}
			});

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'itemBox');
			Zotero.Prefs.registerObserver('fontSize', () => {
				this._forceRenderAll();
			});
			
			this.style.setProperty('--comma-character',
				"'" + Zotero.getString('punctuation.comma') + "'");
		}
		
		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}
		
		//
		// Public properties
		//
		
		// Modes are predefined settings groups for particular tasks
		get mode() {
			return this._mode;
		}
		
		set mode(val) {
			this.clickable = false;
			this.saveOnEdit = false;
			this.showTypeMenu = false;
			this.hideEmptyFields = false;
			this.clickByRow = false;
			
			switch (val) {
				case 'view':
				case 'merge':
					break;
				
				case 'edit':
					this.clickable = true;
					this.saveOnEdit = true;
					this.showTypeMenu = true;
					break;
				
				case 'fieldmerge':
					this.hideEmptyFields = true;
					this._fieldAlternatives = {};
					break;
				
				default:
					throw new Error(`Invalid mode '${val}'`);
			}
			
			this._mode = val;
			this.setAttribute('mode', val);

			this._editable = this.mode == "edit";
		}

		get editable() {
			return this._editable;
		}

		set editable(editable) {
			// TODO: Replace `mode` with `editable`?
			this.mode = editable ? "edit" : "view";
			// Use the current `_editable` set by `mode`
			super.editable = this._editable;
		}
		
		get item() {
			return this._item;
		}
		
		set item(val) {
			if (!(val instanceof Zotero.Item)) {
				throw new Error("'item' must be a Zotero.Item");
			}

			if (val?.isRegularItem()) {
				this.hidden = false;
			}
			else {
				this.hidden = true;
				return;
			}
			
			// When changing items, reset truncation of creator list
			if (!this._item || val.id != this._item.id) {
				this._displayAllCreators = false;
			}
			
			// If switching items, save the current item first
			// Before fx102, clicking an item in the item tree would send a blur event before ItemBox.item was updated.
			// Now, ItemBox.item is set first, causing us to update this._item and remove the open field before it can
			// receive a blur event and trigger a save.
			if (this._item && val.id != this._item.id) {
				// Not awaiting the blurOpenField() call here is not great practice, but it's unavoidable - setters
				// can't be async and should immediately update their backing fields. Additionally, it matches the old
				// behavior, as the blur event was triggered immediately before the item setter, with the
				// Zotero.Item#saveTx() call continuing in the background.
				this.blurOpenField();
			}
			
			this._item = val;
			this.scrollToTop();
		}
		
		// .ref is an alias for .item
		get ref() {
			return this._item;
		}
		
		set ref(val) {
			this.item = val;
		}
		
		
		/**
		 * An array of field names that should be shown
		 * even if they're empty and hideEmptyFields is set
		 */
		set visibleFields(val) {
			if (val.constructor.name != 'Array') {
				throw Error('visibleFields must be an array in <itembox>.visibleFields');
			}
			
			this._visibleFields = val;
		}
		
		/**
		 * An array of field names that should be hidden
		*/
		set hiddenFields(val) {
			if (val.constructor.name != 'Array') {
				throw Error('hiddenFields must be an array in <itembox>.visibleFields');
			}
			
			this._hiddenFields = val;
		}
		
		/**
		 * An array of field names that should be clickable
		 * even if this.clickable is false
		 */
		set clickableFields(val) {
			if (val.constructor.name != 'Array') {
				throw Error('clickableFields must be an array in <itembox>.clickableFields');
			}
			
			this._clickableFields = val;
		}
		
		/**
		 * An array of field names that should be editable
		 * even if this.editable is false
		 */
		set editableFields(val) {
			if (val.constructor.name != 'Array') {
				throw Error('editableFields must be an array in <itembox>.editableFields');
			}
			
			this._editableFields = val;
		}
		
		/**
		 * An object of alternative values for keyed fields
		 */
		set fieldAlternatives(val) {
			if (val.constructor.name != 'Object') {
				throw Error('fieldAlternatives must be an Object in <itembox>.fieldAlternatives');
			}
			
			if (this.mode != 'fieldmerge') {
				throw Error('fieldAlternatives is valid only in fieldmerge mode in <itembox>.fieldAlternatives');
			}
			
			this._fieldAlternatives = val;
		}
		
		/**
		 * An array of field names in the order they should appear
		 * in the list; empty spaces can be created with null
		 */
		set fieldOrder(val) {
			if (val.constructor.name != 'Array') {
				throw Error('fieldOrder must be an array in <itembox>.fieldOrder');
			}
			
			this._fieldOrder = val;
		}
		
		//
		// Private properties
		//
		get _infoTable() {
			return this._id('info-table');
		}
		
		get _creatorTypeMenu() {
			return this._id('creator-type-menu');
		}
		
		get _defaultFirstName() {
			return '(' + Zotero.getString('pane.item.defaultFirstName') + ')';
		}
		
		get _defaultLastName() {
			return '(' + Zotero.getString('pane.item.defaultLastName') + ')';
		}
		
		get _defaultFullName() {
			return '(' + Zotero.getString('pane.item.defaultFullName') + ')';
		}
		
		get _ignoreFields() {
			return ['abstractNote'];
		}

		get _linkMenu() {
			return this._id('zotero-link-menu');
		}
		
		
		//
		// Methods
		//
		notify(event, _type, ids) {
			if (event != 'modify' || !this.item || !this.item.id) return;
			for (let i = 0; i < ids.length; i++) {
				let id = ids[i];
				if (id != this.item.id) {
					continue;
				}
				this._forceRenderAll();
				break;
			}
		}
		
		render() {
			Zotero.debug('Refreshing item box');

			if (!this.item) {
				Zotero.debug('No item to refresh', 2);
				return;
			}
			if (!this._section.open) return;

			// Always update retraction status
			this.updateRetracted();

			if (this._isAlreadyRendered()) return;
			
			this._saveFieldFocus();

			delete this._linkMenu.dataset.link;
			
			//
			// Clear and rebuild metadata fields
			//
			while (this._infoTable.childNodes.length > 0) {
				this._infoTable.removeChild(this._infoTable.lastChild);
			}

			// Item type menu
			this.addItemTypeMenu();
			this.updateItemTypeMenuSelection();
			var fieldNames = [];
			
			// Manual field order
			if (this._fieldOrder.length) {
				for (let field of this._fieldOrder) {
					fieldNames.push(field);
				}
			}
			// Get field order from database
			else {
				var fields = Zotero.ItemFields.getItemTypeFields(this.item.getField("itemTypeID"));
				
				for (let i = 0; i < fields.length; i++) {
					fieldNames.push(Zotero.ItemFields.getName(fields[i]));
				}

				if (this.item instanceof Zotero.FeedItem) {
					let row = ZoteroPane.getCollectionTreeRow();
					if (row && row.isFeeds()) {
						fieldNames.unshift("feed");
					}
				}
				else {
					fieldNames.push("dateAdded", "dateModified");
				}
			}

			for (let fieldName of fieldNames) {
				if (this._ignoreFields.includes(fieldName)) {
					continue;
				}
				let val = '';
				
				if (fieldName) {
					var fieldID = Zotero.ItemFields.getID(fieldName);
					if (fieldID && !Zotero.ItemFields.isValidForType(fieldID, this.item.itemTypeID)) {
						fieldName = null;
					}
				}
				
				if (fieldName) {
					if (this._hiddenFields.indexOf(fieldName) != -1) {
						continue;
					}
					
					// createValueElement() adds the itemTypeID as an attribute
					// and converts it to a localized string for display
					if (fieldName == 'itemType') {
						val = this.item.itemTypeID;
					}
					// Fake "field" in the feeds global view that displays the name
					// of the containing feed
					else if (fieldName == 'feed') {
						val = Zotero.Feeds.get(this.item.libraryID)?.name;
					}
					else {
						val = this.item.getField(fieldName);
					}
					
					if (!val && this.hideEmptyFields
							&& this._visibleFields.indexOf(fieldName) == -1
							&& (this.mode != 'fieldmerge' || typeof this._fieldAlternatives[fieldName] == 'undefined')) {
						continue;
					}
					
					var fieldIsClickable = this._fieldIsClickable(fieldName);
					
					if (fieldIsClickable
							&& !Zotero.Items.isPrimaryField(fieldName)
							&& Zotero.ItemFields.isDate(fieldName)
							// TEMP - NSF
							&& fieldName != 'dateSent') {
						this.addDateRow(fieldName, this.item.getField(fieldName, true));
						continue;
					}
				}
				
				let rowLabel = document.createElement("div");
				rowLabel.className = "meta-label";
				rowLabel.setAttribute('fieldname', fieldName);
				
				let valueElement = this.createValueElement(
					val, fieldName
				);
				
				if (fieldName) {
					let label = document.createElement('label');
					label.className = 'key';
					label.textContent = Zotero.ItemFields.getLocalizedString(fieldName);
					label.setAttribute("id", `itembox-field-${fieldName}-label`);
					rowLabel.appendChild(label);
					valueElement.setAttribute('aria-labelledby', label.id);
				}
				let openLinkButton;
				let link = val;
				let addLinkContextMenu = false;
				// TEMP - NSF (homepage)
				if ((fieldName == 'url' || fieldName == 'homepage')
						// Only make plausible HTTP URLs clickable
						&& Zotero.Utilities.isHTTPURL(val, true)) {
					openLinkButton = this.createOpenLinkIcon(val);
					addLinkContextMenu = true;
				}
				else if (fieldName == 'DOI' && val && typeof val == 'string') {
					// Pull out DOI, in case there's a prefix
					let doi = Zotero.Utilities.cleanDOI(val);
					if (doi) {
						doi = "https://doi.org/"
							// Encode some characters that are technically valid in DOIs,
							// though generally not used. '/' doesn't need to be encoded.
							+ doi.replace(/#/g, '%23')
								.replace(/\?/g, '%3f')
								.replace(/%/g, '%25')
								.replace(/"/g, '%22');
						openLinkButton = this.createOpenLinkIcon(doi);
						link = doi;
						addLinkContextMenu = true;
					}
				}
				let rowData = document.createElement('div');
				rowData.className = "meta-data";
				rowData.appendChild(valueElement);
				if (openLinkButton) {
					rowData.appendChild(openLinkButton);
				}
				if (addLinkContextMenu) {
					rowData.oncontextmenu = (event) => {
						this._linkMenu.dataset.link = link;
						this._linkMenu.dataset.val = val;
						document.popupNode = rowLabel.parentElement;
						
						let menupopup = this._id('zotero-link-menu');
						Zotero.Utilities.Internal.updateEditContextMenu(menupopup, event.target.closest('input'));
						this.handlePopupOpening(event, menupopup);
					};
				}
				
				// Add options button for title fields
				if (this.editable && fieldID && val && (fieldName == 'seriesTitle' || fieldName == 'shortTitle'
				|| Zotero.ItemFields.isFieldOfBase(fieldID, 'title')
				|| Zotero.ItemFields.isFieldOfBase(fieldID, 'publicationTitle'))) {
					let optionsButton = document.createXULElement("toolbarbutton");
					optionsButton.className = "zotero-clicky zotero-clicky-options show-on-hover";
					// Options button after single-line fields will not occupy space unless hovered.
					// This does not apply to multiline fields because it would move textarea on hover.
					if (!(Zotero.ItemFields.isLong(fieldName) || Zotero.ItemFields.isMultiline(fieldName))) {
						optionsButton.classList.add("no-display");
					}
					optionsButton.setAttribute('data-l10n-id', "itembox-button-options");
					// eslint-disable-next-line no-loop-func
					let triggerPopup = (e) => {
						let menupopup = ZoteroPane.buildFieldTransformMenu({
							target: valueElement,
							onTransform: (newValue) => {
								this._setFieldTransformedValue(valueElement, newValue);
							}
						});
						this.querySelector('popupset').append(menupopup);
						menupopup.addEventListener('popuphidden', () => {
							menupopup.remove();
							optionsButton.style.visibility = '';
						});
						this.handlePopupOpening(e, menupopup);
					};
					// Same popup triggered for right-click and options button click
					optionsButton.addEventListener("click", triggerPopup);
					rowData.appendChild(optionsButton);
					rowData.oncontextmenu = triggerPopup;
				}

				this.addDynamicRow(rowLabel, rowData);
				
				// In field merge mode, add a button to switch field versions
				if (this.mode == 'fieldmerge' && typeof this._fieldAlternatives[fieldName] != 'undefined') {
					var button = document.createXULElement("toolbarbutton");
					button.className = 'zotero-field-version-button zotero-clicky-merge';
					button.setAttribute('type', 'menu');
					button.setAttribute('data-l10n-id', 'itembox-button-merge');
					
					var popup = button.appendChild(document.createXULElement("menupopup"));
					
					for (let v of this._fieldAlternatives[fieldName]) {
						let menuitem = document.createXULElement("menuitem");
						var sv = Zotero.Utilities.ellipsize(v, 60);
						menuitem.setAttribute('label', sv);
						if (v != sv) {
							menuitem.setAttribute('tooltiptext', v);
						}
						menuitem.setAttribute('fieldname', fieldName);
						menuitem.setAttribute('originalValue', v);
						menuitem.addEventListener('command', () => {
							this.item.setField(
								menuitem.getAttribute('fieldname'),
								menuitem.getAttribute('originalValue')
							);
							this._forceRenderAll();
						});
						popup.appendChild(menuitem);
					}
					
					rowData.appendChild(button);
				}
			}
			
			//
			// Creators
			//
			
			// Creator type menu
			if (this.editable) {
				while (this._creatorTypeMenu.hasChildNodes()) {
					this._creatorTypeMenu.removeChild(this._creatorTypeMenu.firstChild);
				}
				
				var creatorTypes = Zotero.CreatorTypes.getTypesForItemType(this.item.itemTypeID);
	
				var localized = {};
				for (let i = 0; i < creatorTypes.length; i++) {
					localized[creatorTypes[i].name]
						= Zotero.getString('creatorTypes.' + creatorTypes[i].name);
				}
				
				for (let i in localized) {
					var menuitem = document.createXULElement("menuitem");
					menuitem.setAttribute("label", localized[i]);
					menuitem.setAttribute("typeid", Zotero.CreatorTypes.getID(i));
					this._creatorTypeMenu.appendChild(menuitem);
				}
				this._creatorTypeMenu.addEventListener('popuphidden', () => {
					// If the popup was opened with a mouse click, blur the field to hide icons
					if (this._creatorTypeMenu.getAttribute("blur-on-hidden")) {
						document.activeElement.blur();
						this._creatorTypeMenu.removeAttribute("blur-on-hidden");
					}
				});
			}
			
			// Creator rows
			
			// Place, in order of preference, after title, after type,
			// or at beginning
			var field = this.getTitleField();
			if (!field) {
				field = this._infoTable.querySelector('[fieldName="itemType"]');
			}
			if (field) {
				this._firstRowBeforeCreators = field.closest(".meta-row").nextSibling;
			}
			else {
				this._firstRowBeforeCreators = this._infoTable.firstChild;
			}
			
			this._creatorCount = 0;
			var num = this.item.numCreators();
			if (num > 0) {
				// Limit number of creators display
				var max = Math.min(num, this._initialVisibleCreators);
				// If only 1 or 2 more, just display
				if (num < max + 3 || this._displayAllCreators) {
					max = num;
				}
				for (let i = 0; i < max; i++) {
					let data = this.item.getCreator(i);
					this.addCreatorRow(data, data.creatorTypeID, false);
				}
				if (this._draggedCreator) {
					this._draggedCreator = false;
					// Block hover effects on creators, enable them back on first mouse movement.
					// See comment in creatorDragPlaceholder() for explanation
					for (let label of document.querySelectorAll(".meta-label[fieldname^='creator-']")) {
						label.closest(".meta-row").classList.add("noHover");
					}
					let removeHoverBlock = () => {
						let noHoverRows = document.querySelectorAll('.noHover');
						noHoverRows.forEach(el => el.classList.remove('noHover'));
						document.removeEventListener('mousemove', removeHoverBlock);
					};
					document.addEventListener('mousemove', removeHoverBlock);
				}
				
				// Additional creators not displayed
				if (num > max) {
					this.addMoreCreatorsRow(num - max);
				}
				else {
					// If we didn't start with creators truncated,
					// don't truncate for as long as we're viewing
					// this item, so that added creators aren't
					// immediately hidden
					this._displayAllCreators = true;
					
					if (this._addCreatorRow) {
						this.addCreatorRow(false, this.item.getCreator(max - 1).creatorTypeID, true);
						this._addCreatorRow = false;
					}
				}
			}
			else if (this.editable && Zotero.CreatorTypes.itemTypeHasCreators(this.item.itemTypeID)) {
				// Add default row
				this.addCreatorRow(false, false, false);
			}
			
			
			if (this._showCreatorTypeGuidance) {
				let creatorTypeLabels = this.querySelectorAll(".creator-type-label");
				this._id("zotero-author-guidance").show({
					forEl: creatorTypeLabels[creatorTypeLabels.length - 1]
				});
				this._showCreatorTypeGuidance = false;
			}
			
			// On click of the label, toggle the focus of the value field
			for (let label of this.querySelectorAll(".meta-label > label")) {
				if (!this.editable) {
					break;
				}
				
				label.addEventListener('mousedown', (event) => {
					// Prevent default focus/blur behavior - we implement our own below
					event.preventDefault();
				});
				
				label.addEventListener('click', (event) => {
					event.preventDefault();
					
					let labelWrapper = label.closest(".meta-label");
					if (labelWrapper.nextSibling.contains(document.activeElement)) {
						document.activeElement.blur();
					}
					else {
						let valueField = labelWrapper.nextSibling.firstChild;
						if (valueField.id === "item-type-menu") {
							valueField.querySelector("menupopup").openPopup();
							return;
						}
						labelWrapper.nextSibling.firstChild.focus();
					}
				});
			}

			this._ensureButtonsFocusable();

			// Set focus on the last focused field
			this._restoreFieldFocus();
			// Make sure that any opened popup closes
			this.querySelectorAll("menupopup").forEach((popup) => {
				popup.hidePopup();
			});
		}
		
		addItemTypeMenu() {
			var row = document.createElement('div');
			row.className = "meta-row";
			var labelWrapper = document.createElement('div');
			labelWrapper.className = "meta-label";
			labelWrapper.setAttribute("fieldname", "itemType");
			var label = document.createElement("label");
			label.className = "key";
			label.id = "itembox-field-itemType-label";
			label.innerText = Zotero.getString("zotero.items.itemType");
			labelWrapper.appendChild(label);
			var rowData = document.createElement('div');
			rowData.className = "meta-data";
			if (this.itemTypeMenu) {
				rowData.appendChild(this.itemTypeMenu);
			}
			else {
				var menulist = document.createXULElement("menulist", { is: "menulist-item-types" });
				menulist.id = "item-type-menu";
				menulist.className = "zotero-clicky keyboard-clickable";
				menulist.addEventListener('command', (event) => {
					this.changeTypeTo(event.target.value, menulist);
				});
				menulist.addEventListener('focus', () => {
					this.ensureElementIsVisible(menulist);
				});
				// This is instead of setting disabled=true so that the menu is not excluded
				// from tab navigation. For <input>s, we just set readonly=true but it is not
				// a valid property for menulist.
				menulist.addEventListener("popupshowing", (e) => {
					if (!this._editable) {
						e.preventDefault();
						e.stopPropagation();
					}
				});
				menulist.setAttribute("aria-labelledby", "itembox-field-itemType-label");
				this.itemTypeMenu = menulist;
				rowData.appendChild(menulist);
			}
			this.itemTypeMenu.setAttribute("aria-disabled", !this._editable);
			row.appendChild(labelWrapper);
			row.appendChild(rowData);
			this._infoTable.appendChild(row);
		}
		
		updateItemTypeMenuSelection() {
			this.itemTypeMenu.value = this.item.itemTypeID;
		}
		
		addDynamicRow(label, value, beforeElement) {
			var row = document.createElement("div");
			row.className = "meta-row";
			
			row.appendChild(label);
			row.appendChild(value);
			
			// Special treatment for creator rows if beforeElement is not specified
			if (!beforeElement && row.querySelector(".creator-type-value, #more-creators-label")) {
				beforeElement = this._firstRowBeforeCreators;
			}

			if (beforeElement) {
				this._infoTable.insertBefore(row, beforeElement);
			}
			else {
				this._infoTable.appendChild(row);
			}
			
			return row;
		}
		
		addCreatorRow(creatorData, creatorTypeIDOrName, unsaved, before) {
			// getCreatorFields(), switchCreatorMode() and handleCreatorAutoCompleteSelect()
			// may need need to be adjusted if this DOM structure changes

			var fieldMode = Zotero.Prefs.get('lastCreatorFieldMode');
			var firstName = '';
			var lastName = '';
			if (creatorData) {
				fieldMode = creatorData.fieldMode;
				firstName = creatorData.firstName;
				lastName = creatorData.lastName;
			}
			
			// Use the first entry in the drop-down for the default type if none specified
			var typeID = creatorTypeIDOrName
				? Zotero.CreatorTypes.getID(creatorTypeIDOrName)
				: this._creatorTypeMenu.childNodes[0].getAttribute('typeid');
			
			var rowIndex = this._creatorCount;
			
			// Creator label with draggable grippy icon for creator reordering
			var rowLabel = document.createElement("div");
			rowLabel.className = "meta-label";
			rowLabel.setAttribute("typeid", typeID);
			rowLabel.setAttribute("fieldname", 'creator-' + rowIndex + '-typeID');
			let labelWrapper = document.createElement('div');
			let grippy = document.createXULElement('toolbarbutton');
			
			labelWrapper.className = 'creator-type-label keyboard-clickable';
			labelWrapper.setAttribute("tabindex", 0);
			grippy.className = "zotero-clicky zotero-clicky-grippy show-on-hover";
			grippy.setAttribute('tabindex', -1);
			rowLabel.appendChild(grippy);
			
			if (this.editable) {
				labelWrapper.classList.add('zotero-clicky');
				let span = document.createElement('span');
				span.className = 'creator-type-dropmarker';
				labelWrapper.appendChild(span);
				labelWrapper.addEventListener('click', (e) => {
					document.popupNode = rowLabel;
					this._creatorTypeMenu.openPopup(rowLabel);
					// If the creator menu is opened via mouse-click, add a special attribute to
					// blur the focused field so that icons do not show up after the menu is closed.
					if (e.x !== 0 && e.y !== 0) {
						this._creatorTypeMenu.setAttribute("blur-on-hidden", "true");
					}
				});
			}

			labelWrapper.setAttribute('role', 'button');
			labelWrapper.setAttribute('aria-describedby', 'creator-type-label-inner');
			labelWrapper.setAttribute('id', `creator-${rowIndex}-label`);

			// If not editable or only 1 creator row or a row is unsaved, hide grippy
			if (!this.editable || this.item.numCreators() < 2 || unsaved) {
				grippy.classList.add("single-creator-grippy");
				grippy.setAttribute('disabled', true);
			}

			rowLabel.appendChild(labelWrapper);
			var label = document.createElement("label");
			label.setAttribute('id', 'creator-type-label-inner');
			label.className = 'key';
			label.textContent = Zotero.getString('creatorTypes.' + Zotero.CreatorTypes.getName(typeID));
			labelWrapper.appendChild(label);
			
			var rowData = document.createElement("div");
			rowData.className = 'creator-type-value';
			
			// Name
			var firstlast = document.createElement("span");
			firstlast.className = 'creator-name-box';
			
			var fieldName = 'creator-' + rowIndex + '-lastName';
			var lastNameElem = firstlast.appendChild(
				this.createValueElement(
					lastName,
					fieldName,
				)
			);
			
			lastNameElem.placeholder = this._defaultLastName;
			fieldName = 'creator-' + rowIndex + '-firstName';
			var firstNameElem = firstlast.appendChild(
				this.createValueElement(
					firstName,
					fieldName,
				)
			);
			firstNameElem.placeholder = this._defaultFirstName;
			if (fieldMode > 0) {
				firstlast.lastChild.hidden = true;
			}
			
			rowData.appendChild(firstlast);
			
			// Minus (-) button
			var removeButton = document.createXULElement('toolbarbutton');
			removeButton.setAttribute("class", "zotero-clicky zotero-clicky-minus show-on-hover no-display");
			removeButton.setAttribute('id', `creator-${rowIndex}-remove`);
			removeButton.setAttribute('tooltiptext', Zotero.getString('general.delete'));
			removeButton.addEventListener("command", () => this.removeCreator(rowIndex, rowData.parentNode));
			rowData.appendChild(removeButton);
			
			// Plus (+) button
			var addButton = document.createXULElement('toolbarbutton');
			addButton.setAttribute("class", "zotero-clicky zotero-clicky-plus show-on-hover no-display");
			addButton.setAttribute('id', `creator-${rowIndex}-add`);
			addButton.setAttribute('tooltiptext', Zotero.getString('general.create'));
			addButton.addEventListener("command", (e) => {
				// + button adds a creator row after the row that was clicked
				let nextRow = e.target.closest(".meta-row").nextElementSibling;
				this.addCreatorRow(null, typeID, true, nextRow);
			});
			rowData.appendChild(addButton);

			// Options button that opens creator transform menu
			let optionsButton = document.createXULElement("toolbarbutton");
			if (!this.editable) {
				optionsButton.style.visibility = "hidden";
				optionsButton.disabled = true;
			}
			optionsButton.className = "zotero-clicky zotero-clicky-options show-on-hover no-display";
			optionsButton.setAttribute('id', `creator-${rowIndex}-options`);
			optionsButton.setAttribute('data-l10n-id', "itembox-button-options");
			let triggerPopup = (e) => {
				document.popupNode = firstlast;

				let menupopup = this._id('zotero-creator-transform-menu');
				Zotero.Utilities.Internal.updateEditContextMenu(menupopup, e.target.closest('input'));
				
				this.handlePopupOpening(e, menupopup);
			};
			rowData.appendChild(optionsButton);
			
			if (this.editable) {
				optionsButton.addEventListener("command", triggerPopup);
				rowData.oncontextmenu = triggerPopup;
			}
			
			this._creatorCount++;
			
			// Delete existing unsaved creator row if any
			let unsavedCreatorData = this._infoTable.querySelector(".creator-type-value[unsaved=true]");
			if (unsavedCreatorData) {
				unsavedCreatorData.closest(".meta-row").remove();
			}

			let row = this.addDynamicRow(rowLabel, rowData, before);

			this._ensureButtonsFocusable();
			
			/**
			 * Events handling creator drag-drop reordering
			 */

			// Creator becomes draggable and can be moved to another creator's spot
			grippy.addEventListener('mousedown', (_) => {
				row.setAttribute('draggable', 'true');
			});
			grippy.addEventListener('mouseup', (_) => {
				row.setAttribute('draggable', 'false');
			});
			row.addEventListener('dragstart', (e) => {
				if (row.getAttribute("draggable") !== "true") {
					e.preventDefault();
					e.stopPropagation();
					return;
				}
				e.dataTransfer.setDragImage(row, 15, 15);
				e.dataTransfer.setData('zotero/creator', rowIndex);
				// Hide the row after the drag image is generated to make it look like
				// a placeholder where the creator will be dropped.
				setTimeout(() => {
					row.classList.add("drag-hidden-creator");
					row.classList.add("noHover");
				});
			});

			row.addEventListener('dragover', this.handleCreatorDragOver(rowIndex, row));

			// The creator row is dropped into the placeholder - this will reorder creators
			row.addEventListener('drop', this.handleCreatorRowDrop());

			row.addEventListener('dragend', (_) => {
				// If the row is still hidden, no 'drop' event happened, meaning creator rows
				// were not reordered. To make sure everything is in correct order, just refresh.
				if (row.classList.contains("drag-hidden-creator")) {
					this._forceRenderAll();
				}
			});
			
			// Set single/double field toggle mode
			if (fieldMode) {
				this.switchCreatorMode(rowData.parentNode, 1, true, rowIndex);
			}
			else {
				this.switchCreatorMode(rowData.parentNode, 0, true, rowIndex);
			}
			
			lastNameElem.sizeToContent();
			firstNameElem.sizeToContent();

			if (!this.editable) {
				return;
			}

			lastNameElem.addEventListener("input", lastNameElem.sizeToContent);
			firstNameElem.addEventListener("input", firstNameElem.sizeToContent);

			// On blur that did not trigger refresh (e.g. on escape), return to original size
			lastNameElem.addEventListener("blur", lastNameElem.sizeToContent);
			firstNameElem.addEventListener("blur", firstNameElem.sizeToContent);

			this.addAutocompleteToElement(lastNameElem);
			this.addAutocompleteToElement(firstNameElem);

			row.addEventListener("keydown", e => this.handleCreatorRowKeyDown(e));
			lastNameElem.addEventListener("paste", e => this.handleCreatorPaste(e));
			// Focus unsaved empty creator row
			if (unsaved) {
				rowData.setAttribute("unsaved", true);
				lastNameElem.focus();
			}
			// Refresh creator buttons status, e.g. to disable + button of a row that just added
			// a new creator
			this._updateCreatorButtonsStatus();
		}
		
		addMoreCreatorsRow(num) {
			var rowLabel = document.createElement('div');
			rowLabel.className = "meta-label";
			
			var rowData = document.createElement('div');
			rowData.className = "meta-data";
			rowData.id = 'more-creators-label';
			rowData.setAttribute("tabindex", 0);
			rowData.addEventListener('click', () => {
				this._displayAllCreators = true;
				this._forceRenderAll();
			});
			rowData.addEventListener('keypress', (e) => {
				if (["Enter", ' '].includes(e.key)) {
					this._displayAllCreators = true;
					this._forceRenderAll();
				}
			});
			rowData.textContent = Zotero.getString('general.numMore', num);
			
			this.addDynamicRow(rowLabel, rowData);
		}
		
		addDateRow(field, value) {
			var rowLabel = document.createElement("div");
			rowLabel.className = "meta-label";
			rowLabel.setAttribute("fieldname", field);
			var label = document.createElement('label');
			label.className = 'key';
			label.textContent = Zotero.ItemFields.getLocalizedString(field);
			label.setAttribute("id", `itembox-field-${field}-label`);
			rowLabel.appendChild(label);
			
			var rowData = document.createElement('div');
			rowData.className = "meta-data date-box";
			
			var elem = this.createValueElement(
				Zotero.Date.multipartToStr(value),
				field
			);

			elem.setAttribute('aria-labelledby', label.id);
			// y-m-d status indicator
			var ymd = document.createElement('span');
			ymd.id = 'zotero-date-field-status';
			ymd.textContent = Zotero.Date.strToDate(Zotero.Date.multipartToStr(value))
					.order.split('').join(' ');
			ymd.className = "show-on-hover";
			rowData.appendChild(elem);
			rowData.appendChild(ymd);
			
			this.addDynamicRow(rowLabel, rowData);
		}
		
		switchCreatorMode(row, fieldMode, initial, updatePref, rowIndex) {
			// Change if button position changes
			var creatorNameBox = row.querySelector(".creator-name-box");
			var lastName = creatorNameBox.firstChild;
			var firstName = creatorNameBox.lastChild;

			// Switch to single-field mode
			if (fieldMode == 1) {
				creatorNameBox.setAttribute('switch-mode-label', Zotero.getString('pane.item.switchFieldMode.two'));
				lastName.setAttribute('fieldMode', '1');
				lastName.placeholder = this._defaultFullName;
				delete lastName.style.width;
				delete lastName.style.maxWidth;
				
				// Hide first name field and prepend to last name field
				firstName.hidden = true;
				
				if (!initial) {
					var first = firstName.value;
					if (first) {
						let last = lastName.value;
						lastName.value = first + ' ' + last;
					}
				}
				// Clear first name value after it was moved to the full name field
				firstName.value = "";
			}
			// Switch to two-field mode
			else {
				creatorNameBox.setAttribute('switch-mode-label', Zotero.getString('pane.item.switchFieldMode.one'));
				lastName.setAttribute('fieldMode', '0');

				lastName.placeholder = this._defaultLastName;
				
				if (!initial) {
					// Move all but last word to first name field and show it
					let last = lastName.value;
					if (last) {
						var lastNameRE = /(.*?)[ ]*([^ ]+[ ]*)$/;
						var parts = lastNameRE.exec(last);
						if (parts[2] && parts[2] != last) {
							lastName.value = parts[2];
							firstName.value = parts[1];
						}
					}
				}
				
				firstName.hidden = false;
			}
			
			// Save the last-used field mode
			if (updatePref) {
				Zotero.debug("Switching lastCreatorFieldMode to " + fieldMode);
				Zotero.Prefs.set('lastCreatorFieldMode', fieldMode);
			}
			
			if (!initial) {
				var fields = this.getCreatorFields(row);
				fields.fieldMode = fieldMode;
				firstName.sizeToContent();
				lastName.sizeToContent();
				this.modifyCreator(rowIndex, fields);
				// For empty unsaved creator rows, update their autocomplete setting so that
				// e.g fullnames are not suggested after switch to first-last name mode.
				// Otherwise, just save the item and appropriate autocomplete modes will be set in render()
				if (row.querySelector("[unsaved=true]")) {
					this.addAutocompleteToElement(firstName);
					this.addAutocompleteToElement(lastName);
				}
				else {
					this.item.saveTx();
				}
			}
		}
		
		scrollToTop() {
			this.scrollTop = 0;
		}
		
		ensureElementIsVisible(elem) {
			elem.scrollIntoView({ block: 'nearest' });
		}
		
		async changeTypeTo(itemTypeID, menu) {
			var functionsToRun = [];
			if (this.eventHandlers.itemtypechange && this.eventHandlers.itemtypechange.length) {
				functionsToRun = [...this.eventHandlers.itemtypechange];
			}
			
			if (itemTypeID == this.item.itemTypeID) {
				return true;
			}
			
			if (this.saveOnEdit) {
				await this.item.saveTx();
			}
			
			var fieldsToDelete = this.item.getFieldsNotInType(itemTypeID, true);
			
			// Special cases handled below
			var bookTypeID = Zotero.ItemTypes.getID('book');
			var bookSectionTypeID = Zotero.ItemTypes.getID('bookSection');
			
			// Add warning for shortTitle when moving from book to bookSection
			// when title will be transferred
			if (this.item.itemTypeID == bookTypeID && itemTypeID == bookSectionTypeID) {
				let titleFieldID = Zotero.ItemFields.getID('title');
				let shortTitleFieldID = Zotero.ItemFields.getID('shortTitle');
				if (this.item.getField(titleFieldID) && this.item.getField(shortTitleFieldID)) {
					if (!fieldsToDelete) {
						fieldsToDelete = [];
					}
					fieldsToDelete.push(shortTitleFieldID);
				}
			}
			
			// Generate list of localized field names for display in pop-up
			if (fieldsToDelete) {
				// Ignore warning for bookTitle when going from bookSection to book
				// if there's not also a title, since the book title is transferred
				// to title automatically in Zotero.Item.setType()
				if (this.item.itemTypeID == bookSectionTypeID && itemTypeID == bookTypeID) {
					let titleFieldID = Zotero.ItemFields.getID('title');
					var bookTitleFieldID = Zotero.ItemFields.getID('bookTitle');
					let shortTitleFieldID = Zotero.ItemFields.getID('shortTitle');
					if (this.item.getField(bookTitleFieldID) && !this.item.getField(titleFieldID)) {
						var index = fieldsToDelete.indexOf(bookTitleFieldID);
						fieldsToDelete.splice(index, 1);
						// But warn for short title, which will be removed
						if (this.item.getField(shortTitleFieldID)) {
							fieldsToDelete.push(shortTitleFieldID);
						}
					}
				}
				
				var fieldNames = "";
				for (var i = 0; i < fieldsToDelete.length; i++) {
					fieldNames += "\n - "
						+ Zotero.ItemFields.getLocalizedString(fieldsToDelete[i]);
				}
				
				var promptService = Services.prompt;
			}
			
			if (!fieldsToDelete || fieldsToDelete.length == 0
					|| promptService.confirm(null,
						Zotero.getString('pane.item.changeType.title'),
						Zotero.getString('pane.item.changeType.text') + "\n" + fieldNames)) {
				this.item.setType(itemTypeID);
				
				if (this.saveOnEdit) {
					await this.item.saveTx();
				}
				else {
					this._forceRenderAll();
				}
				
				functionsToRun.forEach(f => f.bind(this)());
				
				return true;
			}
			
			// Revert the menu (which changes before the pop-up)
			if (menu) {
				menu.value = this.item.itemTypeID;
			}
			
			return false;
		}
		
		// Toolbarbuttons required tabindex=0 to be properly focusable via tab
		_ensureButtonsFocusable() {
			this.querySelectorAll("toolbarbutton").forEach((btn) => {
				if (!btn.getAttribute('tabindex')) {
					btn.setAttribute("tabindex", 0);
				}
			});
		}

		
		createOpenLinkIcon(value) {
			// In duplicates/trash mode return nothing
			if (!this.editable) {
				return null;
			}
			let openLink = document.createXULElement("toolbarbutton");
			openLink.className = "zotero-clicky zotero-clicky-open-link show-on-hover no-display";
			openLink.addEventListener("click", event => ZoteroPane.loadURI(value, event));
			openLink.setAttribute('data-l10n-id', "item-button-view-online");
			return openLink;
		}

		createValueElement(valueText, fieldName) {
			valueText += '';

			if (fieldName) {
				var fieldID = Zotero.ItemFields.getID(fieldName);
			}
			
			let isMultiline = Zotero.ItemFields.isMultiline(fieldName);
			let isLong = Zotero.ItemFields.isLong(fieldName);
			
			var valueElement = document.createXULElement("editable-text");
			valueElement.className = 'value';
			if (isMultiline) {
				valueElement.setAttribute('multiline', true);
			}
			else if (!isLong) {
				// Usual fields occupy all available space and keep info on one line
				valueElement.setAttribute("nowrap", true);
			}
			

			if (this._fieldIsClickable(fieldName)) {
				valueElement.addEventListener("focus", e => this.showEditor(e.target));
				valueElement.addEventListener("blur", e => this.hideEditor(e.target));
			}
			else {
				valueElement.setAttribute('readonly', true);
			}

			valueElement.setAttribute('id', `itembox-field-value-${fieldName}`);
			valueElement.setAttribute('fieldname', fieldName);
			valueElement.setAttribute('tight', true);

			switch (fieldName) {
				case 'itemType':
					valueElement.setAttribute('itemTypeID', valueText);
					valueText = Zotero.ItemTypes.getLocalizedString(valueText);
					break;
				
				// Convert dates from UTC
				case 'dateAdded':
				case 'dateModified':
				case 'accessDate':
				case 'date':
				case 'dateSent': // TEMP - NSF
				case 'dateDue':
				case 'accepted':
					if (fieldName == 'date' && this.item._objectType != 'feedItem') {
						break;
					}
					valueText = this.dateTimeFromUTC(valueText);
					break;
			}
			
			if (fieldID) {
				// Display the SQL date as a tooltip for date fields
				// TEMP - filingDate
				if (Zotero.ItemFields.isFieldOfBase(fieldID, 'date') || fieldName == 'filingDate') {
					valueElement.tooltipText = Zotero.Date.multipartToSQL(this.item.getField(fieldName, true));
				}
			}
			
			valueElement.value = valueText;

			// Attempt to make bidi things work automatically:
			// If we have text to work off of, let the layout engine try to guess the text direction
			if (valueText) {
				valueElement.dir = 'auto';
			}
			// If not, assume it follows the locale's direction
			else {
				valueElement.dir = Zotero.dir;
			}
			
			// Regardless, align the text in the label consistently, following the locale's direction
			if (Zotero.rtl) {
				valueElement.style.textAlign = 'right';
			}
			else {
				valueElement.style.textAlign = 'left';
			}
			if (!isLong && !fieldName.includes("creator")) {
				// autocomplete for creator names is added in addCreatorRow
				this.addAutocompleteToElement(valueElement);
			}
			return valueElement;
		}
		
		async removeCreator(index, creatorRow) {
			// Move focus to another creator row
			if (creatorRow.contains(document.activeElement)) {
				let nextCreatorIndex = index ? index - 1 : 0;
				// If there is an unsaved index for a just-added empty creator row,
				// focus the creator row before it.
				let { unsavedIndex } = this.getCreatorFields(creatorRow);
				if (unsavedIndex !== null) {
					nextCreatorIndex = unsavedIndex ? unsavedIndex - 1 : 0;
				}
				this._selectField = `itembox-field-value-creator-${nextCreatorIndex}-lastName`;
			}
			// If unsaved row, just remove element
			if (!this.item.hasCreatorAt(index)) {
				creatorRow.remove();
				
				this._creatorCount--;
				this._restoreFieldFocus();
				this._updateCreatorButtonsStatus();
				return;
			}
			this.item.removeCreator(index);
			await this.item.saveTx();
		}
		
		dateTimeFromUTC(valueText) {
			if (valueText) {
				var date = Zotero.Date.sqlToDate(valueText, true);
				if (date) {
					// If no time, interpret as local, not UTC
					if (Zotero.Date.isSQLDate(valueText)) {
						// Add time to avoid showing previous day if date is in
						// DST (including the current date at 00:00:00) and we're
						// in standard time
						date = Zotero.Date.sqlToDate(valueText + ' 12:00:00');
						valueText = date.toLocaleDateString();
					}
					else {
						valueText = date.toLocaleString();
					}
				}
				else {
					valueText = '';
				}
			}
			return valueText;
		}

		async showEditor(elem) {
			Zotero.debug(`Showing editor for ${elem.getAttribute('fieldname')}`);
			var fieldName = elem.getAttribute('fieldname');

			// Multiline field will be at least 6 lines
			if (Zotero.ItemFields.isMultiline(fieldName)) {
				elem.setAttribute("min-lines", 6);
			}
			var [field, creatorIndex, creatorField] = fieldName.split('-');
			let value;
			if (field == 'creator') {
				value = this.item.getCreator(creatorIndex)[creatorField];
				if (value === undefined) {
					elem.value = "";
				}
			}
			else {
				value = this.item.getField(fieldName);
				// Access date needs to be converted from UTC
				if (value != '') {
					let localDate;
					switch (fieldName) {
						case 'accessDate':
						case 'dateSent': // TEMP - NSF
						case 'dateDue':
						case 'accepted':
							// If no time, interpret as local, not UTC
							if (Zotero.Date.isSQLDate(value)) {
								localDate = Zotero.Date.sqlToDate(value);
							}
							else {
								localDate = Zotero.Date.sqlToDate(value, true);
							}
							value = Zotero.Date.dateToSQL(localDate);
							
							// Don't show time in editor
							value = value.replace(' 00:00:00', '');
							elem.value = value;
							break;
					}
				}
			}
		}

		addAutocompleteToElement(elem) {
			var fieldName = elem.getAttribute('fieldname');
			var [field, creatorIndex, creatorField] = fieldName.split('-');
			if (elem.getAttribute("readonly") || !(field == 'creator' || Zotero.ItemFields.isAutocompleteField(fieldName))) {
				return;
			}
			let itemID = this.item.id;
			let params = {
				fieldName: fieldName,
				libraryID: this.item.libraryID,
				search: 'zotero'
			};
			if (field == 'creator') {
				params.fieldMode = parseInt(elem.getAttribute('fieldMode'));
				
				// Include itemID and creatorTypeID so the autocomplete can
				// avoid showing results for creators already set on the item
				let row = elem.closest('.meta-row');
				let creatorTypeID = parseInt(
					row.querySelector('.meta-label').getAttribute('typeid')
				);
				if (itemID) {
					params.itemID = itemID;
					params.creatorTypeID = creatorTypeID;
				}
				
				// Return/click
				// Monkey-patching onTextEntered is apparently the current official way to detect completion --
				// there's also a custom event called textEntered, but it won't be fired unless the input has its
				// 'notifylegacyevents' attribute set to true
				// https://searchfox.org/mozilla-central/rev/2d678a843ceab81e43f7ffb83212197dc10e944a/toolkit/content/widgets/autocomplete-input.js#372
				// https://searchfox.org/mozilla-central/rev/2d678a843ceab81e43f7ffb83212197dc10e944a/browser/components/search/content/searchbar.js#791
				elem.onTextEntered = () => {
					this.handleCreatorAutoCompleteSelect(elem);
				};
				// Tab/Shift-Tab
				elem.addEventListener('change', () => {
					this.handleCreatorAutoCompleteSelect(elem);
				});
			}
			elem.autocomplete = {
				completeSelectedIndex: true,
				ignoreBlurWhileSearching: false,
				search: 'zotero',
				searchParam: JSON.stringify(params),
				popup: 'PopupAutoComplete',
			};
		}
		
		
		/**
		 * Save a multiple-field selection for the creator autocomplete
		 * (e.g. "Shakespeare, William")
		 */
		handleCreatorAutoCompleteSelect(textbox) {
			let inputField = textbox.querySelector("input");
			if (!inputField) {
				return;
			}
			var controller = inputField.controller;
			if (!controller?.matchCount) return;
			
			var id = false;
			for (let i = 0; i < controller.matchCount; i++) {
				if (controller.getCommentAt(i) == textbox.value) {
					id = controller.getLabelAt(i);
					break;
				}
			}
			
			// No result selected
			if (!id) {
				return;
			}

			var [creatorID, numFields] = id.split('-');
			
			// If result uses two fields, save both
			if (numFields == 2) {
				// Manually clear autocomplete controller's reference to
				// textbox to prevent error next time around
				inputField.mController.input = null;
				
				var [_field, creatorIndex, creatorField]
					= textbox.getAttribute('fieldname').split('-');
				
				var creator = Zotero.Creators.get(creatorID);
				
				var otherField = creatorField == 'lastName' ? 'firstName' : 'lastName';
				
				// Update this textbox
				textbox.value = creator[creatorField];
				
				// Update the other label
				let label;
				if (otherField == 'firstName') {
					label = textbox.nextSibling;
				}
				else if (otherField == 'lastName') {
					label = textbox.previousSibling;
				}
				
				label.value = creator[otherField];
				
				var row = textbox.closest('.meta-row');
				
				var fields = this.getCreatorFields(row);
				fields[creatorField] = creator[creatorField];
				fields[otherField] = creator[otherField];

				this.modifyCreator(creatorIndex, fields);
				if (this.saveOnEdit) {
					this.ignoreBlur = true;
					this.item.saveTx().then(() => {
						this.ignoreBlur = false;
					});
				}
			}
			
			// Otherwise let the autocomplete popup handle matters
		}
		
		// Handle Shift-Enter on creator input field
		handleCreatorRowKeyDown(event) {
			let target = event.target.closest("editable-text");
			if (!target) return;

			if (event.key == "Enter" && event.shiftKey) {
				event.stopPropagation();
				// Value has changed - focus empty creator row at the bottom
				if (target.initialValue != target.value) {
					this._addCreatorRow = true;
					this.blurOpenField();
					return;
				}
				// Value hasn't changed
				Zotero.debug("Value hasn't changed");
				let row = target.closest('.meta-row');
				// Next row is a creator - focus that
				let nextRow = row.nextSibling;
				if (nextRow.querySelector(".creator-type-value")) {
					nextRow.querySelector("editable-text").focus();
					return;
				}
				// Next row is a "More creators" label - click that
				let moreCreators = nextRow.querySelector("#more-creators-label");
				if (moreCreators) {
					moreCreators.click();
					this._selectField = `itembox-field-value-creator-${this._creatorCount}-lastName`;
				}
				var creatorFields = this.getCreatorFields(row);
				// Do nothing from the last empty row
				if (creatorFields.lastName == "" && creatorFields.firstName == "") return;
				this.addCreatorRow(false, creatorFields.creatorTypeID, true);
			}
		}

		// Handle adding multiple creator rows via paste
		handleCreatorPaste(event) {
			let target = event.target.closest('editable-text');
			var fieldName = target.getAttribute('fieldname');
			let creatorTypeID = parseInt(
				target.closest('.meta-row').querySelector('.meta-label').getAttribute('typeid')
			);
			var [field, creatorIndex, creatorField] = fieldName.split('-');
			let lastName = event.clipboardData.getData('text').trim();
			// Handle \n\r and \n delimited entries and a single line containing a tab
			var rawNameArray = lastName.split(/\r\n?|\n/);
			if (rawNameArray.length > 1 || rawNameArray[0].includes('\t')) {
				// Pasting multiple authors; first make sure we prevent normal paste behavior
				event.preventDefault();

				// Filter out bad names
				var nameArray = rawNameArray.filter(name => name);

				// If not adding names at the end of the creator list, make new creator
				// entries and then shift down existing creators.
				var initNumCreators = this.item.numCreators();
				var creatorsToShift = initNumCreators - creatorIndex;
				if (creatorsToShift > 0) {
					// Add extra creators with dummy values
					for (let i = 0; i < nameArray.length; i++) {
						this.modifyCreator(i + initNumCreators, {
							firstName: '',
							lastName: '',
							fieldMode: 0,
							creatorTypeID
						});
					}

					// Shift existing creators
					for (let i = initNumCreators - 1; i >= creatorIndex; i--) {
						let shiftedCreatorData = this.item.getCreator(i);
						this.item.setCreator(nameArray.length + i, shiftedCreatorData);
					}
				}

				let currentIndex = creatorIndex;
				let newCreator = { creatorTypeID };
				// Add the creators in lastNameArray one at a time
				for (let tempName of nameArray) {
					// Check for tab to determine creator name format
					newCreator.fieldMode = (tempName.indexOf('\t') == -1) ? 1 : 0;
					if (newCreator.fieldMode == 0) {
						newCreator.lastName = tempName.split('\t')[0];
						newCreator.firstName = tempName.split('\t')[1];
					}
					else {
						newCreator.lastName = tempName;
						newCreator.firstName = '';
					}
					this.modifyCreator(currentIndex, newCreator);
					currentIndex++;
				}
				// Select the last field added
				this._selectField = `itembox-field-value-creator-${currentIndex}-lastName`;
				this._addCreatorRow = (creatorsToShift == 0);
				
				if (this.saveOnEdit) {
					this.item.saveTx();
				}
			}
		}
		
		async hideEditor(textbox) {
			if (this.ignoreBlur || !textbox) {
				return;
			}
			// Handle cases where creator autocomplete doesn't trigger
			// the textentered and change events handled in showEditor
			if (textbox.getAttribute('fieldname').startsWith('creator-')) {
				this.handleCreatorAutoCompleteSelect(textbox);
			}
			
			Zotero.debug(`Hiding editor for ${textbox.getAttribute('fieldname')}`);
			
			// Prevent autocomplete breakage in Firefox 3
			if (textbox.mController) {
				textbox.mController.input = null;
			}
			
			var fieldName = textbox.getAttribute('fieldname');
			
			// Multiline fields go back to occupying as much space as needed
			if (Zotero.ItemFields.isMultiline(fieldName)) {
				textbox.setAttribute("min-lines", 1);
			}
			var value = textbox.value.trim();
			
			var [field, creatorIndex, creatorField] = fieldName.split('-');
			
			// Creator fields
			if (field == 'creator') {
				var row = textbox.closest('.meta-row');
				
				var otherFields = this.getCreatorFields(row);
				otherFields[creatorField] = value;
				this.modifyCreator(creatorIndex, otherFields);
				
				if (Zotero.ItemTypes.getName(this.item.itemTypeID) === "bookSection") {
					this._showCreatorTypeGuidance = true;
				}
			}
			
			// Fields
			else {
				// Access date needs to be parsed and converted to UTC SQL date
				if (value != '') {
					switch (fieldName) {
						case 'accessDate':
							// Parse 'yesterday'/'today'/'tomorrow'
							value = Zotero.Date.parseDescriptiveString(value);

							// Allow "now" to use current time
							if (value == 'now') {
								value = Zotero.Date.dateToSQL(new Date(), true);
							}
							// If just date, don't convert to UTC
							else if (Zotero.Date.isSQLDate(value)) {
								let localDate = Zotero.Date.sqlToDate(value);
								value = Zotero.Date.dateToSQL(localDate).replace(' 00:00:00', '');
							}
							else if (Zotero.Date.isSQLDateTime(value)) {
								let localDate = Zotero.Date.sqlToDate(value);
								value = Zotero.Date.dateToSQL(localDate, true);
							}
							else {
								let d = Zotero.Date.strToDate(value);
								value = null;
								if (d.year && d.month != undefined && d.day) {
									d = new Date(d.year, d.month, d.day);
									value = Zotero.Date.dateToSQL(d).replace(' 00:00:00', '');
								}
							}
							textbox.value = this.dateTimeFromUTC(value);
							break;
						
						// TEMP - NSF
						case 'dateSent':
						case 'dateDue':
						case 'accepted':
							if (Zotero.Date.isSQLDate(value)) {
								let localDate = Zotero.Date.sqlToDate(value);
								value = Zotero.Date.dateToSQL(localDate).replace(' 00:00:00', '');
							}
							else {
								let d = Zotero.Date.strToDate(value);
								value = null;
								if (d.year && d.month != undefined && d.day) {
									d = new Date(d.year, d.month, d.day);
									value = Zotero.Date.dateToSQL(d).replace(' 00:00:00', '');
								}
							}
							textbox.value = this.dateTimeFromUTC(value);
							break;
						
						default:
							// TODO: generalize to all date rows/fields
							if (Zotero.ItemFields.isFieldOfBase(fieldName, 'date')) {
								// Parse 'yesterday'/'today'/'tomorrow'
								value = Zotero.Date.parseDescriptiveString(value);
							}
					}
				}
				
				this._modifyField(fieldName, value);
			}
			
			if (this.saveOnEdit) {
				await this.item.saveTx();
			}
		}
		
		_rowIsClickable(fieldName) {
			return this.clickByRow
					&& (this.clickable
						|| this._clickableFields.indexOf(fieldName) != -1);
		}
		
		_fieldIsClickable(fieldName) {
			return !this.clickByRow
					&& ((this.clickable && !Zotero.Items.isPrimaryField(fieldName))
					|| this._clickableFields.indexOf(fieldName) != -1);
		}
		
		_modifyField(field, value) {
			this.item.setField(field, value);
		}
		
		async _setFieldTransformedValue(label, newValue) {
			label.value = newValue;
			var fieldName = label.getAttribute('fieldname');
			this._modifyField(fieldName, newValue);
			
			if (Zotero.ItemFields.isFieldOfBase(fieldName, 'title')) {
				let shortTitleVal = this.item.getField('shortTitle');
				if (newValue.toLowerCase().startsWith(shortTitleVal.toLowerCase())) {
					this._modifyField('shortTitle', newValue.substring(0, shortTitleVal.length));
				}
			}

			if (this.saveOnEdit) {
				await this.item.saveTx();
			}
		}
		

		// Make sure that irrelevant creators +/- buttons are disabled
		_updateCreatorButtonsStatus() {
			let creatorValues = [...this.querySelectorAll(".creator-type-value")];
			let row;
			for (let creatorValue of creatorValues) {
				row = creatorValue.closest(".meta-row");
				let { lastName, firstName } = this.getCreatorFields(row);
				let isEmpty = lastName == "" && firstName == "";
				let isNextRowUnsavedCreator = row.nextSibling?.querySelector(".creator-type-value[unsaved=true]");
				let isDefaultEmptyRow = isEmpty && creatorValues.length == 1;
		
				if (!this.editable) {
					row.querySelector(".zotero-clicky-plus").hidden = true;
					row.querySelector(".zotero-clicky-minus").hidden = true;
					row.querySelector(".zotero-clicky-options").hidden = true;
					return;
				}

				row.querySelector(".zotero-clicky-plus").disabled = isEmpty || isNextRowUnsavedCreator;
				row.querySelector(".zotero-clicky-minus").disabled = isDefaultEmptyRow;
			}
		}

		getCreatorFields(row) {
			var typeID = row.querySelector('[typeid]').getAttribute('typeid');
			var [label1, label2] = row.querySelectorAll('editable-text');
			var fieldMode = row.querySelector('[fieldMode]')?.getAttribute('fieldMode');
			var unsavedIndex = null;
			// Fetch positioning of a newly added unsaved row. It will be the index of
			// this creator after the item is saved
			if (row.querySelector("[unsaved=true]")) {
				let previousRow = row.previousSibling;
				unsavedIndex = 0;
				if (previousRow.querySelector(".creator-type-value")) {
					unsavedIndex = 1 + parseInt(previousRow.querySelector(".creator-type-label").id.split('-')[1]);
				}
			}
			var fields = {
				lastName: label1.value,
				firstName: label2.value,
				fieldMode: fieldMode ? parseInt(fieldMode) : 0,
				creatorTypeID: parseInt(typeID),
				unsavedIndex: unsavedIndex,
			};
			
			return fields;
		}
		
		modifyCreator(index, fields) {
			var firstName = fields.firstName;
			var lastName = fields.lastName;
			
			var oldCreator = this.item.getCreator(index);
			
			// Don't save empty creators
			if (!firstName && !lastName) {
				if (!oldCreator) {
					return false;
				}
				return this.item.removeCreator(index);
			}
			this.item.setCreator(index, fields);
			// If this is a newly added row and there is an unsaved index,
			// shift all creators and update all indices.
			if (fields.unsavedIndex) {
				// Skip saving in this call to avoid extra re-rendering
				this.moveCreator(index, null, fields.unsavedIndex, true);
			}
			return true;
		}
		
		/**
		 * @return {Promise}
		 */
		async swapNames(_event) {
			var row = document.popupNode.closest('.meta-row');
			var typeBox = row.querySelector('[fieldname]');
			var creatorIndex = parseInt(typeBox.getAttribute('fieldname').split('-')[1]);
			var fields = this.getCreatorFields(row);
			var lastName = fields.lastName;
			var firstName = fields.firstName;
			fields.lastName = firstName;
			fields.firstName = lastName;
			this.modifyCreator(creatorIndex, fields);
			
			if (this.saveOnEdit) {
				await this.item.saveTx();
			}
		}
		
		canCapitalizeCreatorName(row) {
			var fields = this.getCreatorFields(row);
			return fields.firstName && Zotero.Utilities.capitalizeName(fields.firstName) != fields.firstName
				|| fields.lastName && Zotero.Utilities.capitalizeName(fields.lastName) != fields.lastName;
		}

		/**
		 * @return {Promise}
		 */
		async capitalizeCreatorName(_event) {
			var row = document.popupNode.closest('.meta-row');
			let label = row.querySelector('.meta-label');
			var creatorIndex = parseInt(label.getAttribute('fieldname').split('-')[1]);
			let [lastName, firstName] = [...row.querySelectorAll("editable-text")];
			lastName.value = Zotero.Utilities.capitalizeName(lastName.value);
			firstName.value = Zotero.Utilities.capitalizeName(firstName.value);
			var fields = this.getCreatorFields(row);
			this.modifyCreator(creatorIndex, fields);
			if (this.saveOnEdit) {
				await this.item.saveTx();
			}
		}

		// Returns a function that handles draggable creator row being dropped to a different location
		handleCreatorRowDrop() {
			return (e) => {
				e.preventDefault();
				let row = e.target.closest(".meta-row");
				let index = parseInt(e.dataTransfer.getData("zotero/creator"));
				let nextSibling = row.nextSibling;
				let beforeCreatorField = nextSibling.querySelector('.meta-label').getAttribute('fieldname') || "";
				let beforeCreatorIndex;
				// The creator row is dropped before "X more..." creators label
				if (nextSibling.querySelector("#more-creators-label")) {
					beforeCreatorIndex = this._initialVisibleCreators;
				}
				// The creator row is dropped before a non-creator row, meaning it's moved below
				// all other creators
				else if (!beforeCreatorField.includes("creator-")) {
					beforeCreatorIndex = this.item.numCreators();
				}
				// Creator row is placed before another creator
				else {
					beforeCreatorIndex = parseInt(beforeCreatorField.split('-')[1]);
				}
				// No change in order - do nothing
				if (beforeCreatorIndex == index + 1) {
					return;
				}
				this._draggedCreator = true;
				// Due to some kind of drag-drop API issue,
				// after creator is dropped, the hover effect often stays at
				// the row's old location. To workaround that, set noHover class to block all
				// hover effects on creator rows and then remove it on the first mouse movement in refresh().
				for (let label of document.querySelectorAll(".meta-label[fieldname^='creator-']")) {
					label.closest(".meta-row").classList.add("noHover");
				}
				// Un-hide the moved creator row
				this.querySelector(".drag-hidden-creator").classList.remove("drag-hidden-creator");
				// Update the item after small delay to avoid blinking
				setTimeout(() => {
					this.moveCreator(index, null, beforeCreatorIndex);
				}, 250);
			};
		}

		// Given the index of creator row and the row itself, returns the drag over handler.
		// When a creator row is dragged over, an empty placeholder is added in its place.
		handleCreatorDragOver(rowIndex, row) {
			return (e) => {
				e.preventDefault();
				let index = e.dataTransfer.getData("zotero/creator");
				if (!index) {
					return false;
				}
				let placeholder = this.querySelector(".drag-hidden-creator");
				if (row.previousSibling == placeholder) {
					// If the placeholder exists before the row, swap the placeholder and the row
					row.parentNode.insertBefore(row, placeholder);
				}
				else if (index != rowIndex) {
					// Insert placeholder before the row
					row.parentNode.insertBefore(placeholder, row);
				}
				return true;
			};
		}

		moveCreator(index, dir, newIndex, skipSave) {
			if (index == 0 && dir == 'up') {
				Zotero.debug("Can't move up creator 0");
				return;
			}
			else if (index + 1 == this.item.numCreators() && dir == 'down') {
				Zotero.debug("Can't move down last creator");
				return;
			}
			else if (newIndex && index == newIndex) {
				return;
			}

			if (!newIndex) {
				switch (dir) {
					case 'top':
						newIndex = 0;
						break;
					
					case 'up':
						newIndex = index - 1;
						break;
					
					case 'down':
						newIndex = index + 2; // Insert after the desired element
						break;
				}
			}
			let creator = this.item.getCreator(index);
			let creators = this.item.getCreators();
			// Insert creator
			creators.splice(newIndex, 0, creator);
			// Remove creator from old location
			creators.splice(newIndex < index ? index + 1 : index, 1);
			// Determine range where indices need to be updated
			let startUpdateIndex = Math.min(index, newIndex);
			let endUpdateIndex = Math.max(index, newIndex);
			// Shift indices of affected creators
			for (let i = startUpdateIndex; i <= endUpdateIndex; i++) {
				if (!creators[i]) {
					break;
				}
				this.item.setCreator(i, creators[i]);
			}
			if (this.saveOnEdit && !skipSave) {
				this.item.saveTx();
			}
		}
		
		focusField(fieldName) {
			this.querySelector(`editable-text[fieldname="${fieldName}"]`)?.focus();
		}

		_saveFieldFocus() {
			let activeElement = document.activeElement;
			if (!this._infoTable.contains(activeElement)) {
				return;
			}
			
			let field = activeElement.closest("[fieldname], [tabindex], [focusable]");
			let fieldID;
			// Special treatment for unsaved creator rows. When they are just added, their ids
			// do not correspond to their positioning to avoid shifting all creators in case new row is not saved.
			// So, use the index that this row will occupy after saving.
			let maybeRow = field.closest(".meta-row");
			if (maybeRow?.querySelector(".creator-type-value[unsaved=true]")) {
				let { unsavedIndex } = this.getCreatorFields(maybeRow);
				fieldID = (field?.id || "").replace(/\d+/g, unsavedIndex);
			}
			else if (field?.id) {
				fieldID = field.id;
			}
			else {
				return;
			}

			// If we'd already set _selectField to this field, abort - we don't want to
			// overwrite the saved selection
			if (fieldID === this._selectField) {
				return;
			}

			// Save the field ID
			this._selectField = fieldID;

			// Save selection inside inputs
			let targetInput = activeElement.closest("input, textarea");
			if (targetInput) {
				this._selectFieldSelection = [
					targetInput.selectionStart,
					targetInput.selectionEnd,
					targetInput.selectionDirection,
				];
			}
		}
		
		_clearSavedFieldFocus() {
			this._selectField = null;
			this._selectFieldSelection = null;
		}

		_restoreFieldFocus() {
			if (!this._selectField) {
				return;
			}
			let refocusField = this.querySelector(`#${CSS.escape(this._selectField)}`);
			if (!refocusField) {
				return;
			}
			refocusField.focus();
			
			if (this._selectFieldSelection) {
				let input = refocusField.querySelector("input, textarea");
				if (input) {
					input.setSelectionRange(...this._selectFieldSelection);
				}
			}
		}

		getTitleField() {
			var titleFieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(this.item.itemTypeID, 'title');
			return this._infoTable.querySelector(`editable-text[fieldname="${Zotero.ItemFields.getName(titleFieldID)}"]`);
		}

		getFocusedTextArea() {
			let input = this._infoTable.querySelector('input[data-initial-value], textarea[data-initial-value]');
			if (input) {
				return input.closest('editable-text');
			}
			return null;
		}
		
		blurOpenField() {
			var activeField = this.getFocusedTextArea();
			if (!activeField) {
				return false;
			}
			return activeField.blur();
		}

		handlePopupOpening(event, popup) {
			event.preventDefault();
			event.stopPropagation();
			
			let isRightClick = event.type == 'contextmenu';
			if (!isRightClick) {
				event.target.style.visibility = "visible";
				event.target.style.display = "revert";
			}
			// On click, we have x/y coordinates so use that
			// On keyboard click, open it next to the target
			if (event.screenX) {
				popup.openPopupAtScreen(
					event.screenX + (isRightClick ? 0 : -5),
					event.screenY + (isRightClick ? 0 : 5),
					true
				);
			}
			else {
				popup.openPopup(event.target);
			}
		}
		
		/**
		 * Available handlers:
		 *
		 *   - 'itemtypechange'
		 *
		 * Note: 'this' in the function will be bound to the item box.
		 */
		addHandler(eventName, func) {
			if (!this.eventHandlers[eventName]) {
				this.eventHandlers[eventName] = [];
			}
			this.eventHandlers[eventName].push(func);
		}
		
		removeHandler(eventName, func) {
			if (!this.eventHandlers[eventName]) {
				return;
			}
			var pos = this.eventHandlers[eventName].indexOf(func);
			if (pos != -1) {
				this.eventHandlers[eventName].splice(pos, 1);
			}
		}
		
		updateRetracted() {
			// Create the real function here so we can use Zotero.serial(). updateRetracted()
			// isn't awaited in refresh(), so we want to make sure successive invocations
			// don't overlap.
			if (!this._updateRetracted) {
				this._updateRetracted = Zotero.serial(async function (item) {
					var show = Zotero.Retractions.isRetracted(item);
					if (!show) {
						this._id('retraction-box').hidden = true;
						return;
					}
					var data = await Zotero.Retractions.getData(item);
					
					this._id('retraction-box').hidden = false;
					this._id('retraction-header-text').textContent
						= Zotero.getString('retraction.banner');
					
					// Date
					if (data.date) {
						this._id('retraction-date').hidden = false;
						this._id('retraction-date').textContent = Zotero.getString(
							'retraction.date',
							data.date.toLocaleDateString()
						);
					}
					else {
						this._id('retraction-date').hidden = true;
					}
					
					// Reasons
					var allowHiding = false;
					if (data.reasons.length) {
						let elem = this._id('retraction-reasons');
						elem.hidden = false;
						elem.textContent = '';
						for (let reason of data.reasons) {
							let dt = document.createElement('dt');
							let dd = document.createElement('dd');
							
							dt.textContent = reason;
							dd.textContent = Zotero.Retractions.getReasonDescription(reason);
							
							elem.appendChild(dt);
							elem.appendChild(dd);
							
							if (reason == 'Retract and Replace') {
								allowHiding = true;
							}
						}
					}
					else {
						this._id('retraction-reasons').hidden = true;
					}
					
					// Retraction DOI or PubMed ID
					if (data.doi || data.pmid) {
						let div = this._id('retraction-notice');
						div.textContent = '';
						let a = document.createElement('a');
						a.textContent = Zotero.getString('retraction.notice');
						if (data.doi) {
							a.href = 'https://doi.org/' + data.doi;
						}
						else {
							a.href = `https://www.ncbi.nlm.nih.gov/pubmed/${data.pmid}/`;
						}
						div.appendChild(a);
					}
					else {
						this._id('retraction-notice').hidden = true;
					}
					
					// Links
					if (data.urls.length) {
						let div = this._id('retraction-links');
						div.hidden = false;
						div.textContent = '';
						
						let p = document.createElement('p');
						p.textContent = Zotero.getString('retraction.details');
						
						let ul = document.createElement('ul');
						for (let url of data.urls) {
							let li = document.createElement('li');
							let a = document.createElement('a');
							url = url.replace(/^http:/, 'https:');
							a.href = url;
							a.textContent = url;
							li.appendChild(a);
							ul.appendChild(li);
						}
						
						div.appendChild(p);
						div.appendChild(ul);
					}
					else {
						this._id('retraction-links').hidden = true;
					}
					
					let creditElem = this._id('retraction-credit');
					if (!creditElem.childNodes.length) {
						let text = Zotero.getString(
							'retraction.credit',
							'<a href="https://retractionwatch.com">Retraction Watch</a>'
						);
						let parts = Zotero.Utilities.parseMarkup(text);
						for (let part of parts) {
							if (part.type == 'text') {
								creditElem.appendChild(document.createTextNode(part.text));
							}
							else if (part.type == 'link') {
								let a = document.createElement('a');
								a.href = part.attributes.href;
								a.textContent = part.text;
								creditElem.appendChild(a);
							}
						}
					}
					
					let hideElem = this._id('retraction-hide');
					hideElem.firstChild.textContent = Zotero.getString('retraction.replacedItem.hide');
					hideElem.hidden = !allowHiding;
					hideElem.firstChild.onclick = (_event) => {
						ZoteroPane.promptToHideRetractionForReplacedItem(item);
					};
					
					Zotero.Utilities.Internal.updateHTMLInXUL(this._id('retraction-box'));
				}.bind(this));
			}
			
			return this._updateRetracted(this.item);
		}
		
		_id(id) {
			return this.querySelector(`#${id}`);
		}
	}
	customElements.define("item-box", ItemBox);
}
