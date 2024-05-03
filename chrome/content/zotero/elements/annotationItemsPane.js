/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
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

{
	class AnnotationItemsPane extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="custom-head"></html:div>
			<html:div class="body zotero-view-item"> </html:div>
		`);

		set items(items) {
			if (items.some(item => !item.isAnnotation())) return;
			this._items = items;
		}

		get items() {
			return this._items || [];
		}

		init() {
			this._body = this.querySelector('.body');
		}

		destroy() {}

		notify(action, type, ids) {
			if (action == 'modify' && this.item && ids.includes(this.item.id)) {
				this._forceRenderAll();
			}
		}

		render() {
			if (!this.initialized && this.annotations.length == 0) return;

			this._body.replaceChildren();

			let count = this.items.length;
			if (count === 0) {
				this.hidden = true;
				return;
			}
			let topLevelItems = Zotero.Items.getTopLevel(this.items);
			for (let parentItem of topLevelItems) {
				let selectedAnnotations = this.items.filter(item => item.topLevelItem.id == parentItem.id);
				let section = MozXULElement.parseXULToFragment(
					`<collapsible-section
						data-l10n-id="section-attachments-annotations"
						data-l10n-args='{"count" : "${selectedAnnotations.length}"}'
						data-pane="annotations_of_item_${parentItem.id}"
						summary="${parentItem.getDisplayTitle()}">

						<html:div class="body"></html:div>

					</collapsible-section>`
				);
				for (let annotation of selectedAnnotations) {
					let row = document.createXULElement('annotation-row');
					row.annotation = annotation;
					section.querySelector('.body').append(row);
				}
				this._body.append(section);
			}
		}

		renderCustomHead(callback) {
			let customHead = this.querySelector(".custom-head");
			customHead.replaceChildren();
			let append = (...args) => {
				customHead.append(...args);
			};
			if (callback) callback({
				doc: document,
				append,
			});
		}

		_updateHidden() {
			this.hidden = this.items.length == 0;
		}
	}

	customElements.define("annotation-items-pane", AnnotationItemsPane);
}
