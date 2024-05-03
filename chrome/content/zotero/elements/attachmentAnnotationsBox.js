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
	class AttachmentAnnotationsBox extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-attachments-annotations" data-pane="attachment-annotations">
				<html:div class="body">
				</html:div>
			</collapsible-section>
		`);

		get tabType() {
			return this._tabType;
		}

		set tabType(tabType) {
			super.tabType = tabType;
			this._updateHidden();
		}
		
		get item() {
			return this._item;
		}

		set item(item) {
			super.item = item;
			this._annotations = [];
			this._updateHidden();
		}

		set annotations(items) {
			if (items.some(item => !item.isAnnotation())) return;
			this.item = null;
			this._annotations = items;
		}

		get annotations() {
			if (this._annotations?.length) {
				return this._annotations;
			}
			if (this.item?.isFileAttachment()) {
				return this.item.getAnnotations();
			}
			if (this.item?.isAnnotation()) {
				return [this.item];
			}
			return [];
		}

		init() {
			this.initCollapsibleSection();

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
			if (this._isAlreadyRendered()) return;

			this._section.setCount(this.annotations.length);

			this._body.replaceChildren();

			if (!this._section.open) {
				return;
			}

			let count = this.annotations.length;
			if (count === 0) {
				this.hidden = true;
				return;
			}

			this.hidden = false;
			for (let annotation of this.annotations) {
				let row = document.createXULElement('annotation-row');
				row.annotation = annotation;
				this._body.append(row);
			}
		}

		_updateHidden() {
			this.hidden = this.annotations.length == 0 || this.tabType == "reader";
		}
	}
	customElements.define("attachment-annotations-box", AttachmentAnnotationsBox);
}
