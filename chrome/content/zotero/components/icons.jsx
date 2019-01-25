'use strict';

const React = require('react')
const { PureComponent } = React
const { element, string } = require('prop-types')
const cx = require('classnames')

const Icon = ({ children, className, name }) => (
	<span className={cx('icon', `icon-${name}`, className)}>
		{children}
	</span>
)

Icon.propTypes = {
	children: element.isRequired,
	className: string,
	name: string.isRequired
}

module.exports = { Icon }


function i(name, svgOrSrc, hasDPI=true) {
	const icon = class extends PureComponent {
		render() {
			const { className } = this.props;
			
			if (typeof svgOrSrc == 'string') {
				let srcset = [svgOrSrc + ' 16w'];
				let sizes = ['16px'];
				if (hasDPI) {
					let parts = svgOrSrc.split('.');
					parts[parts.length-2] = parts[parts.length-2] + '@2x';
					srcset.push(parts.join('.') + ' 32w');
					sizes.push('(min-resolution: 1.25dppx) 32px')
				}
				return (
					<Icon className={className} name={name.toLowerCase()}>
						<img srcset={srcset.join(',')} sizes={sizes.join(',')}/>
					</Icon>
				)
			}

			return (
				<Icon className={className} name={name.toLowerCase()}>{svgOrSrc}</Icon>
			)
		}
	}

	icon.propTypes = {
		className: string
	}

	icon.displayName = `Icon${name}`

	module.exports[icon.displayName] = icon
}

/* eslint-disable max-len */


i('TagSelectorMenu', "chrome://zotero/skin/tag-selector-menu.png");
i('DownChevron', "chrome://zotero/skin/searchbar-dropmarker.png");
i('Twisty', <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"></svg>);
i('Twisty', (
	/* This Source Code Form is subject to the terms of the Mozilla Public
	 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
	 * You can obtain one at http://mozilla.org/MPL/2.0/. */
	<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
		<path d="M8 13.4c-.5 0-.9-.2-1.2-.6L.4 5.2C0 4.7-.1 4.3.2 3.7S1 3 1.6 3h12.8c.6 0 1.2.1 1.4.7.3.6.2 1.1-.2 1.6l-6.4 7.6c-.3.4-.7.5-1.2.5z"/>
	</svg>
));

// TreeItems
i('TreeitemArtwork', 'chrome://zotero/skin/treeitem-artwork.png');
i('TreeitemAttachmentLink', 'chrome://zotero/skin/treeitem-attachment-link.png');
i('TreeitemAttachmentPdf', 'chrome://zotero/skin/treeitem-attachment-pdf.png');
i('TreeitemAttachmentSnapshot', 'chrome://zotero/skin/treeitem-attachment-snapshot.png');
i('TreeitemAttachmentWebLink', 'chrome://zotero/skin/treeitem-attachment-web-link.png');
i('TreeitemAudioRecording', 'chrome://zotero/skin/treeitem-audioRecording.png');
i('TreeitemBill', 'chrome://zotero/skin/treeitem-bill.png');
i('TreeitemBlogPost', 'chrome://zotero/skin/treeitem-blogPost.png');
i('TreeitemBook', 'chrome://zotero/skin/treeitem-book.png');
i('TreeitemBookSection', 'chrome://zotero/skin/treeitem-bookSection.png');
i('TreeitemCase', 'chrome://zotero/skin/treeitem-case.png');
i('TreeitemComputerProgram', 'chrome://zotero/skin/treeitem-computerProgram.png');
i('TreeitemConferencePaper', 'chrome://zotero/skin/treeitem-conferencePaper.png');
i('TreeitemDictionaryEntry', 'chrome://zotero/skin/treeitem-dictionaryEntry.png');
i('TreeitemEmail', 'chrome://zotero/skin/treeitem-email.png');
i('TreeitemEncyclopediaArticle', 'chrome://zotero/skin/treeitem-encyclopediaArticle.png');
i('TreeitemFilm', 'chrome://zotero/skin/treeitem-film.png');
i('TreeitemForumPost', 'chrome://zotero/skin/treeitem-forumPost.png');
i('TreeitemHearing', 'chrome://zotero/skin/treeitem-hearing.png');
i('TreeitemInstantMessage', 'chrome://zotero/skin/treeitem-instantMessage.png');
i('TreeitemInterview', 'chrome://zotero/skin/treeitem-interview.png');
i('TreeitemJournalArticle', 'chrome://zotero/skin/treeitem-journalArticle.png');
i('TreeitemLetter', 'chrome://zotero/skin/treeitem-letter.png');
i('TreeitemMagazineArticle', 'chrome://zotero/skin/treeitem-magazineArticle.png');
i('TreeitemManuscript', 'chrome://zotero/skin/treeitem-manuscript.png');
i('TreeitemMap', 'chrome://zotero/skin/treeitem-map.png');
i('TreeitemNewspaperArticle', 'chrome://zotero/skin/treeitem-newspaperArticle.png');
i('TreeitemNote', 'chrome://zotero/skin/treeitem-note.png');
i('TreeitemNoteSmall', 'chrome://zotero/skin/treeitem-note-small.png');
i('TreeitemPatent', 'chrome://zotero/skin/treeitem-patent.png');
i('Treeitem', 'chrome://zotero/skin/treeitem.png');
i('TreeitemPodcast', 'chrome://zotero/skin/treeitem-podcast.png');
i('TreeitemPresentation', 'chrome://zotero/skin/treeitem-presentation.png');
i('TreeitemRadioBroadcast', 'chrome://zotero/skin/treeitem-radioBroadcast.png');
i('TreeitemReport', 'chrome://zotero/skin/treeitem-report.png');
i('TreeitemStatute', 'chrome://zotero/skin/treeitem-statute.png');
i('TreeitemThesis', 'chrome://zotero/skin/treeitem-thesis.png');
i('TreeitemTvBroadcast', 'chrome://zotero/skin/treeitem-tvBroadcast.png');
i('TreeitemVideoRecording', 'chrome://zotero/skin/treeitem-videoRecording.png');
i('TreeitemWebpageGray', 'chrome://zotero/skin/treeitem-webpage-gray.png');
i('TreeitemWebpage', 'chrome://zotero/skin/treeitem-webpage.png');

// Treesource
i('TreesourceBucket', 'chrome://zotero/skin/treesource-bucket.png');
i('TreesourceCollection', 'chrome://zotero/skin/treesource-collection.png');
i('TreesourceCommons', 'chrome://zotero/skin/treesource-commons.png');
i('TreesourceDuplicates', 'chrome://zotero/skin/treesource-duplicates.png');
i('TreesourceFeedError', 'chrome://zotero/skin/treesource-feed-error.png');
i('TreesourceFeedLibrary', 'chrome://zotero/skin/treesource-feedLibrary.png');
i('TreesourceFeed', 'chrome://zotero/skin/treesource-feed.png');
i('TreesourceFeedUpdating', 'chrome://zotero/skin/treesource-feed-updating.png');
i('TreesourceGroups', 'chrome://zotero/skin/treesource-groups.png');
i('TreesourceLibrary', 'chrome://zotero/skin/treesource-library.png');
i('TreesourceSearch', 'chrome://zotero/skin/treesource-search.png');
i('TreesourceShare', 'chrome://zotero/skin/treesource-share.png');
i('TreesourceTrashFull', 'chrome://zotero/skin/treesource-trash-full.png');
i('TreesourceTrash', 'chrome://zotero/skin/treesource-trash.png');
i('TreesourceUnfiled', 'chrome://zotero/skin/treesource-unfiled.png');

if (Zotero.isMac) {
	i('TreesourceCollection', 'chrome://zotero-platform/content/treesource-collection.png');
	i('TreesourceSearch', 'chrome://zotero-platform/content/treesource-search.png');
	i('Twisty', (
		/* This Source Code Form is subject to the terms of the Mozilla Public
		 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
		 * You can obtain one at http://mozilla.org/MPL/2.0/. */
		<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
			<polyline points="3 4 12 4 7.5 12"/>
		</svg>
	));
}

if (Zotero.isWin) {
	i('Twisty', (
		/* This Source Code Form is subject to the terms of the Mozilla Public
		 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
		 * You can obtain one at http://mozilla.org/MPL/2.0/. */
		<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1792 1792">
			<path d="M1395 736q0 13-10 23l-466 466q-10 10-23 10t-23-10l-466-466q-10-10-10-23t10-23l50-50q10-10 23-10t23 10l393 393 393-393q10-10 23-10t23 10l50 50q10 10 10 23z"/>
		</svg>
	));
}