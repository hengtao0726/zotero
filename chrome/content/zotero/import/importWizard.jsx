/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://digitalscholar.org
    
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

/* eslint camelcase: ["error", {allow: ["Zotero_File_Interface", "Zotero_Import_Wizard"]} ] */
/* global Zotero_File_Interface: false */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import FilePicker from 'zotero/filePicker';
import ReactDom from 'react-dom';
import Wizard from './components/wizard';
import WizardPage from './components/wizardPage';
import RadioSet from './components/radioSet';
import ProgressBar from './components/progressBar';
import ProgressQueueTable from './components/progressQueueTable';
import { nextHTMLID } from './components/utils';

const ImportWizard = memo(({ mendeleyCode, libraryID }) => {
	const id = useRef(nextHTMLID());
	const translationResult = useRef(null);
	const wizardRef = useRef(null);
	const [selectedMode, setSelectedMode] = useState('file');
	const [fileHandling, setFileHandling] = useState('store');
	const [file, setFile] = useState(null);
	const [folder, setFolder] = useState(null);
	const [doneLabel, setDoneLabel] = useState(null);
	const [doneDescription, setDoneDescription] = useState(null);
	const [shouldShowErrorButton, setShouldShowErrorButton] = useState(false);
	const [shouldCreateCollection, setShouldCreateCollection] = useState(true);
	const [shouldRecreateStructure, setShouldRecreateStructure] = useState(true);
	const [shouldImportPDF, setShouldImportPDF] = useState(true);
	const [shouldImportOther, setShouldImportOther] = useState(false);
	const [fileTypes, setFileTypes] = useState('');
	const [canAdvance, setCanAdvance] = useState(true);
	const [canRewind, setCanRewind] = useState(true);
	const [canCancel, setCanCancel] = useState(true);
	const [progress, setProgress] = useState(0);
	const [progressQueue, setProgressQueue] = useState(null);

	const importSourceOptions = [
		{ label: Zotero.getString('import.source.file'), value: 'file' },
		{ label: Zotero.getString('import.source.folder'), value: 'folder' },
		{ label: `Mendeley Reference Manager (${Zotero.getString('import.onlineImport')})`, value: 'mendeleyOnline' },
	];

	const fileHandlingOptions = [
		{ label: Zotero.getString('import.fileHandling.store', Zotero.appName), value: 'store' },
		{ label: Zotero.getString('import.fileHandling.link'), value: 'link' }
	];

	const chooseFile = useCallback(async () => {
		var translation = new Zotero.Translate.Import();
		var translators = await translation.getTranslators();
		var fp = new FilePicker();
		fp.init(window, Zotero.getString("fileInterface.import"), fp.modeOpen);
		fp.appendFilters(fp.filterAll);
		var collation = Zotero.getLocaleCollation();
		
		// Add Mendeley DB, which isn't a translator
		var mendeleyFilter = {
			label: "Mendeley Database", // TODO: Localize
			target: "*.sqlite"
		};
		var filters = [...translators];
		filters.push(mendeleyFilter);
		
		filters.sort((a, b) => collation.compareString(1, a.label, b.label));
		for (let filter of filters) {
			fp.appendFilter(filter.label, "*." + filter.target);
		}
		
		var rv = await fp.show();
		if (rv !== fp.returnOK && rv !== fp.returnReplace) {
			return;
		}
		
		Zotero.debug(`File is ${fp.file}`);

		setFile(fp.file);
		setCanAdvance(true);
		wizardRef.current.goTo('page-options');
	}, []);

	const chooseFolder = useCallback(async () => {
		const fp = new FilePicker();
		fp.init(window, Zotero.getString('attachmentBasePath.selectDir'), fp.modeGetFolder);
		fp.appendFilters(fp.filterAll);

		const rv = await fp.show();
		if (rv !== fp.returnOK && rv !== fp.returnReplace) {
			return;
		}
		
		Zotero.debug(`Folder is ${fp.file}`);

		setFolder(fp.file);
		setCanAdvance(true);
		wizardRef.current.goTo('page-options');
	}, []);

	const skipToDonePage = useCallback((label, description, showReportErrorButton = false) => {
		setDoneLabel(label);
		setShouldShowErrorButton(showReportErrorButton);
		setDoneDescription(description);
		
		// When done, move to last page and allow closing
		setCanAdvance(true);
		wizardRef.current.goTo('page-done');
		setCanRewind(false);
	}, []);

	const updateCreateCollectionsCheckbox = useCallback(async () => {
		const sql = "SELECT ROWID FROM collections WHERE libraryID=?1 "
			+ "UNION "
			+ "SELECT ROWID FROM items WHERE libraryID=?1 "
			// Not in trash
			+ "AND itemID NOT IN (SELECT itemID FROM deletedItems) "
			// And not a child item (which doesn't necessarily show up in the trash)
			+ "AND itemID NOT IN (SELECT itemID FROM itemNotes WHERE parentItemID IS NOT NULL) "
			+ "AND itemID NOT IN (SELECT itemID FROM itemAttachments WHERE parentItemID IS NOT NULL) "
			+ "LIMIT 1";
		setShouldCreateCollection(await Zotero.DB.valueQueryAsync(sql, libraryID));
	}, [libraryID]);

	const handleClose = useCallback(() => {
		if (progressQueue) {
			progressQueue.cancel();
		}
		window.close();
	}, [progressQueue]);

	const handleFinish = useCallback(() => {
		if (progressQueue) {
			progressQueue.cancel();
		}
	}, [progressQueue]);

	const findFiles = useCallback(async () => {
		try {
			switch (selectedMode) {
				case 'file':
					setFolder(null);
					await chooseFile();
					break;
				case 'folder':
					setFile(null);
					await chooseFolder();
					break;
				case 'mendeleyOnline':
					setFile(null);
					setFolder(null);
					wizardRef.current.goTo('mendeley-online-intro');
					setCanRewind(true);
					break;
				default:
					throw new Error(`Unknown mode ${selectedMode}`);
			}
		}
		catch (e) {
			skipToDonePage(
				Zotero.getString('general.error'),
				Zotero.getString('fileInterface.importError'),
				true
			);
			throw e;
		}
	}, [chooseFile, chooseFolder, selectedMode, skipToDonePage]);

	const handleModeChosen = useCallback(() => {
		findFiles();
		return false; // must return false to prevent wizard advancing
	}, [findFiles]);

	const handleSourceChange = useCallback((newSource) => {
		setSelectedMode(newSource);
	}, []);

	const handleReportErrorClick = useCallback(() => {
		Zotero.getActiveZoteroPane().reportErrors();
		window.close();
	}, []);

	const handleCreateCollectionCheckboxChange = useCallback(() => {
		setShouldCreateCollection(!shouldCreateCollection);
	}, [shouldCreateCollection]);

	const handleRecreateStructureChange = useCallback(() => {
		setShouldRecreateStructure(!shouldRecreateStructure);
	}, [shouldRecreateStructure]);

	const handleFileHandlingChange = useCallback((newFileHandling) => {
		setFileHandling(newFileHandling);
	}, []);

	const handleImportPDFChange = useCallback(() => {
		setShouldImportPDF(prevShouldImportPDF => !prevShouldImportPDF);
	}, []);

	const handleImportOtherChange = useCallback(() => {
		setShouldImportOther(prevShouldImportOther => !prevShouldImportOther);
	}, []);

	const handleOtherFileTypesChange = useCallback((ev) => {
		setFileTypes(ev.currentTarget.value);
		setShouldImportOther(ev.currentTarget.value.length > 0);
	}, []);

	const handleBeforeImport = useCallback(async (translation) => {
		// Unrecognized translator
		if (!translation) {
			// Allow error dialog to be displayed, and then close window
			setTimeout(function () {
				window.close();
			});
			return;
		}
		
		translationResult.current = translation;
		
		// Switch to progress pane
		wizardRef.current.goTo('page-progress');
		translation.setHandler('itemDone', function () {
			setProgress(translation.getProgress());
		});
	}, []);

	const handleUrlClick = useCallback((ev) => {
		Zotero.launchURL(ev.currentTarget.href);
		window.close();
		ev.preventDefault();
	}, []);

	const handleProgressPageShow = useCallback(() => {
		setCanRewind(false);
		if (folder) {
			setProgressQueue(Zotero.ProgressQueues.get('recognize'));
		}
	}, [folder]);

	const beginOnlineImport = useCallback(() => {
		const arg = Components.classes["@mozilla.org/supports-string;1"]
			.createInstance(Components.interfaces.nsISupportsString);
		arg.data = 'mendeleyImport';

		window.close();

		Services.ww.openWindow(null, "chrome://zotero/content/standalone/basicViewer.xhtml",
			"basicViewer", "chrome,dialog=yes,centerscreen,width=1000,height=700,modal", arg);
		
	}, []);

	const startImport = useCallback(async () => {
		setCanCancel(false);
		setCanAdvance(false);
		setCanRewind(false);
		
		try {
			let result = await Zotero_File_Interface.importFile({
				file: file,
				onBeforeImport: handleBeforeImport,
				addToLibraryRoot: !shouldCreateCollection,
				linkFiles: fileHandling === 'link',
				mendeleyCode,
				folder,
				recreateStructure: shouldRecreateStructure,
				mimeTypes: shouldImportPDF ? ['application/pdf'] : [],
				fileTypes: shouldImportOther ? fileTypes : null
			});
			
			// Cancelled by user or due to error
			if (!result) {
				window.close();
				return;
			}
			
			let numItems = translationResult.current.newItems.length;
			skipToDonePage(
				Zotero.getString('fileInterface.importComplete'),
				Zotero.getString(`fileInterface.itemsWereImported`, numItems, numItems)
			);
		}
		catch (e) {
			if (e.message == 'Encrypted Mendeley database') {
				let url = 'https://www.zotero.org/support/kb/mendeley_import';
				skipToDonePage(
					Zotero.getString('general.error'),
					// TODO: Localize
					(
						<span>
							The selected Mendeley database cannot be read, likely because it is encrypted.
							See <a href={ url } onClick={ handleUrlClick } className="text-link">How do I import a Mendeley library
							into Zotero?</a> for more information.
						</span>
					)
				);
			}
			else {
				skipToDonePage(
					Zotero.getString('general.error'),
					Zotero_File_Interface.makeImportErrorString(translationResult.current),
					true
				);
			}
			throw e;
		}
	}, [file, fileTypes, folder, fileHandling, handleBeforeImport, handleUrlClick, mendeleyCode, shouldCreateCollection, shouldImportOther, shouldImportPDF, shouldRecreateStructure, skipToDonePage]);

	const goToStart = useCallback(() => {
		wizardRef.current.goTo('page-start');
		setCanAdvance(true);
	}, []);

	useEffect(() => {
		(async () => {
			updateCreateCollectionsCheckbox();
		})();
	}, [updateCreateCollectionsCheckbox]);

	useEffect(() => {
		if (mendeleyCode) {
			wizardRef.current.goTo('page-options');
		}
	}, [mendeleyCode]);

	return (
		<Wizard
			canAdvance={ canAdvance }
			canCancel={ canCancel }
			canRewind={ canRewind }
			className="import-wizard"
			onClose={ handleClose }
			onFinish={ handleFinish }
			ref={ wizardRef }
		>
			<WizardPage
				label={ Zotero.getString('import.whereToImportFrom') }
				onPageAdvance={ handleModeChosen }
				pageId="page-start"
			>
				<RadioSet
					autoFocus
					onChange={ handleSourceChange }
					options={ importSourceOptions }
					value={ selectedMode }
				/>
			</WizardPage>
			<WizardPage
				pageId="mendeley-online-intro"
				onPageRewound={ goToStart }
				onPageAdvance={ beginOnlineImport }
				label={ Zotero.getString('import.online.intro.title') }
			>
				<div className="mendeley-online-intro">
					{ Zotero.getString('import.online.intro', [Zotero.appName, 'Mendeley Reference Manager', 'Mendeley']) }
				</div>
				<div className="mendeley-online-intro">
					{ Zotero.getString('import.online.intro2', [Zotero.appName, 'Mendeley']) }
				</div>
			</WizardPage>
			<WizardPage
				onPageAdvance={ startImport }
				onPageRewound={ goToStart }
				pageId="page-options"
				label={ Zotero.getString('general.options') }
			>
				<div className="page-options-create-collection">
					<input
						checked={ shouldCreateCollection }
						id={ id.current + '-create-collection-checkbox' }
						onChange={ handleCreateCollectionCheckboxChange }
						type="checkbox"
					/>
					<label htmlFor={ id.current + '-create-collection-checkbox' }>
						{ Zotero.getString('import.createCollection') }
					</label>
				</div>
				{ folder && (
					<React.Fragment>
						<div className="page-options-recreate-structure">
							<input
								checked={ shouldRecreateStructure }
								id={ id.current + '-recreate-structure-checkbox' }
								onChange={ handleRecreateStructureChange }
								type="checkbox"
							/>
							<label htmlFor={ id.current + '-recreate-structure-checkbox' }>
								{ Zotero.getString('import.recreateStructure') }
							</label>
						</div>
						<div className="page-options-file-types">
							<h2>
								{ Zotero.getString("import.fileTypes.header") }
							</h2>
							<fieldset>
								<div className="page-options-file-type">
									<input
										checked={ shouldImportPDF }
										id={ id.current + '-import-pdf-checkbox' }
										onChange={ handleImportPDFChange }
										type="checkbox"
									/>
									<label htmlFor={ id.current + '-import-pdf-checkbox' }>
										{ Zotero.getString('import.fileTypes.pdf') }
									</label>
								</div>
								<div className="page-options-file-type">
									<input
										checked={ shouldImportOther }
										id={ id.current + '-import-other' }
										onChange={ handleImportOtherChange }
										type="checkbox"
									/>
									<input
										id={ id.current + '-import-other-files' }
										onChange={ handleOtherFileTypesChange }
										placeholder={ Zotero.getString('import.fileTypes.otherPlaceholder') }
										type="text"
										value={ fileTypes }
									/>
								</div>
							</fieldset>
						</div>
					</React.Fragment>
				)}
				{ !mendeleyCode && (
					<div className="page-options-file-handling">
						<h2>
							{ Zotero.getString("import.fileHandling") }
						</h2>
						<RadioSet
							autoFocus
							id={ id.current + 'file-handling-radio' }
							onChange={ handleFileHandlingChange }
							options={ fileHandlingOptions }
							value={ fileHandling }
						/>
						<div className="page-options-file-handling-description">
							{ Zotero.getString('import.fileHandling.description', Zotero.appName) }
						</div>
					</div>
				)}
			</WizardPage>
			<WizardPage
				onPageShow={ handleProgressPageShow }
				pageId="page-progress"
				label={ Zotero.getString('import.importing') }
			>
				<ProgressBar value={ progress } />
				{ (folder && progressQueue) && (
					<div className="progress-queue table-container">
						<ProgressQueueTable progressQueue={ progressQueue } />
					</div>
				) }
			</WizardPage>
			<WizardPage
				label={ doneLabel }
				pageId="page-done"
			>
				<div className="page-done-description">
					{ doneDescription }
				</div>
				{ (folder && progressQueue && !shouldShowErrorButton) && (
					<div className="progress-queue table-container">
						<ProgressQueueTable progressQueue={ progressQueue } />
					</div>
				) }
				{ shouldShowErrorButton && (
					<div className="page-done-error">
						<button
							onClick={ handleReportErrorClick }
							title={ Zotero.getString('errorReport.reportError') }
						>
							{ Zotero.getString('errorReport.reportError') }
						</button>
					</div>
				) }
			</WizardPage>
		</Wizard>
	);
});

ImportWizard.displayName = 'ImportWizard';

ImportWizard.init = (domEl, props) => {
	ReactDom.render(<ImportWizard { ...props } />, domEl);
};

ImportWizard.propTypes = {
	libraryID: PropTypes.number,
	mendeleyCode: PropTypes.string,
};

Zotero.ImportWizard = ImportWizard;