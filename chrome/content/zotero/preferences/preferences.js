/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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

var openURLResolvers;
var proxies;
var charsets;
var _io = {};


var Zotero_Preferences = {
	onUnload: function () {
		Zotero_Preferences.Debug_Output.onUnload();
	},
	
	openHelpLink: function () {
		var url = "http://www.zotero.org/support/preferences/";
		var helpTopic = document.getElementsByTagName("prefwindow")[0].currentPane.helpTopic;
		url += helpTopic;
		
		// Non-instantApply prefwindows are usually modal, so we can't open in the topmost window,
		// since it's probably behind the window
		var instantApply = Zotero.Prefs.get("browser.preferences.instantApply", true);
		
		if (instantApply) {
			window.opener.ZoteroPane_Local.loadURI(url, { shiftKey: true, metaKey: true });
		}
		else {
			if (Zotero.isStandalone) {
				var io = Components.classes['@mozilla.org/network/io-service;1']
							.getService(Components.interfaces.nsIIOService);
				var uri = io.newURI(url, null, null);
				var handler = Components.classes['@mozilla.org/uriloader/external-protocol-service;1']
							.getService(Components.interfaces.nsIExternalProtocolService)
							.getProtocolHandlerInfo('http');
				handler.preferredAction = Components.interfaces.nsIHandlerInfo.useSystemDefault;
				handler.launchWithURI(uri, null);
			}
			else {
				var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
							.getService(Components.interfaces.nsIWindowWatcher);
				var win = ww.openWindow(
					window,
					url,
					"helpWindow",
					"chrome=no,menubar=yes,location=yes,toolbar=yes,personalbar=yes,resizable=yes,scrollbars=yes,status=yes",
					null
				);
			}
		}
	}
}

function init()
{
	if(Zotero.isConnector) {
		Zotero.activateStandalone();
		window.close();
		return;
	}
	
	observerService.addObserver(function() {
		if(Zotero.isConnector) window.close();
	}, "zotero-reloaded", false);
	
	// Display the appropriate modifier keys for the platform
	var rows = document.getElementById('zotero-prefpane-keys').getElementsByTagName('row');
	for (var i=0; i<rows.length; i++) {
		rows[i].firstChild.nextSibling.value = Zotero.isMac ? 'Cmd+Shift+' : 'Ctrl+Alt+';
	}
	
	updateStorageSettings(null, null, true);
	updateWordProcessorInstructions();
	refreshStylesList();
	refreshProxyList();
	populateQuickCopyList();
	updateQuickCopyInstructions();
	initSearchPane();
	Zotero_Preferences.Debug_Output.init();
	
	var charsetMenu = document.getElementById("zotero-import-charsetMenu");
	var charsetMap = Zotero_Charset_Menu.populate(charsetMenu, false);
	charsetMenu.selectedItem =
		charsetMap[Zotero.Prefs.get("import.charset")] ?
			charsetMap[Zotero.Prefs.get("import.charset")] : charsetMap["auto"];
	
	if(window.arguments) {
		_io = window.arguments[0];
		
		if(_io.pane) {
			var pane = document.getElementById(_io.pane);
			document.getElementById('zotero-prefs').showPane(pane);
			// Quick hack to support install prompt from PDF recognize option
			if (_io.action && _io.action == 'pdftools-install') {
				checkPDFToolsDownloadVersion();
			}
		}
	} else if(document.location.hash == "#cite") {
		document.getElementById('zotero-prefs').showPane(document.getElementById("zotero-prefpane-cite"));
	}
	
	var showInAppTab;
	if(!Zotero.isFx4 && (showInAppTab = document.getElementById("zotero-prefpane-general-showIn-appTab"))) {
		showInAppTab.setAttribute("hidden", "true");
	}
}


function onDataDirLoad() {
	var path = document.getElementById('dataDirPath');
	var useDataDir = Zotero.Prefs.get('useDataDir');
	path.setAttribute('disabled', !useDataDir);
}


function onDataDirUpdate(event) {
	var radiogroup = document.getElementById('dataDir');
	var path = document.getElementById('dataDirPath');
	var useDataDir = Zotero.Prefs.get('useDataDir');
	
	// If triggered from the Choose button, don't show the dialog, since
	// Zotero.chooseZoteroDirectory() shows its own
	if (event.originalTarget && event.originalTarget.tagName == 'button') {
		return true;
	}
	// Fx3.6
	else if (event.explicitOriginalTarget && event.explicitOriginalTarget.tagName == 'button') {
		return true;
	}
	
	// If directory not set or invalid, prompt for location
	if (!getDataDirPath()) {
		event.stopPropagation();
		var file = Zotero.chooseZoteroDirectory(true);
		radiogroup.selectedIndex = file ? 1 : 0;
		return !!file;
	}
	
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService);
	var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
	var app = Zotero.isStandalone ? Zotero.getString('app.standalone') : Zotero.getString('app.firefox');
	var index = ps.confirmEx(window,
		Zotero.getString('general.restartRequired'),
		Zotero.getString('general.restartRequiredForChange', app),
		buttonFlags,
		Zotero.getString('general.restartNow'),
		null, null, null, {});
	
	if (index == 0) {
		useDataDir = !!radiogroup.selectedIndex;
		// quit() is asynchronous, but set this here just in case
		Zotero.Prefs.set('useDataDir', useDataDir);
		var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
				.getService(Components.interfaces.nsIAppStartup);
		appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit
			| Components.interfaces.nsIAppStartup.eRestart);
	}
	
	radiogroup.selectedIndex = useDataDir ? 1 : 0;
	return useDataDir;
}


function getDataDirPath() {
	var desc = Zotero.Prefs.get('dataDir');
	if (desc == '') {
		return '';
	}
	
	var file = Components.classes["@mozilla.org/file/local;1"].
		createInstance(Components.interfaces.nsILocalFile);
	try {
		file.persistentDescriptor = desc;
	}
	catch (e) {
		return '';
	}
	return file.path;
}


function populateOpenURLResolvers() {
	var openURLMenu = document.getElementById('openURLMenu');
	
	openURLResolvers = Zotero.OpenURL.discoverResolvers();
	var i = 0;
	for each(var r in openURLResolvers) {
		openURLMenu.insertItemAt(i, r.name);
		if (r.url == Zotero.Prefs.get('openURL.resolver') && r.version == Zotero.Prefs.get('openURL.version')) {
			openURLMenu.selectedIndex = i;
		}
		i++;
	}
	
	var button = document.getElementById('openURLSearchButton');
	switch (openURLResolvers.length) {
		case 0:
			var num = 'zero';
			break;
		case 1:
			var num = 'singular';
			break;
		default:
			var num = 'plural';
	}
	
	button.setAttribute('label', Zotero.getString('zotero.preferences.openurl.resolversFound.' + num, openURLResolvers.length));
}


//
// Sync
//
function updateStorageSettings(enabled, protocol, skipWarnings) {
	if (enabled === null) {
		enabled = document.getElementById('pref-storage-enabled').value;
	}
	
	var oldProtocol = document.getElementById('pref-storage-protocol').value;
	if (protocol === null) {
		protocol = oldProtocol;
	}
	
	var protocolMenu = document.getElementById('storage-protocol');
	var settings = document.getElementById('storage-webdav-settings');
	var sep = document.getElementById('storage-separator');
	
	if (!enabled || protocol == 'zotero') {
		settings.hidden = true;
		sep.hidden = false;
	}
	else {
		settings.hidden = false;
		sep.hidden = true;
	}
	
	protocolMenu.disabled = !enabled;
	
	if (!skipWarnings) {
		// WARN if going between
	}
	
	if (oldProtocol == 'zotero' && protocol == 'webdav') {
		var sql = "SELECT COUNT(*) FROM version WHERE schema='storage_zfs'";
		if (Zotero.DB.valueQuery(sql)) {
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
			var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
								+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING)
								+ ps.BUTTON_DELAY_ENABLE;
			var account = Zotero.Sync.Server.username;
			var index = ps.confirmEx(
				null,
				// TODO: localize
				"Purge Attachment Files on Zotero Servers?",
				
				"If you plan to use WebDAV for file syncing and you previously synced attachment files in My Library "
					+ "to the Zotero servers, you can purge those files from the Zotero servers to give you more "
					+ "storage space for groups.\n\n"
					+ "You can purge files at any time from your account settings on zotero.org.",
				buttonFlags,
				"Purge Files Now",
				"Do Not Purge", null, null, {}
			);
			
			if (index == 0) {
				var sql = "INSERT OR IGNORE INTO settings VALUES (?,?,?)";
				Zotero.DB.query(sql, ['storage', 'zfsPurge', 'user']);
				
				Zotero.Sync.Storage.purgeDeletedStorageFiles('zfs', function (success) {
					if (success) {
						ps.alert(
							null,
							Zotero.getString("general.success"),
							"Attachment files from your personal library have been removed from the Zotero servers."
						);
					}
					else {
						ps.alert(
							null,
							Zotero.getString("general.error"),
							"An error occurred. Please try again later."
						);
					}
				});
			}
		}
	}
	
	setTimeout(function () {
		updateStorageTerms();
	}, 1)
}


function updateStorageTerms() {
	var terms = document.getElementById('storage-terms');
	
	var libraryEnabled = document.getElementById('pref-storage-enabled').value;
	var storageProtocol = document.getElementById('pref-storage-protocol').value;
	var groupsEnabled = document.getElementById('pref-group-storage-enabled').value;
	
	terms.hidden = !((libraryEnabled && storageProtocol == 'zotero') || groupsEnabled);
}



function unverifyStorageServer() {
	Zotero.Prefs.set('sync.storage.verified', false);
	Zotero.Sync.Storage.resetAllSyncStates(null, true, false);
}

function verifyStorageServer() {
	Zotero.debug("Verifying storage");
	
	var verifyButton = document.getElementById("storage-verify");
	var abortButton = document.getElementById("storage-abort");
	var progressMeter = document.getElementById("storage-progress");
	var urlField = document.getElementById("storage-url");
	var usernameField = document.getElementById("storage-username");
	var passwordField = document.getElementById("storage-password");
	
	var callback = function (uri, status, error) {
		verifyButton.hidden = false;
		abortButton.hidden = true;
		progressMeter.hidden = true;
		
		switch (status) {
			case Zotero.Sync.Storage.ERROR_NO_URL:
				setTimeout(function () {
					urlField.focus();
				}, 1);
				break;
			
			case Zotero.Sync.Storage.ERROR_NO_USERNAME:
				setTimeout(function () {
					usernameField.focus();
				}, 1);
				break;
			
			case Zotero.Sync.Storage.ERROR_NO_PASSWORD:
				setTimeout(function () {
					passwordField.focus();
				}, 1);
				break;
		}
		
		Zotero.Sync.Storage.checkServerCallback(uri, status, window, false, error);
	}
	
	verifyButton.hidden = true;
	abortButton.hidden = false;
	progressMeter.hidden = false;
	var requestHolder = Zotero.Sync.Storage.checkServer('webdav', callback);
	abortButton.onclick = function () {
		if (requestHolder.request) {
			requestHolder.request.onreadystatechange = undefined;
			requestHolder.request.abort();
			verifyButton.hidden = false;
			abortButton.hidden = true;
			progressMeter.hidden = true;
		}
	}
}

function handleSyncResetSelect(obj) {
	var index = obj.selectedIndex;
	var rows = obj.getElementsByTagName('row');
	
	for (var i=0; i<rows.length; i++) {
		if (i == index) {
			rows[i].setAttribute('selected', 'true');
		}
		else {
			rows[i].removeAttribute('selected');
		}
	}
}

function handleSyncReset(action) {
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
							.getService(Components.interfaces.nsIPromptService);
	
	if (!Zotero.Sync.Server.enabled) {
		ps.alert(
			null,
			Zotero.getString('general.error'),
			// TODO: localize
			"You must enter a username and password in the "
				+ document.getElementById('zotero-prefpane-sync')
					.getElementsByTagName('tab')[0].label
				+ " tab before using the reset options."
		);
		return;
	}
	
	var account = Zotero.Sync.Server.username;
	
	switch (action) {
		case 'restore-from-server':
			var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
								+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
								+ ps.BUTTON_POS_1_DEFAULT;
			var index = ps.confirmEx(
				null,
				// TODO: localize
				Zotero.getString('general.warning'),
				"All data in this copy of Zotero will be erased and replaced with "
					+ "data belonging to user '" + account + "' on the Zotero server.",
				buttonFlags,
				"Replace Local Data",
				null, null, null, {}
			);
			
			switch (index) {
				case 0:
					// TODO: better error handling
					
					// Verify username and password
					var callback = function () {
						Zotero.Schema.stopRepositoryTimer();
						Zotero.Sync.Runner.clearSyncTimeout();
						
						Zotero.DB.skipBackup = true;
						
						var file = Zotero.getZoteroDirectory();
						file.append('restore-from-server');
						Zotero.File.putContents(file, '');
						
						var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING);
						var index = ps.confirmEx(
							null,
							Zotero.getString('general.restartRequired'),
							// TODO: localize
							"Firefox must be restarted to complete the restore process.",
							buttonFlags,
							Zotero.getString('general.restartNow'),
							null, null, null, {}
						);
						
						var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
								.getService(Components.interfaces.nsIAppStartup);
						appStartup.quit(Components.interfaces.nsIAppStartup.eRestart | Components.interfaces.nsIAppStartup.eAttemptQuit);
					};
					
					// TODO: better way of checking for an active session?
					if (Zotero.Sync.Server.sessionIDComponent == 'sessionid=') {
						Zotero.Sync.Server.login(callback);
					}
					else {
						callback();
					}
					break;
				
				// Cancel
				case 1:
					return;
			}
			break;
		
		case 'restore-to-server':
			var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
							+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
							+ ps.BUTTON_POS_1_DEFAULT;
			var index = ps.confirmEx(
				null,
				// TODO: localize
				Zotero.getString('general.warning'),
				"All data belonging to user '" + account + "' on the Zotero server "
					+ "will be erased and replaced with data from this copy of Zotero.\n\n"
					+ "Depending on the size of your library, there may be a delay before "
					+ "your data is available on the server.",
				buttonFlags,
				"Replace Server Data",
				null, null, null, {}
			);
			
			switch (index) {
				case 0:
					// TODO: better error handling
					Zotero.Sync.Server.clear(function () {
						Zotero.Sync.Server.sync(/*{
							
							// TODO: this doesn't work if the pref window is 
							closed. fix, perhaps by making original callbacks
							available to the custom callbacks
							
							onSuccess: function () {
								Zotero.Sync.Runner.setSyncIcon();
								ps.alert(
									null,
									"Restore Completed",
									"Data on the Zotero server has been successfully restored."
								);
							},
							onError: function (msg) {
								// TODO: combine with error dialog for regular syncs
								ps.alert(
									null,
									"Restore Failed",
									"An error occurred uploading your data to the server.\n\n"
										+ "Click the sync error icon in the Zotero toolbar "
										+ "for further information."
								);
								Zotero.Sync.Runner.error(msg);
							}
						}*/);
					});
					break;
				
				// Cancel
				case 1:
					return;
			}
			
			break;
		
		
		case 'reset-storage-history':
			var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
							+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
							+ ps.BUTTON_POS_1_DEFAULT;
			var index = ps.confirmEx(
				null,
				// TODO: localize
				Zotero.getString('general.warning'),
				"All file sync history will be cleared.\n\n"
					+ "Any local attachment files that do not exist on the storage server will be uploaded on the next sync.",
				buttonFlags,
				"Reset",
				null, null, null, {}
			);
			
			switch (index) {
				case 0:
					Zotero.Sync.Storage.resetAllSyncStates();
					ps.alert(
						null,
						"File Sync History Cleared",
						"The file sync history has been cleared."
					);
					break;
				
				// Cancel
				case 1:
					return;
			}
			
			break;
		
		default:
			throw ("Invalid action '" + action + "' in handleSyncReset()");
	}
}


/*
 * Builds the main Quick Copy drop-down from the current global pref
 */
function populateQuickCopyList() {
	// Initialize default format drop-down
	var format = Zotero.Prefs.get("export.quickCopy.setting");
	var menulist = document.getElementById("zotero-quickCopy-menu");
	buildQuickCopyFormatDropDown(menulist, Zotero.QuickCopy.getContentType(format), format);
	menulist.setAttribute('preference', "pref-quickCopy-setting");
	updateQuickCopyHTMLCheckbox();
	
	if (!Zotero.isStandalone) {
		refreshQuickCopySiteList();
	}
}


/*
 * Builds a Quick Copy drop-down 
 */
function buildQuickCopyFormatDropDown(menulist, contentType, currentFormat) {
	if (!currentFormat) {
		currentFormat = menulist.value;
	}
	// Strip contentType from mode
	currentFormat = Zotero.QuickCopy.stripContentType(currentFormat);
	
	menulist.selectedItem = null;
	menulist.removeAllItems();
	
	// Prevent Cmd-w from setting "Wikipedia"
	menulist.onkeydown = function (event) {
		if ((Zotero.isMac && event.metaKey) || event.ctrlKey) {
			event.preventDefault();
		}
	}
	
	var popup = document.createElement('menupopup');
	menulist.appendChild(popup);
	
	var itemNode = document.createElement("menuitem");
	itemNode.setAttribute("label", Zotero.getString('zotero.preferences.export.quickCopy.bibStyles'));
	itemNode.setAttribute("disabled", true);
	popup.appendChild(itemNode);
	
	// add styles to list
	var styles = Zotero.Styles.getVisible();
	for each(var style in styles) {
		var baseVal = 'bibliography=' + style.styleID;
		var val = 'bibliography' + (contentType == 'html' ? '/html' : '') + '=' + style.styleID;
		var itemNode = document.createElement("menuitem");
		itemNode.setAttribute("value", val);
		itemNode.setAttribute("label", style.title);
		itemNode.setAttribute("oncommand", 'updateQuickCopyHTMLCheckbox()');
		popup.appendChild(itemNode);
		
		if (baseVal == currentFormat) {
			menulist.selectedItem = itemNode;
		}
	}
	
	var itemNode = document.createElement("menuitem");
	itemNode.setAttribute("label", Zotero.getString('zotero.preferences.export.quickCopy.exportFormats'));
	itemNode.setAttribute("disabled", true);
	popup.appendChild(itemNode);
	
	// add export formats to list
	var translation = new Zotero.Translate("export");
	var translators = translation.getTranslators();
	
	for (var i=0; i<translators.length; i++) {
		// Skip RDF formats
		switch (translators[i].translatorID) {
			case '6e372642-ed9d-4934-b5d1-c11ac758ebb7':
			case '14763d24-8ba0-45df-8f52-b8d1108e7ac9':
				continue;
		}
		var val  = 'export=' + translators[i].translatorID;
		var itemNode = document.createElement("menuitem");
		itemNode.setAttribute("value", val);
		itemNode.setAttribute("label", translators[i].label);
		itemNode.setAttribute("oncommand", 'updateQuickCopyHTMLCheckbox()');
		popup.appendChild(itemNode);
		
		if (val == currentFormat) {
			menulist.selectedItem = itemNode;
		}
	}
	
	menulist.click();
	
	return popup;
}

function updateQuickCopyHTMLCheckbox() {
	var format = document.getElementById('zotero-quickCopy-menu').value;
	var mode, contentType;
	
	var linkCheckbox = document.getElementById('zotero-quickCopy-linkWrapOption');

	var checkbox = document.getElementById('zotero-quickCopy-copyAsHTML');
	[mode, format] = format.split('=');
	[mode, contentType] = mode.split('/');
	
	checkbox.checked = contentType === 'html';
	checkbox.disabled = mode !== 'bibliography';
	linkCheckbox.disabled = mode !== 'bibliography';
}

function showQuickCopySiteEditor(index) {
	var treechildren = document.getElementById('quickCopy-siteSettings-rows');
	
	if (index != undefined && index > -1 && index < treechildren.childNodes.length) {
		var treerow = treechildren.childNodes[index].firstChild;
		var domain = treerow.childNodes[0].getAttribute('label');
		var format = treerow.childNodes[1].getAttribute('label');
		var asHTML = treerow.childNodes[2].getAttribute('label') != '';
	}
	
	var format = Zotero.QuickCopy.getSettingFromFormattedName(format);
	if (asHTML) {
		format = format.replace('bibliography=', 'bibliography/html=');
	}
	
	var io = {domain: domain, format: format, ok: false};
	window.openDialog('chrome://zotero/content/preferences/quickCopySiteEditor.xul', "zotero-preferences-quickCopySiteEditor", "chrome, modal", io);
	
	if (!io.ok) {
		return;
	}
	
	if (domain && domain != io.domain) {
		Zotero.DB.query("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [domain]);
	}
	
	Zotero.DB.query("REPLACE INTO settings VALUES ('quickCopySite', ?, ?)", [io.domain, io.format]);
	
	refreshQuickCopySiteList();
}

function refreshQuickCopySiteList() {
	var treechildren = document.getElementById('quickCopy-siteSettings-rows');
	while (treechildren.hasChildNodes()) {
		treechildren.removeChild(treechildren.firstChild);
	}
	
	var sql = "SELECT key AS domainPath, value AS format FROM settings "
		+ "WHERE setting='quickCopySite' ORDER BY domainPath COLLATE NOCASE";
	var siteData = Zotero.DB.query(sql);
	
	if (!siteData) {
		return;
	}
	
	for (var i=0; i<siteData.length; i++) {
		var treeitem = document.createElement('treeitem');
		var treerow = document.createElement('treerow');
		var domainCell = document.createElement('treecell');
		var formatCell = document.createElement('treecell');
		var HTMLCell = document.createElement('treecell');
		
		domainCell.setAttribute('label', siteData[i].domainPath);
		
		var formatted = Zotero.QuickCopy.getFormattedNameFromSetting(siteData[i].format);
		formatCell.setAttribute('label', formatted);
		var copyAsHTML = Zotero.QuickCopy.getContentType(siteData[i].format) == 'html';
		HTMLCell.setAttribute('label', copyAsHTML ? '   ✓   ' : '');
		
		treerow.appendChild(domainCell);
		treerow.appendChild(formatCell);
		treerow.appendChild(HTMLCell);
		treeitem.appendChild(treerow);
		treechildren.appendChild(treeitem);
	}
}


function deleteSelectedQuickCopySite() {
	var tree = document.getElementById('quickCopy-siteSettings');
	var treeitem = tree.lastChild.childNodes[tree.currentIndex];
	var domainPath = treeitem.firstChild.firstChild.getAttribute('label');
	Zotero.DB.query("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [domainPath]);
	refreshQuickCopySiteList();
}


function updateQuickCopyInstructions() {
	var prefix = Zotero.isMac ? 'Cmd+Shift+' : 'Ctrl+Alt+';
	
	var key = Zotero.Prefs.get('keys.copySelectedItemsToClipboard');
	var str = Zotero.getString('zotero.preferences.export.quickCopy.instructions', prefix + key);
	var instr = document.getElementById('quickCopy-instructions');
	while (instr.hasChildNodes()) {
		instr.removeChild(instr.firstChild);
	}
	instr.appendChild(document.createTextNode(str));
	
	var key = Zotero.Prefs.get('keys.copySelectedItemCitationsToClipboard');
	var str = Zotero.getString('zotero.preferences.export.quickCopy.citationInstructions', prefix + key);
	var instr = document.getElementById('quickCopy-citationInstructions');
	while (instr.hasChildNodes()) {
		instr.removeChild(instr.firstChild);
	}
	instr.appendChild(document.createTextNode(str));
}


function rebuildIndexPrompt() {
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
			createInstance(Components.interfaces.nsIPromptService);
	var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_CANCEL);
	
	var index = ps.confirmEx(null,
		Zotero.getString('zotero.preferences.search.rebuildIndex'),
		Zotero.getString('zotero.preferences.search.rebuildWarning',
			Zotero.getString('zotero.preferences.search.indexUnindexed')),
		buttonFlags,
		Zotero.getString('zotero.preferences.search.rebuildIndex'),
		Zotero.getString('zotero.preferences.search.indexUnindexed'),
		null, null, {});
	
	if (index == 0) {
		Zotero.Fulltext.rebuildIndex();
	}
	else if (index == 1) {
		Zotero.Fulltext.rebuildIndex(true)
	}
	
	updateIndexStats();
}


function clearIndexPrompt() {
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
			createInstance(Components.interfaces.nsIPromptService);
	var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_CANCEL);
	
	var index = ps.confirmEx(null,
		Zotero.getString('zotero.preferences.search.clearIndex'),
		Zotero.getString('zotero.preferences.search.clearWarning',
			Zotero.getString('zotero.preferences.search.clearNonLinkedURLs')),
		buttonFlags,
		Zotero.getString('zotero.preferences.search.clearIndex'),
		Zotero.getString('zotero.preferences.search.clearNonLinkedURLs'),
		null, null, {});
	
	if (index == 0) {
		Zotero.Fulltext.clearIndex();
	}
	else if (index == 1) {
		Zotero.Fulltext.clearIndex(true);
	}
	
	updateIndexStats();
}


function initSearchPane() {
	document.getElementById('fulltext-rebuildIndex').setAttribute('label',
		Zotero.getString('zotero.preferences.search.rebuildIndex'));
	document.getElementById('fulltext-clearIndex').setAttribute('label',
		Zotero.getString('zotero.preferences.search.clearIndex'));
	updatePDFToolsStatus();
}


/*
 * Update window according to installation status for PDF tools
 *  (e.g. status line, install/update button, etc.)
 */
function updatePDFToolsStatus() {
	var converterIsRegistered = Zotero.Fulltext.pdfConverterIsRegistered();
	var infoIsRegistered = Zotero.Fulltext.pdfInfoIsRegistered();
	
	var converterStatusLabel = document.getElementById('pdfconverter-status');
	var infoStatusLabel = document.getElementById('pdfinfo-status');
	var requiredLabel = document.getElementById('pdftools-required');
	var updateButton = document.getElementById('pdftools-update-button');
	var documentationLink = document.getElementById('pdftools-documentation-link');
	var settingsBox = document.getElementById('pdftools-settings');
	
	// If we haven't already generated the required and documentation messages
	if (!converterIsRegistered && !requiredLabel.hasChildNodes()) {
		
		// Xpdf link
		var str = Zotero.getString('zotero.preferences.search.pdf.toolsRequired',
			[Zotero.Fulltext.pdfConverterName, Zotero.Fulltext.pdfInfoName,
			'<a href="' + Zotero.Fulltext.pdfToolsURL + '">'
			+ Zotero.Fulltext.pdfToolsName + '</a>']);
		var parts = Zotero.Utilities.parseMarkup(str);
		for (var i=0; i<parts.length; i++) {
			var part = parts[i];
			if (part.type == 'text') {
				var elem = document.createTextNode(part.text);
			}
			else if (part.type == 'link') {
				var elem = document.createElement('label');
				elem.setAttribute('value', part.text);
				elem.setAttribute('class', 'zotero-text-link');
				for (var key in part.attributes) {
					elem.setAttribute(key, part.attributes[key]);
					
					if (key == 'href') {
						elem.setAttribute('tooltiptext', part.attributes[key]);
					}
				}
			}
			requiredLabel.appendChild(elem);
		}
		
		requiredLabel.appendChild(document.createTextNode(' '
			+ Zotero.getString('zotero.preferences.search.pdf.automaticInstall')));
		
		// Documentation link
		var link = '<a href="http://www.zotero.org/documentation/pdf_fulltext_indexing">'
			+ Zotero.getString('zotero.preferences.search.pdf.documentationLink')
			+ '</a>';
		var str = Zotero.getString('zotero.preferences.search.pdf.advancedUsers', link);
		var parts = Zotero.Utilities.parseMarkup(str);
		
		for (var i=0; i<parts.length; i++) {
			var part = parts[i];
			if (part.type == 'text') {
				var elem = document.createTextNode(part.text);
			}
			else if (part.type == 'link') {
				var elem = document.createElement('label');
				elem.setAttribute('value', part.text);
				elem.setAttribute('class', 'zotero-text-link');
				for (var key in part.attributes) {
					elem.setAttribute(key, part.attributes[key]);
					
					if (key == 'href') {
						elem.setAttribute('tooltiptext', part.attributes[key]);
					}
				}
			}
			documentationLink.appendChild(elem);
		}
	}
	
	// converter status line
	var prefix = 'zotero.preferences.search.pdf.tool';
	if (converterIsRegistered) {
		var version = Zotero.Fulltext.pdfConverterVersion;
		str = Zotero.getString(prefix + 'Registered',
			Zotero.getString('zotero.preferences.search.pdf.toolVersionPlatform',
				[Zotero.Fulltext.pdfConverterName, version]));
	}
	else {
		str = Zotero.getString(prefix + 'NotRegistered',
			[Zotero.Fulltext.pdfConverterFileName]);
	}
	converterStatusLabel.setAttribute('value', str);
	
	// pdfinfo status line
	if (infoIsRegistered) {
		var version = Zotero.Fulltext.pdfInfoVersion;
		str = Zotero.getString(prefix + 'Registered',
			Zotero.getString('zotero.preferences.search.pdf.toolVersionPlatform',
				[Zotero.Fulltext.pdfInfoName, version]));
	}
	else {
		str = Zotero.getString(prefix + 'NotRegistered',
			[Zotero.Fulltext.pdfInfoFileName]);
	}
	infoStatusLabel.setAttribute('value', str);
	
	str = converterIsRegistered ?
		Zotero.getString('general.checkForUpdate') :
		Zotero.getString('zotero.preferences.search.pdf.checkForInstaller');
	updateButton.setAttribute('label', str);
	
	requiredLabel.setAttribute('hidden', converterIsRegistered);
	documentationLink.setAttribute('hidden', converterIsRegistered);
	settingsBox.setAttribute('hidden', !converterIsRegistered);
}


/*
 * Check available versions of PDF tools from server and prompt for installation
 * if a newer version is available
 */
function checkPDFToolsDownloadVersion() {
	var url = Zotero.Fulltext.pdfToolsDownloadBaseURL
				+ Zotero.platform.replace(' ', '-') + '.latest';
	
	// Find latest version for this platform
	var sent = Zotero.HTTP.doGet(url, function (xmlhttp) {
		try {
			if (xmlhttp.status == 200) {
				var converterIsRegistered = Zotero.Fulltext.pdfConverterIsRegistered();
				var infoIsRegistered = Zotero.Fulltext.pdfInfoIsRegistered();
				var bothRegistered = converterIsRegistered && infoIsRegistered;
				
				var converterVersion = xmlhttp.responseText.split(/\s/)[0];
				var infoVersion = xmlhttp.responseText.split(/\s/)[1];
				
				var converterVersionAvailable = converterVersion &&
					(!converterIsRegistered ||
						Zotero.Fulltext.pdfConverterVersion == 'UNKNOWN' ||
						converterVersion > Zotero.Fulltext.pdfConverterVersion);
				var infoVersionAvailable = infoVersion &&
					(!infoIsRegistered ||
						Zotero.Fulltext.pdfInfoVersion == 'UNKNOWN' ||
						infoVersion > Zotero.Fulltext.pdfInfoVersion);
				var bothAvailable = converterVersionAvailable && infoVersionAvailable;
				
				/*
				Zotero.debug(converterIsRegistered);
				Zotero.debug(infoIsRegistered);
				Zotero.debug(converterVersion);
				Zotero.debug(infoVersion);
				Zotero.debug(Zotero.Fulltext.pdfConverterVersion);
				Zotero.debug(Zotero.Fulltext.pdfInfoVersion);
				Zotero.debug(converterVersionAvailable);
				Zotero.debug(infoVersionAvailable);
				*/
				
				// Up to date -- disable update button
				if (!converterVersionAvailable && !infoVersionAvailable) {
					var button = document.getElementById('pdftools-update-button');
					button.setAttribute('label', Zotero.getString('zotero.preferences.update.upToDate'));
					button.setAttribute('disabled', true);
				}
				// New version available -- display update prompt
				else {
					var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
							createInstance(Components.interfaces.nsIPromptService);
					var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
						+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
					
					var msg = Zotero.getString('zotero.preferences.search.pdf.available'
						+ ((converterIsRegistered || infoIsRegistered) ? 'Updates' : 'Downloads'),
						[Zotero.platform, 'zotero.org']) + '\n\n';
					
					if (converterVersionAvailable) {
						tvp = Zotero.getString('zotero.preferences.search.pdf.toolVersionPlatform',
							[Zotero.Fulltext.pdfConverterName, converterVersion]);
						msg += '- ' + tvp + '\n';
					}
					if (infoVersionAvailable) {
						tvp = Zotero.getString('zotero.preferences.search.pdf.toolVersionPlatform',
							[Zotero.Fulltext.pdfInfoName, infoVersion]);
						msg += '- ' + tvp + '\n';
					}
					msg += '\n';
					msg += Zotero.getString('zotero.preferences.search.pdf.zoteroCanInstallVersion'
							+ (bothAvailable ? 's' : ''));
					
					var index = ps.confirmEx(null,
						converterIsRegistered ?
							Zotero.getString('general.updateAvailable') : '',
						msg,
						buttonFlags,
						converterIsRegistered ?
							Zotero.getString('general.upgrade') :
							Zotero.getString('general.install'),
						null, null, null, {});
					
					if (index == 0) {
						var installVersions = {
							converter: converterVersionAvailable ?
								converterVersion : null,
							info: infoVersionAvailable ?
								infoVersion : null
						};
						installPDFTools(installVersions);
					}
				}
			}
			// Version not found for platform
			else if (xmlhttp.status == 404) {
				onPDFToolsDownloadError(404);
			}
		}
		catch (e) {
			onPDFToolsDownloadError(e);
		}
	});
	
	// Browser is offline
	if (!sent) {
		onPDFToolsDownloadError();
	}
}


/*
 * Begin installation of specified PDF tools from server -- does a HEAD call to
 * make sure file exists and then calls downloadPDFTool() if so
 */
function installPDFTools(installVersions) {
	if (!installVersions) {
		installVersions = {
			converter: true,
			info: true
		};
	}
	
	// We install the converter first if it's available
	var url = Zotero.Fulltext.pdfToolsDownloadBaseURL;
	if (installVersions.converter) {
		var tool = 'converter';
		var version = installVersions.converter;
		url += Zotero.Fulltext.pdfConverterFileName + '-' + installVersions.converter;
	}
	else if (installVersions.info) {
		var tool = 'info';
		var version = installVersions.info;
		url += Zotero.Fulltext.pdfInfoFileName + '-' + installVersions.info;
	}
	else {
		return; 
	}
	
	// Find latest version for this platform
	var sent = Zotero.HTTP.doHead(url, function (xmlhttp) {
		try {
			if (xmlhttp.status == 200) {
				// If doing both and on converter, chain pdfinfo
				if (installVersions.converter && installVersions.info) {
					downloadPDFTool(tool, version, function () {
						return installPDFTools({ info: installVersions.info });
					});
				}
				else {
					downloadPDFTool(tool, version);
				}
			}
			// Version not found for platform
			else if (xmlhttp.status == 404) {
				onPDFToolsDownloadError(404);
			}
		}
		catch (e) {
			onPDFToolsDownloadError(e);
		}
	});
	
	// Browser is offline
	if (!sent) {
		onPDFToolsDownloadError();
	}
}


/*
 * Download and install specified PDF tool
 */
function downloadPDFTool(tool, version, callback) {
	var ioService = Components.classes["@mozilla.org/network/io-service;1"]
						.getService(Components.interfaces.nsIIOService);
	
	if (tool == 'converter') {
		var fileName = Zotero.Fulltext.pdfConverterFileName; 
	}
	else {
		var fileName = Zotero.Fulltext.pdfInfoFileName;
	}
	
	
	var url = Zotero.Fulltext.pdfToolsDownloadBaseURL + fileName + '-' + version;
	var uri = ioService.newURI(url, null, null);
	
	var file = Zotero.getZoteroDirectory();
	file.append(fileName);
	var fileURL = ioService.newFileURI(file);
	
	const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
	var wbp = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
				.createInstance(nsIWBP);
	
	var progressListener = new Zotero.WebProgressFinishListener(function () {
		// Set permissions to 755
		if (Zotero.isMac) {
			file.permissions = 33261;
		}
		else if (Zotero.isLinux) {
			file.permissions = 493;
		}
		
		// Write the version number to a file
		var versionFile = Zotero.getZoteroDirectory();
		versionFile.append(fileName + '.version');
		Zotero.File.putContents(versionFile, version + '');
		
		Zotero.Fulltext.registerPDFTool(tool);
		
		// Used to install info tool after converter
		if (callback) {
			callback();
		}
		// If done
		else {
			updatePDFToolsStatus();
		}
	});
	
	/*
	var tr = Components.classes["@mozilla.org/transfer;1"].
		createInstance(Components.interfaces.nsITransfer);
	tr.init(uri, fileURL, "", null, null, null, wbp);
	*/
	
	document.getElementById('pdftools-update-button').disabled = true;
	var str = Zotero.getString('zotero.preferences.search.pdf.downloading');
	document.getElementById('pdftools-update-button').setAttribute('label', str);
	
	wbp.progressListener = progressListener;
	Zotero.debug("Saving " + uri.spec + " to " + fileURL.spec);
	wbp.saveURI(uri, null, null, null, null, fileURL);
}


function onPDFToolsDownloadError(e) {
	if (e == 404) {
		var str = Zotero.getString('zotero.preferences.search.pdf.toolDownloadsNotAvailable',
			Zotero.Fulltext.pdfToolsName) + ' '
			+ Zotero.getString('zotero.preferences.search.pdf.viewManualInstructions');
	}
	else if (e) {
		Components.utils.reportError(e);
		var str = Zotero.getString('zotero.preferences.search.pdf.toolsDownloadError', Zotero.Fulltext.pdfToolsName)
			+ ' ' + Zotero.getString('zotero.preferences.search.pdf.tryAgainOrViewManualInstructions');
	}
	else {
		var info = Components.classes["@mozilla.org/xre/app-info;1"]
                     .getService(Components.interfaces.nsIXULAppInfo);
		var browser = info.name; // Returns "Firefox" for Firefox
		var str = Zotero.getString('general.browserIsOffline', browser);
	}
	alert(str);
}


function updateIndexStats() {
	var stats = Zotero.Fulltext.getIndexStats();
	document.getElementById('fulltext-stats-indexed').
		lastChild.setAttribute('value', stats.indexed);
	document.getElementById('fulltext-stats-partial').
		lastChild.setAttribute('value', stats.partial);
	document.getElementById('fulltext-stats-unindexed').
		lastChild.setAttribute('value', stats.unindexed);
	document.getElementById('fulltext-stats-words').
		lastChild.setAttribute('value', stats.words);
}


function revealDataDirectory() {
	var dataDir = Zotero.getZoteroDirectory();
	dataDir.QueryInterface(Components.interfaces.nsILocalFile);
	try {
		dataDir.reveal();
	}
	catch (e) {
		// On platforms that don't support nsILocalFile.reveal() (e.g. Linux),
		// launch the directory
		window.opener.ZoteroPane_Local.launchFile(dataDir);
	}
}


function runIntegrityCheck() {
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService);
	
	var ok = Zotero.DB.integrityCheck();
	if (ok) {
		ok = Zotero.Schema.integrityCheck();
		if (!ok) {
			var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
				+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
			var index = ps.confirmEx(window,
				Zotero.getString('general.failed'),
				Zotero.getString('db.integrityCheck.failed') + "\n\n" +
					Zotero.getString('db.integrityCheck.repairAttempt') + " " +
					Zotero.getString('db.integrityCheck.appRestartNeeded', Zotero.appName),
				buttonFlags,
				Zotero.getString('db.integrityCheck.fixAndRestart', Zotero.appName),
				null, null, null, {}
			);
			
			if (index == 0) {
				// Safety first
				Zotero.DB.backupDatabase();
				
				// Fix the errors
				Zotero.Schema.integrityCheck(true);
				
				// And run the check again
				ok = Zotero.Schema.integrityCheck();
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING);
				if (ok) {
					var str = 'success';
					var msg = Zotero.getString('db.integrityCheck.errorsFixed');
				}
				else {
					var str = 'failed';
					var msg = Zotero.getString('db.integrityCheck.errorsNotFixed')
								+ "\n\n" + Zotero.getString('db.integrityCheck.reportInForums');
				}
				
				ps.confirmEx(window,
					Zotero.getString('general.' + str),
					msg,
					buttonFlags,
					Zotero.getString('general.restartApp', Zotero.appName),
					null, null, null, {}
				);
				
				var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
						.getService(Components.interfaces.nsIAppStartup);
				appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit
					| Components.interfaces.nsIAppStartup.eRestart);
			}
			
			return;
		}
	}
	var str = ok ? 'passed' : 'failed';
	
	ps.alert(window,
		Zotero.getString('general.' + str),
		Zotero.getString('db.integrityCheck.' + str)
		+ (!ok ? "\n\n" + Zotero.getString('db.integrityCheck.dbRepairTool') : ''));
}


function updateTranslators() {
	Zotero.Schema.updateFromRepository(true, function (xmlhttp, updated) {
		var button = document.getElementById('updateButton');
		if (button) {
			if (updated===-1) {
				var label = Zotero.getString('zotero.preferences.update.upToDate');
			}
			else if (updated) {
				var label = Zotero.getString('zotero.preferences.update.updated');
			}
			else {
				var label = Zotero.getString('zotero.preferences.update.error');
			}
			button.setAttribute('label', label);
		}
	});
}


function resetTranslatorsAndStyles() {
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService);
	
	var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
	
	var index = ps.confirmEx(null,
		Zotero.getString('general.warning'),
		Zotero.getString('zotero.preferences.advanced.resetTranslatorsAndStyles.changesLost'),
		buttonFlags,
		Zotero.getString('zotero.preferences.advanced.resetTranslatorsAndStyles'),
		null, null, null, {});
	
	if (index == 0) {
		Zotero.Schema.resetTranslatorsAndStyles(function (xmlhttp, updated) {
			populateQuickCopyList();
		});
	}
}


function resetTranslators() {
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService);
	
	var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
	
	var index = ps.confirmEx(null,
		Zotero.getString('general.warning'),
		Zotero.getString('zotero.preferences.advanced.resetTranslators.changesLost'),
		buttonFlags,
		Zotero.getString('zotero.preferences.advanced.resetTranslators'),
		null, null, null, {});
	
	if (index == 0) {
		Zotero.Schema.resetTranslators();
	}
}


function resetStyles() {
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService);
	
	var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
	
	var index = ps.confirmEx(null,
		Zotero.getString('general.warning'),
		Zotero.getString('zotero.preferences.advanced.resetStyles.changesLost'),
		buttonFlags,
		Zotero.getString('zotero.preferences.advanced.resetStyles'),
		null, null, null, {});
	
	if (index == 0) {
		Zotero.Schema.resetStyles(function (xmlhttp, updated) {
			populateQuickCopyList();
		});
	}
}


Zotero_Preferences.Debug_Output = {
	_timer: null,
	
	init: function () {
		var storing = Zotero.Debug.storing;
		this._updateButton();
		this.updateLines();
		if (storing) {
			this._initTimer();
		}
	},
	
	
	toggleStore: function () {
		this.setStore(!Zotero.Debug.storing);
	},
	
	
	setStore: function (set) {
		Zotero.Debug.setStore(set);
		if (set) {
			this._initTimer();
		}
		else {
			if (this._timerID) {
				this._timer.cancel();
				this._timerID = null;
			}
		}
		this._updateButton();
		this.updateLines();
	},
	
	
	view: function () {
		openInViewer("zotero://debug/");
	},
	
	
	// TODO: localize
	submit: function () {
		document.getElementById('debug-output-submit').disabled = true;
		document.getElementById('debug-output-submit-progress').hidden = false;
		
		var url = "https://repo.zotero.org/repo/report?debug=1";
		var output = Zotero.Debug.get(
			Zotero.Prefs.get('debug.store.submitSize'),
			Zotero.Prefs.get('debug.store.submitLineLength')
		);
		Zotero_Preferences.Debug_Output.setStore(false);
		
		var uploadCallback = function (xmlhttp) {
			document.getElementById('debug-output-submit').disabled = false;
			document.getElementById('debug-output-submit-progress').hidden = true;
			
			Zotero.debug(xmlhttp.responseText);
			
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
			
			if (!xmlhttp.responseXML) {
				ps.alert(
					null,
					Zotero.getString('general.error'),
					'Invalid response from server'
				);
				return;
			}
			var reported = xmlhttp.responseXML.getElementsByTagName('reported');
			if (reported.length != 1) {
				ps.alert(
					null,
					Zotero.getString('general.error'),
					'The server returned an error. Please try again.'
				);
				return;
			}
			
			var reportID = reported[0].getAttribute('reportID');
			ps.alert(
				null,
				"Debug Output Submitted",
				"Debug output has been sent to the Zotero server.\n\n"
					+ "The Debug ID is D" + reportID + "."
			);
		}
		
		var bufferUploader = function (data) {
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
			
			var oldLen = output.length;
			var newLen = data.length;
			var savings = Math.round(((oldLen - newLen) / oldLen) * 100)
			Zotero.debug("HTTP POST " + newLen + " bytes to " + url
				+ " (gzipped from " + oldLen + " bytes; "
				+ savings + "% savings)");
			
			if (Zotero.HTTP.browserIsOffline()) {
				ps.alert(
					null,
					Zotero.getString(
						'general.error',
						Zotero.appName + " is in offline mode."
					)
				);
				return false;
			}
			
			var req =
				Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
					createInstance();
			req.open('POST', url, true);
			req.setRequestHeader('Content-Type', "text/plain");
			req.setRequestHeader('Content-Encoding', 'gzip');
			
			req.channel.notificationCallbacks = {
				onProgress: function (request, context, progress, progressMax) {
					var pm = document.getElementById('debug-output-submit-progress');
					pm.mode = 'determined'
					pm.value = progress;
					pm.max = progressMax;
				},
				
				// nsIInterfaceRequestor
				getInterface: function (iid) {
					try {
						return this.QueryInterface(iid);
					}
					catch (e) {
						throw Components.results.NS_NOINTERFACE;
					}
				},
				
				QueryInterface: function(iid) {
					if (iid.equals(Components.interfaces.nsISupports) ||
							iid.equals(Components.interfaces.nsIInterfaceRequestor) ||
							iid.equals(Components.interfaces.nsIProgressEventSink)) {
						return this;
					}
					throw Components.results.NS_NOINTERFACE;
				},

			}
			req.onreadystatechange = function () {
				if (req.readyState == 4) {
					uploadCallback(req);
				}
			};
			try {
				req.sendAsBinary(data);
			}
			catch (e) {
				ps.alert(
					null,
					Zotero.getString('general.error'),
					"An error occurred sending debug output."
				);
			}
		}
		
		// Get input stream from debug output data
		var unicodeConverter =
			Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
				.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		unicodeConverter.charset = "UTF-8";
		var bodyStream = unicodeConverter.convertToInputStream(output);
		
		// Get listener for when compression is done
		var listener = new Zotero.BufferedInputListener(bufferUploader);
		
		// Initialize stream converter
		var converter =
			Components.classes["@mozilla.org/streamconv;1?from=uncompressed&to=gzip"]
				.createInstance(Components.interfaces.nsIStreamConverter);
		converter.asyncConvertData("uncompressed", "gzip", listener, null);
		
		// Send input stream to stream converter
		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"].
				createInstance(Components.interfaces.nsIInputStreamPump);
		pump.init(bodyStream, -1, -1, 0, 0, true);
		pump.asyncRead(converter, null);
	},
	
	
	clear: function () {
		Zotero.Debug.clear();
		this.updateLines();
	},
	
	
	updateLines: function () {
		var enabled = Zotero.Debug.storing;
		var lines = Zotero.Debug.count();
		document.getElementById('debug-output-lines').value = lines;
		var empty = lines == 0;
		document.getElementById('debug-output-view').disabled = !enabled && empty;
		document.getElementById('debug-output-clear').disabled = empty;
		document.getElementById('debug-output-submit').disabled = empty;
	},
	
	
	_initTimer: function () {
		this._timer = Components.classes["@mozilla.org/timer;1"].
			createInstance(Components.interfaces.nsITimer);
		this._timer.initWithCallback({
			notify: function() {
				Zotero_Preferences.Debug_Output.updateLines();
			}
		}, 10000, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
	},
	
	
	_updateButton: function () {
		var storing = Zotero.Debug.storing
		
		var button = document.getElementById('debug-output-enable');
		if (storing) {
			button.label = Zotero.getString('general.disable');
		}
		else {
			button.label = Zotero.getString('general.enable');
		}
	},
	
	
	onUnload: function () {
		if (this._timer) {
			this._timer.cancel();
		}
	}
}

function onOpenURLSelected()
{
	var openURLServerField = document.getElementById('openURLServerField');
	var openURLVersionMenu = document.getElementById('openURLVersionMenu');
	var openURLMenu = document.getElementById('openURLMenu');
	
	if(openURLMenu.value == "custom")
	{
		openURLServerField.focus();
	}
	else
	{
		openURLServerField.value = openURLResolvers[openURLMenu.selectedIndex]['url'];
		openURLVersionMenu.value = openURLResolvers[openURLMenu.selectedIndex]['version'];
		Zotero.Prefs.set("openURL.resolver", openURLResolvers[openURLMenu.selectedIndex]['url']);
		Zotero.Prefs.set("openURL.version", openURLResolvers[openURLMenu.selectedIndex]['version']);
	}
}

function onOpenURLCustomized()
{
	document.getElementById('openURLMenu').value = "custom";
}

/** STYLES **/

/**
 * Refreshes the list of styles in the styles pane
 * @param {String} cslID Style to select
 */
function refreshStylesList(cslID) {
	var treechildren = document.getElementById('styleManager-rows');
	while (treechildren.hasChildNodes()) {
		treechildren.removeChild(treechildren.firstChild);
	}
	
	var styles = Zotero.Styles.getVisible();
	
	var selectIndex = false;
	var i = 0;
	for each(var style in styles) {
		var treeitem = document.createElement('treeitem');
		var treerow = document.createElement('treerow');
		var titleCell = document.createElement('treecell');
		var updatedCell = document.createElement('treecell');
		var cslCell = document.createElement('treecell');
		
		if (style.updated) {
			var updatedDate = Zotero.Date.formatDate(Zotero.Date.strToDate(style.updated), true);
		}
		else {
			var updatedDate = '';
		}
		
		treeitem.setAttribute('id', 'zotero-csl-' + style.styleID);
		titleCell.setAttribute('label', style.title);
		updatedCell.setAttribute('label', updatedDate);
		// if not EN
		if(style.type == "csl") {
			cslCell.setAttribute('src', 'chrome://zotero/skin/tick.png');
		}
		
		treerow.appendChild(titleCell);
		treerow.appendChild(updatedCell);
		treerow.appendChild(cslCell);
		treeitem.appendChild(treerow);
		treechildren.appendChild(treeitem);
		
		if (cslID == style.styleID) {
			document.getElementById('styleManager').view.selection.select(i);
		}
		i++;
	}
}

/**
 * Adds a new style to the style pane
 **/
function addStyle() {	
	const nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(nsIFilePicker);
	fp.init(window, Zotero.getString("zotero.preferences.styles.addStyle"), nsIFilePicker.modeOpen);
	
	fp.appendFilter("CSL Style", "*.csl");
	fp.appendFilter("ENS Style", "*.ens");
	
	var rv = fp.show();
	if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
		Zotero.Styles.install(fp.file);
	}
}

/**
 * Deletes selected styles from the styles pane
 **/
function deleteStyle() {
	// get selected cslIDs
	var tree = document.getElementById('styleManager');
	var treeItems = tree.lastChild.childNodes;
	var cslIDs = [];
	var start = {};
	var end = {};
	var nRanges = tree.view.selection.getRangeCount();
	for(var i=0; i<nRanges; i++) {
		tree.view.selection.getRangeAt(i, start, end);
		for(var j=start.value; j<=end.value; j++) {
			cslIDs.push(treeItems[j].getAttribute('id').substr(11));
		}
	}
	
	if(cslIDs.length == 0) {
		return;
	} else if(cslIDs.length == 1) {
		var selectedStyle = Zotero.Styles.get(cslIDs[0])
		var text = Zotero.getString('styles.deleteStyle', selectedStyle.title);
	} else {
		var text = Zotero.getString('styles.deleteStyles');
	}
	
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService);
	if(ps.confirm(null, '', text)) {
		// delete if requested
		if(cslIDs.length == 1) {
			selectedStyle.remove();
		} else {
			for(var i=0; i<cslIDs.length; i++) {
				Zotero.Styles.get(cslIDs[i]).remove();
			}
		}
		
		this.refreshStylesList();
		document.getElementById('styleManager-delete').disabled = true;
	}
}

/**
 * Shows an error if import fails
 **/
function styleImportError() {
	alert(Zotero.getString('styles.installError', "This"));
}

/**PROXIES**/

/**
 * Adds a proxy to the proxy pane
 */
function showProxyEditor(index) {
	if(index == -1) return;
	window.openDialog('chrome://zotero/content/preferences/proxyEditor.xul',
		"zotero-preferences-proxyEditor", "chrome, modal", index !== undefined ? proxies[index] : null);
	refreshProxyList();
}

/**
 * Deletes the currently selected proxy
 */
function deleteProxy() {
	if(document.getElementById('proxyTree').currentIndex == -1) return;
	proxies[document.getElementById('proxyTree').currentIndex].erase();
	refreshProxyList();
	document.getElementById('proxyTree-delete').disabled = true;
}

/**
 * Refreshes the proxy pane
 */
function refreshProxyList() {
	if(!document.getElementById("zotero-prefpane-proxies")) return;
	
	// get and sort proxies
	proxies = Zotero.Proxies.proxies.slice();
	for(var i=0; i<proxies.length; i++) {
		if(!proxies[i].proxyID) {
			proxies.splice(i, 1);
			i--;
		}
	}
	proxies = proxies.sort(function(a, b) {
		if(a.multiHost) {
			if(b.multiHost) {
				if(a.hosts[0] < b.hosts[0]) {
					return -1;
				} else {
					return 1;
				}
			} else {
				return -1;
			}
		} else if(b.multiHost) {
			return 1;
		}
		
		if(a.scheme < b.scheme) {
			return -1;
		} else if(b.scheme > a.scheme) {
			return 1;
		}
		
		return 0;
	});
	
	// erase old children
	var treechildren = document.getElementById('proxyTree-rows');
	while (treechildren.hasChildNodes()) {
		treechildren.removeChild(treechildren.firstChild);
	}
	
	// add proxies to list
	for (var i=0; i<proxies.length; i++) {
		var treeitem = document.createElement('treeitem');
		var treerow = document.createElement('treerow');
		var hostnameCell = document.createElement('treecell');
		var schemeCell = document.createElement('treecell');
		
		hostnameCell.setAttribute('label', proxies[i].multiHost ? Zotero.getString("proxies.multiSite") : proxies[i].hosts[0]);
		schemeCell.setAttribute('label', proxies[i].scheme);
		
		treerow.appendChild(hostnameCell);
		treerow.appendChild(schemeCell);
		treeitem.appendChild(treerow);
		treechildren.appendChild(treeitem);
	}
	
	document.getElementById('proxyTree').currentIndex = -1;
	document.getElementById('proxyTree-delete').disabled = true;
	document.getElementById('zotero-proxies-transparent').checked = Zotero.Prefs.get("proxies.transparent");
	document.getElementById('zotero-proxies-autoRecognize').checked = Zotero.Prefs.get("proxies.autoRecognize");
	document.getElementById('zotero-proxies-disableByDomain-checkbox').checked = Zotero.Prefs.get("proxies.disableByDomain");
	document.getElementById('zotero-proxies-disableByDomain-textbox').value = Zotero.Prefs.get("proxies.disableByDomainString");
}

/**
 * Updates proxy autoRecognize and transparent settings based on checkboxes
 */
function updateProxyPrefs() {
	var transparent = document.getElementById('zotero-proxies-transparent').checked;
	Zotero.Prefs.set("proxies.transparent", transparent);
	Zotero.Prefs.set("proxies.autoRecognize", document.getElementById('zotero-proxies-autoRecognize').checked);
	Zotero.Prefs.set("proxies.disableByDomainString", document.getElementById('zotero-proxies-disableByDomain-textbox').value);
	Zotero.Prefs.set("proxies.disableByDomain", document.getElementById('zotero-proxies-disableByDomain-checkbox').checked &&
			document.getElementById('zotero-proxies-disableByDomain-textbox').value != "");

	Zotero.Proxies.init();

	document.getElementById('proxyTree-add').disabled =
		document.getElementById('proxyTree-delete').disabled =
		document.getElementById('proxyTree').disabled =
		document.getElementById('zotero-proxies-autoRecognize').disabled =
		document.getElementById('zotero-proxies-disableByDomain-checkbox').disabled =
		document.getElementById('zotero-proxies-disableByDomain-textbox').disabled = !transparent;

}

/** LANGUAGES **/

/*
 * Initialize the language panel when preferences is
 * opened.
 */
function onLangLoad() {
	var startTime = Date.now();
	refreshMenus();
	refreshLanguages();
	var radios = ['Persons', 'Institutions', 'Titles', 'Publishers', 'Places']
	var forms = ['orig', 'translit', 'translat'];
    // Check for a settings in Prefs. For those not found, set to orig.
    // Then set language in node.
    // Then update disable status on partner nodes.
    for (var i = 0, ilen = radios.length; i < ilen; i += 1) {
		var settings = Zotero.Prefs.get("csl.citation" + radios[i]).split(',');
		if (!settings || !settings[0] || forms.indexOf(settings[0]) == -1) {
			Zotero.Prefs.set("csl.citation" + radios[i], 'orig');
		}
		citationLangSet(radios[i], true);
	}
	Zotero.setupLocale(document);
}

function refreshMenus() {
	Zotero.DB.beginTransaction();
	//var startTime = Date.now();
	refreshScriptMenu();
	//Zotero.debug("XXX scripts: "+(Date.now() - startTime));
	//var startTime = Date.now();
	refreshRegionMenu();
	//Zotero.debug("XXX regions: "+(Date.now() - startTime));
	//
	// The variant menu is built on the fly
	// because the number of items is relatively 
	// small.ZZZ
	// 
	//refreshVariantMenu();
	Zotero.DB.commitTransaction();
}

function refreshScriptMenu () {
	Zotero.DB.beginTransaction();
	var box = document.getElementById('script-lang-box');
	if (!box.childNodes.length) {
		var sql = 'SELECT TA.value AS subtag, D.value AS description FROM zlsSubtags S '
			+ 'LEFT JOIN zlsSubTagData TA ON S.subtag=TA.id '
			+ 'LEFT JOIN zlsSubTagData TY ON S.type=TY.id '
			+ 'LEFT JOIN zlsSubTagData D ON S.description=D.id '
			+ 'WHERE TY.value=? '
			+ 'ORDER BY D.value';
		var res = Zotero.DB.query(sql,['script']);
		for (var i = 0, ilen = res.length; i < ilen; i += 1) {
			var item = document.createElement('menuitem');
			item.setAttribute('label',res[i].description);
			item.setAttribute('id',res[i].subtag+'::script');
			item.setAttribute('onclick','selectScript(this);');
			box.appendChild(item);
		}
	}
	Zotero.DB.commitTransaction();
};

function selectScript(node) {
	var parent = node.parentNode;
	var hiddenItemId = parent.getAttribute('hidden-item');
	if (hiddenItemId) {
		var elem = document.getElementById(hiddenItemId);
		elem.setAttribute('hidden',false);
	}
	var topnode = document.getElementById('extend-lang-menu');
	var rowId = topnode.getAttribute('target-row-id');
	var tag = rowId.slice(0,-5);
	tag += '-' + node.getAttribute('id').slice(0, -8);
	handleDependentLanguageRowInsert(tag);
}

function selectRegion(node) {
	var parent = node.parentNode;
	var topnode = document.getElementById('extend-lang-menu');
	var rowId = topnode.getAttribute('target-row-id');
	var tag = rowId.slice(0,-5);
	tag += '-' + node.getAttribute('id').slice(0, -8);
	handleDependentLanguageRowInsert(tag);
}

function selectVariant(node) {
	var parent = node.parentNode;
	var topnode = document.getElementById('extend-lang-menu');
	var rowId = topnode.getAttribute('target-row-id');
	var tag = rowId.slice(0,-5);
	tag += '-' + node.getAttribute('id').slice(0, -9);
	handleDependentLanguageRowInsert(tag);
}

function handleDependentLanguageRowInsert (tag) {
	var validator = Zotero.zlsValidator;
	var res = validator.validate(tag);
	if (res) {
		insertLanguageRow(validator.tagdata);
	}
}
				
function refreshRegionMenu () {
	Zotero.DB.beginTransaction();
	var box = document.getElementById('region-lang-box');
	if (!box.childNodes.length) {
		var sql = 'SELECT TA.value AS subtag, D.value AS description FROM zlsSubtags S '
			+ 'LEFT JOIN zlsSubTagData TA ON S.subtag=TA.id '
			+ 'LEFT JOIN zlsSubTagData TY ON S.type=TY.id '
			+ 'LEFT JOIN zlsSubTagData D ON S.description=D.id '
			+ 'WHERE TY.value=? '
			+ 'ORDER BY D.value';
		var res = Zotero.DB.query(sql,['region']);
		for (var i = 0, ilen = res.length; i < ilen; i += 1) {
			var item = document.createElement('menuitem');
			item.setAttribute('label',res[i].description);
			item.setAttribute('id',res[i].subtag+'::region');
			item.setAttribute('onclick','selectRegion(this);');
			box.appendChild(item);
		}
	}
	Zotero.DB.commitTransaction();
}

function scriptLangMenuPrep (topnode) {
	var targetId = topnode.getAttribute('target-row-id');
	var tag = targetId.slice(0,-5);
	var sql = 'SELECT SS.value AS script FROM zlsSubtags S '
		+ 'LEFT JOIN zlsSubTagData TA ON S.subtag=TA.id '
		+ 'LEFT JOIN zlsSubTagData SS ON S.suppressscript=SS.id '
		+ 'LEFT JOIN zlsSubTagData TY ON S.type=TY.id '
		+ 'WHERE TY.value=? AND TA.value=? AND S.suppressscript IS NOT NULL';
	var script = Zotero.DB.columnQuery(sql,['language',tag]);
	if (script && script.length) {
		var elem = document.getElementById(script[0]+'::script');
		elem.setAttribute('hidden',true);
		elem.parentNode.setAttribute('hidden-item',script[0]+'::script');
	}
}

function variantLangMenuPrep (topnode) {
	var existing_variants = "";
	var targetId = topnode.getAttribute('target-row-id');
	var menubox = document.getElementById('variant-lang-box');
	for (var i = menubox.childNodes.length - 1; i > -1; i += -1) {
		menubox.removeChild(menubox.childNodes[i]);
	}
	var tag = targetId.slice(0,-5);
	// Drop regions for prefix comparison
	var searchtag = tag.replace(/(?:-[A-Z]{2})/g,"").replace(/(?:-[0-9]{3})/g,"");
	var m = searchtag.match(/(?:([0-9]{4,8}|[a-zA-Z][a-zA-Z0-9]{4,8})(?:-|$))/g);
	if (m) {
		for (var i = 0, ilen = m.length; i < ilen; i += 1) {
			m[i] = m[i].replace(/-$/,"");
		}
		existing_variants = "'" + m.join("','") + "'";
	}
	var sql = 'SELECT TA.value AS subtag, D.value AS description FROM zlsSubtags S '
		+ 'LEFT JOIN zlsSubTagData TA ON S.subtag=TA.id '
		+ 'LEFT JOIN zlsSubTagData TY ON S.type=TY.id '
		+ 'LEFT JOIN zlsSubTagData D ON S.description=D.id '
		+ 'LEFT JOIN zlsSubTagData PR ON S.prefix=PR.id '
		+ 'WHERE TY.value=? AND (PR.value=? OR S.prefix IS NULL) AND NOT TA.value IN (?)';
	var res = Zotero.DB.query(sql,['variant',searchtag,existing_variants]);
	for (var i = 0, ilen = res.length; i < ilen; i += 1) {
		var item = document.createElement('menuitem');
		item.setAttribute('label',res[i].description);
		item.setAttribute('id',res[i].subtag+'::variant');
		item.setAttribute('onclick','selectVariant(this);');
		menubox.appendChild(item);
	}
}

function refreshLanguages () {
	var parent = document.getElementById("language-rows");
	for (var i = parent.childNodes.length - 1; i > -1; i += -1) {
		parent.removeChild(parent.childNodes[i]);
	}
	var tags = Zotero.DB.query("SELECT * FROM zlsTags ORDER BY tag");
	for (var i = 0, ilen = tags.length; i < ilen; i += 1) {
		var validator = Zotero.zlsValidator;
		var res = validator.validate(tags[i].tag);
		if (res) {
			var row = addLangRow(parent, tags[i].nickname, validator.tagdata);
			row.setAttribute("class", "compact");
			addSelectors(row, tags[i]);
			parent.appendChild(row);
		}
		// Should have an else here, that deletes invalid tags
		// from zlsTags et al. ?
	}
}

function getTagFromTagdata (tagdata) {
	var tag = [];
	for (var i = 0, ilen = tagdata.length; i < ilen; i += 1) {
		tag.push(tagdata[i].subtag);
	}
	tag = tag.join('-');
	return tag;
}

function addLangRow(parent, nickname, tagdata) {
	// Compose tag name as a string
	var tag = getTagFromTagdata(tagdata);
	
	// New row node
	var newrow = document.createElement('row');
	newrow.setAttribute('id', tag+'::row');
	newrow.setAttribute("class", "compact");
	
	// Set nickname

	var firsthbox = document.createElement('hbox');
	firsthbox.setAttribute('class', 'zotero-clicky');
	firsthbox.setAttribute("flex", "1");
	firsthbox.setAttribute('onclick', 'showNicknameEditor(this.firstChild)');
	var valbox = document.createElement('description');
	valbox.setAttribute("width", "100");
	//valbox.setAttribute("style", "font-size:larger;");
	valbox.textContent = nickname;
	firsthbox.appendChild(valbox);
	newrow.appendChild(firsthbox);

	var secondhbox = document.createElement('hbox');
	secondhbox.setAttribute('minwidth', '150');
	secondhbox.setAttribute('maxwidth', '150');
	// Set tags
	if (tagdata.length) {
		addSubtag(secondhbox, tagdata[0]);		
	}
	for (var i = 1, ilen = tagdata.length; i < ilen; i += 1) {
		var subtagdata = tagdata[i];
		addHyphen(secondhbox);
		addSubtag(secondhbox, subtagdata);
	}
	newrow.appendChild(secondhbox);

	var thirdhbox = document.createElement('hbox');
	var removeButton = document.createElement('label');
	removeButton.setAttribute('value', "-");
	removeButton.setAttribute('class', 'zotero-clicky zotero-clicky-minus');
	removeButton.setAttribute('style', 'max-height:18px;min-height:18px;');
	removeButton.setAttribute('disabled',true);
	setRemoveDisable(removeButton, tag);
	var removeBox = document.createElement("vbox");
	removeBox.appendChild(removeButton);
	thirdhbox.appendChild(removeBox);

	var addButton = document.createElement('label');
	addButton.setAttribute('value', "+");
	addButton.setAttribute('class', 'zotero-clicky zotero-clicky-plus');
	addButton.setAttribute('style', 'min-height:18px;max-height:18px;');
	addButton.setAttribute('disabled',false);
	addButton.setAttribute('onmouseover','extendLangMenuPrep(this.parentNode.parentNode.parentNode)');
	addButton.setAttribute('popup','extend-lang-menu');
	var addBox = document.createElement("vbox");
	addBox.appendChild(addButton);
	thirdhbox.appendChild(addBox);
	newrow.appendChild(thirdhbox);

	// temporary
	parent.appendChild(newrow);
	return newrow;
}

function addHyphen(box) {
	var label = document.createElement('label');
	label.setAttribute('value','-');
	label.setAttribute('style','font-size:larger;margin:0px;');
	box.appendChild(label);
}

function addSubtag(box, subtagdata) {
	var label = document.createElement('label');
	label.setAttribute('tooltiptext',subtagdata.description);
	label.setAttribute('value',subtagdata.subtag);
	label.setAttribute('type',subtagdata.type);
	label.setAttribute('style','font-size:larger;margin:0px;');
	box.appendChild(label);
}

/*
 * Handle Return key (traps to prevent panel from closing immediately)
 */
function handleLangKeypress (event, type) {
	//alert(textbox.mController);
	var target = event.target;
	var focused = document.commandDispatcher.focusedElement;
					
	switch (event.keyCode) {
		case event.DOM_VK_TAB:
		case event.DOM_VK_RETURN:
			event.preventDefault();
			switch (type) {
				case 'simpleEdit':
					hideNicknameEditor(target);
				default:
					event.target.value = '';
					event.target.blur();
			}
		break;
	}
	return false;
}

/*
 * Support function for SAYT
 */
function getResultComment (textbox){
	var controller = textbox.controller;
	
	for (var i=0; i<controller.matchCount; i++) {
		if (controller.getValueAt(i) == textbox.value) {
			return controller.getCommentAt(i);
		}
	}
	return false;
}


/*
 * Function performed after auto-complete selection.
 */
function handleLangAutoCompleteSelect (textbox) {
	if (textbox.value) {
		// Comment is the tag code, value is the tag description
		
		var comment = getResultComment(textbox);
		if (!comment) {
			textbox.value = '';
		} else {
			var validator = Zotero.zlsValidator;
			if (validator.validate(comment)) {
				insertLanguageRow(validator.tagdata);
				textbox.value = '';
				textbox.blur();
			}
		}
	}
}

function insertLanguageRow (tagdata) {
	// XXXZ This does not run for primary tags ... system uses
	// cachedLanguages instead. Should be using cachedLanguages
	// for everything?
	var tag = getTagFromTagdata(tagdata);
	var parent = getTagFromTagdata(tagdata.slice(0,-1));
	var sql = "INSERT INTO zlsTags VALUES (?,?,?)";
	// XXXZ The parent field is unnecessary and can be
	// dropped.
	// XXXZ The tag should be added to the (persistent)
	// store of language tags seen by the system if
	// necessary, so that it is assigned an integer
	// value.
	// XXXZ The second tag field should be the integer
	// key of the tag.
	Zotero.DB.query(sql, [tag,tag,parent]);
	refreshLanguages();
}

function extendLanguageTopMenu (row) {
	// ZZZ
	var tag = row.getAttribute('id').slice(0,-5);
	//alert("Extend me: "+tag);
	var validator = Zotero.zlsValidator;
	var tagdata = validator.validate(tag);
	var menudata = getLanguageMenuData(tag, tagdata);
}

function extendLangMenuPrep(row) {
	var menu = document.getElementById('extend-lang-menu');
	menu.setAttribute('target-row-id',row.getAttribute('id'));
	var type = row.firstChild.nextSibling.lastChild.getAttribute('type');
	var scriptElem = document.getElementById('script-lang-menu');
	var regionElem = document.getElementById('region-lang-menu');
	var variantElem = document.getElementById('variant-lang-menu');
	if (type === 'script') {
		scriptElem.setAttribute('hidden',true);
	} else if (type === 'region') {
		scriptElem.setAttribute('hidden',true);		
		regionElem.setAttribute('hidden',true);		
	} else if (type === 'variant') {
		scriptElem.setAttribute('hidden',true);		
		regionElem.setAttribute('hidden',true);
		// If no variants are available, the + button
		// itself will be disabled, so no special
		// action is required here.
	} else {
		scriptElem.setAttribute('hidden',false);
		regionElem.setAttribute('hidden',false);		
	}
}

/*
 * Disable or enable the delete button on language rows,
 * as appropriate.
 */
function setRemoveDisable(button, tag) {
	if (tagDependents(tag)) {
		button.setAttribute('disabled',true);
		button.setAttribute('onclick',false);
	} else {
		button.setAttribute('disabled',false);
		button.setAttribute('onclick','deleteTag(this.parentNode.parentNode.parentNode)');
	}
}

/*
 * Deletes a language tag from the preferences
 * panel and from the language tags table in the 
 * database.
 */
function deleteTag (row) {
	var tag = row.getAttribute('id');
	// tag attribute on the row carries a '::row' suffix.
	tag = tag.slice(0,-5);
	if (!tagDependents(tag)) {
		var sql = "DELETE FROM zlsTags WHERE tag=?";
		Zotero.DB.query(sql,[tag]);
	}
	refreshLanguages();
}

/*
 * Check for dependents and preferences that rely
 * on a tag.  Return true if found, false if not.
 */
function tagDependents (tag) {
	// Releasing dependent-tag constraint: disable delete
	// only when used in default prefs.
	//var sql = "SELECT COUNT(*) FROM zlsTags WHERE parent=?";
	// dependent tags
	//var hasDependents = Zotero.DB.valueQuery(sql, [tag]);

	var hasDependents = false;
	if (!hasDependents) {
		// dependent preferences
		var sql = "SELECT COUNT(*) FROM zlsPreferences WHERE tag=?";
		hasDependents = Zotero.DB.valueQuery(sql, [tag]);
	}
	return hasDependents;
}

/*
 * Check for a given nickname in the list of chosen
 * language tags.  Return true if found, false if not.
 */
function nicknameExists (nickname) {
	var sql = 'SELECT COUNT(*) FROM zlsTags WHERE nickname=?';
	var result = Zotero.DB.valueQuery(sql,[nickname]);
	return result;
}

function showNicknameEditor (label) {
	var parent = label.parentNode;
	parent.setAttribute('onclick',false);
	var textbox = document.createElement('textbox');
	textbox.setAttribute('value',label.textContent);
	textbox.setAttribute('oncommand','hideNicknameEditor(this)');
	textbox.setAttribute('width','80');
	textbox.setAttribute('onkeypress', 'handleLangKeypress(event,"simpleEdit")');
	textbox.setAttribute('flex','1');
	parent.replaceChild(textbox,label);
	textbox.focus();
}

function hideNicknameEditor (textbox) {
	if (textbox.value !== textbox.getAttribute('value') && nicknameExists(textbox.value)) {
		return;
	}
	var oldval = textbox.getAttribute('value');
	var newval = textbox.value;
	var parent = textbox.parentNode;
	parent.setAttribute('onclick', 'showNicknameEditor(this.firstChild)');
	var label = document.createElement('description');
	label.textContent = newval;
	label.setAttribute('style', 'font-size:larger;');
	label.setAttribute("width", "100");
	parent.replaceChild(label, textbox);
	var sql = 'UPDATE zlsTags SET nickname=? WHERE nickname=?';
	Zotero.DB.query(sql,[newval,oldval]);
	Zotero.CachedLanguages.taint();
	//updateSelectors(parent.parentNode, parent.parentNode.id.slice(-5));
}

function addSelectors (row, tag) {
	//var tags = Zotero.DB.query("SELECT * FROM zlsTags ORDER BY tag");
	//while (row.childNodes.length) {
	//	row.removeChild(row.childNodes[0]);
	//}
	var languageSelectorTypes = [
		'zoteroSort',
		'zoteroDisplay',
		'citationTransliteration',
		'citationTranslation',
		'citationSort'
	];
	for (var j = 0, jlen = languageSelectorTypes.length; j < jlen; j += 1) {
		var newselector = buildSelector('default',tag,languageSelectorTypes[j]);
		if ((j % 5) == 2) {
			newselector.setAttribute("class", "translit");
            newselector.setAttribute("onmouseover", "setLanguageRoleHighlight(['translit-primary', 'translit-secondary', 'translit'],true);");
            newselector.setAttribute("onmouseout", "setLanguageRoleHighlight(['translit-primary', 'translit-secondary', 'translit'],false);");
		} else if ((j % 5) == 3) {
			newselector.setAttribute("class", "translat");
            newselector.setAttribute("onmouseover", "setLanguageRoleHighlight(['translat-primary', 'translat-secondary', 'translat'],true);");
            newselector.setAttribute("onmouseout", "setLanguageRoleHighlight(['translat-primary', 'translat-secondary', 'translat'],false);");
		}
		row.appendChild(newselector);
	}
}

function setLanguageRoleHighlight(classes, mode) {
	for (var i = 0, ilen = classes.length; i < ilen; i += 1) {
		var nodes = document.getElementsByClassName(classes[i]);
		for (var j = 0, jlen = nodes.length; j < jlen; j += 1) {
            var lst;
			var str = nodes[j].getAttribute("class");
			if (str) {
				lst = str.split(/\s+/);
			} else {
				lst = [];
			}
			if (mode) {
				lst.push("language-role-highlight");
				nodes[j].setAttribute("class", lst.join(" "));
			} else {
                for (var k = lst.length - 1; k > -1; k += -1) {
                    if (lst[k] === "language-role-highlight") {
                        lst = lst.slice(0, k).concat(lst.slice(k + 1));
                    }
                }
                nodes[j].setAttribute("class", lst.join(" "));
            }
		}
	}
};

function buildSelector (profile,tagdata,param) {
	var checkbox = document.createElement('checkbox');
	if (langPrefIsSet(profile,tagdata.tag,param)) {
		checkbox.setAttribute('checked',true);
	}
	checkbox.setAttribute('profile', profile);
	checkbox.setAttribute('param', param);
	checkbox.setAttribute('oncommand', 'setLangPref(event)');
	checkbox.setAttribute('value',tagdata.tag);
	checkbox.setAttribute("style", "overflow:hidden;margin-top:0px;max-width:18px;max-height:18px;");
	var checkboxBox = document.createElement("vbox");
	checkboxBox.appendChild(checkbox);
	var hbox = document.createElement("hbox");
	hbox.setAttribute("flex", "1");
	var lbox = document.createElement("hbox");
	lbox.setAttribute("flex", 1);
	var rbox = document.createElement("hbox");
	rbox.setAttribute("flex", 1);
	hbox.appendChild(lbox);
	hbox.appendChild(checkboxBox);
	hbox.appendChild(rbox);
	//checkbox.setAttribute('label',tagdata.nickname);
	//checkbox.setAttribute('type','checkbox');
	//checkbox.setAttribute('flex','1');
	return hbox;
}

function langPrefIsSet(profile,tag,param) {
	var sql = 'SELECT COUNT(*) FROM zlsPreferences WHERE profile=? AND tag=? AND param=?';
	var res = Zotero.DB.valueQuery(sql,[profile, tag, param]);
	return res;
}

function setLangPref(event) {
	var target = event.target;
	var profile = target.getAttribute('profile');
	var param = target.getAttribute('param');
	var tag = target.getAttribute('value');
	var enable = target.hasAttribute('checked');
	if (enable) {
		var sql = 'INSERT INTO zlsPreferences VALUES (?,?,?)';
		Zotero.DB.query(sql,['default',param,tag]);
	} else {
		var sql = 'DELETE FROM zlsPreferences WHERE profile=? AND param=? and tag=?';
		Zotero.DB.query(sql,['default',param,tag]);
	}
	Zotero.CachedLanguagePreferences.taint();
	var langRow = document.getElementById(tag+'::row');
	var removeButton = langRow.lastChild.lastChild.previousSibling;
	setRemoveDisable(removeButton,tag);
};

/**
 * Determines if there are word processors, and if not, enables no word processor message
 */
function updateWordProcessorInstructions() {
	if(document.getElementById("wordProcessors").childNodes.length == 2) {
		document.getElementById("wordProcessors-noWordProcessorPluginsInstalled").hidden = undefined;
	}
	if(Zotero.isStandalone) {
		document.getElementById("wordProcessors-getWordProcessorPlugins").hidden = true;
	}
}

/**
 * Sets "Status bar icon" to "None" if Zotero is set to load in separate tab on Fx 4
 */
function handleShowInPreferenceChange() {
	var showInSeparateTab = document.getElementById("zotero-prefpane-general-showIn-separateTab");
	var showInAppTab = document.getElementById("zotero-prefpane-general-showIn-appTab");
	if(Zotero.isFx4) {
		if(showInAppTab.selected) {
			document.getElementById('statusBarIcon').selectedItem = document.getElementById('statusBarIcon-none');
			Zotero.Prefs.set("statusBarIcon", 0);
		} else if(Zotero.isFx4) {
			document.getElementById('statusBarIcon').selectedItem = document.getElementById('statusBarIcon-full');
			Zotero.Prefs.set("statusBarIcon", 2);
		}
	}
}

/**
 * Opens a URI in the basic viewer in Standalone, or a new window in Firefox
 */
function openInViewer(uri, newTab) {
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		.getService(Components.interfaces.nsIWindowMediator);
	const features = "menubar=yes,toolbar=no,location=no,scrollbars,centerscreen,resizable";
	
	if(Zotero.isStandalone) {
		var win = wm.getMostRecentWindow("zotero:basicViewer");
		if(win) {
			win.loadURI(uri);
		} else {
			window.openDialog("chrome://zotero/content/standalone/basicViewer.xul",
				"basicViewer", "chrome,resizable,centerscreen,menubar,scrollbars", uri);
		}
	} else {
		var win = wm.getMostRecentWindow("navigator:browser");
		if(win) {
			if(newTab) {
				win.gBrowser.selectedTab = win.gBrowser.addTab(uri);
			} else {
				win.open(uri, null, features);
			}
		}
		else {
			var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
						.getService(Components.interfaces.nsIWindowWatcher);
			var win = ww.openWindow(null, uri, null, features + ",width=775,height=575", null);
		}
	}
}

function capFirst(str) {
	return str[0].toUpperCase() + str.slice(1);
}

function citationPrimary(node) {
	var lst = node.id.split('-');
	var base = lst[0];
    var primarySetting = lst[2];
	var settings = Zotero.Prefs.get('csl.citation' + capFirst(base));
    if (settings) {
        settings = settings.split(',');
    } else {
        settings = ['orig'];
    }
	Zotero.Prefs.set('csl.citation' + capFirst(base), [primarySetting].concat(settings.slice(1)).join(','));
    // Second true is for a radio click
	citationLangSet(capFirst(base), true, true);
}

// Possibly want to cast two separate functions,
// depending on whether we are updating in onpopupshowing
// or menuitem? Is the ticked state the same in the two?
function citationSecondary() {
    var node = document.popupNode;
	var lst = node.id.split('-');
	var base = lst[0];
	var addme = false;
	var cullme = false;
	var secondarySetting = lst[2];
    var forms = ['orig', 'translit', 'translat'];
    // Check-box has not yet changed when this executes.
	if (!node.checked) {
		addme = secondarySetting;
	} else {
		cullme = secondarySetting;
        // Also unset configured affixes.
        citationSetAffixes(node);
	}
	var settings = Zotero.Prefs.get('csl.citation' + capFirst(base));
    var primarySetting = settings.split(',')[0];
	settings = settings.split(',').slice(1);
    for (var i = 0, ilen = settings.length; i < ilen; i += 1) {
        if (forms.indexOf(settings[i]) === -1) {
            settings = settings.slice(0, i).concat(settings.slice(i + 1));
        }
    }
	if (addme && settings.indexOf(secondarySetting) === -1) {
		settings.push(secondarySetting);
	}
	if (cullme) {
		var cullidx = settings.indexOf(secondarySetting);
		if (cullidx > -1) {
			settings = settings.slice(0, cullidx).concat(settings.slice(cullidx + 1));
		}
	}
	Zotero.Prefs.set('csl.citation' + capFirst(base), [primarySetting].concat(settings).join(','));
    if (addme || cullme) {
	    citationLangSet(capFirst(base));
    }
}

function citationLangSet (name, init, radioClick) {
	var settings = Zotero.Prefs.get('csl.citation' + name).split(',');
	if (!settings || !settings[0]) {
		settings = ['orig'];
	}
	var nodes = [];
	var forms = ['orig', 'translit', 'translat'];
    var base = name.toLowerCase();
    // get node
    // set node from pref
    if (init) {
        citationGetAffixes();
        var currentPrimaryID = base + "-radio-" + settings[0];
        var node = document.getElementById(currentPrimaryID);
        var control = node.control;
        control.selectedItem = node;

        var translitID = base + "-radio-translit";
        var translitNode = document.getElementById(translitID);
        nodes.push(translitNode);

        for (var i = 0, ilen = forms.length; i < ilen; i += 1) {
            nodes.push(document.getElementById(base + "-checkbox-" + forms[i]));
        }
	    for (var i = 0, ilen = nodes.length; i < ilen; i += 1) {
		    nodes[i].checked = false;
		    for (var j = 1, jlen = settings.length; j < jlen; j += 1) {
			    if (nodes[i].id === base + '-checkbox-' + settings[j]) {
				    nodes[i].checked = true;
			    }
		    }
		    if (nodes[i].id === base + "-checkbox-" + settings[0]) {
			    nodes[i].checked = false;
			    var idx = settings.slice(1).indexOf(settings[0]);
			    if (idx > -1) {
				    // +1 and +2 b/c first-position item (primary) is sliced off for this check
				    settings = settings.slice(0,idx + 1).concat(settings.slice(idx + 2)); 
				    Zotero.Prefs.set('csl.citation' + capFirst(base), settings.join(','));
			    }
                citationSetAffixes(nodes[i]);
			    nodes[i].disabled = true;
            } else if (radioClick && nodes[i].id === translitID) {
                // true invokes a quash of the affixes
                if (currentPrimaryID === translitID) {
                    citationSetAffixes(nodes[i]);
                } else {
                    citationSetAffixes(nodes[i], null, true);
                }
            } else {
			    nodes[i].disabled = false;
		    }
	    }
    }
}

function citationSetAffixes (node, affixNode, quashPrimaryAffixes) {
    if (!node) {
        var node = document.popupNode;
    }
    var currentId = node.id;
    var prefixNode = document.getElementById(node.id + '-prefix');
    var suffixNode = document.getElementById(node.id + '-suffix');
    if (!affixNode || quashPrimaryAffixes) {
        prefixNode.value = "";
        suffixNode.value = "";
    } else {
        var prefix = affixNode.value.split("|")[0];
        if (!prefix) {
            prefix = "";
        }
        var suffix = affixNode.value.split("|")[1];
        if (!suffix) {
            suffix = "";
        }
        prefixNode.value = prefix;
        suffixNode.value = suffix;
    }
    // Do something to store this data in Prefs
    var types = ['persons', 'institutions', 'titles', 'publishers', 'places'];
	var forms = ['orig', 'translit', 'translat'];
    var affixList = [];
    for (var i = 0, ilen = types.length; i < ilen; i += 1) {
        affixListPush(types[i], "radio", "translit", affixList, "prefix");
        affixListPush(types[i], "radio", "translit", affixList, "suffix");
        for (var j = 0, jlen = forms.length; j < jlen; j += 1) {
            affixListPush(types[i], "checkbox", forms[j], affixList, "prefix");
            affixListPush(types[i], "checkbox", forms[j], affixList, "suffix");
        }
    }
    var affixes = affixList.join('|');
    Zotero.Prefs.set('csl.citationAffixes', affixes);
}

function affixListPush(type, boxtype, form, lst, affix) {
    var elem = document.getElementById(type + "-" + boxtype + "-" + form + "-" +affix);
    if (!elem.value) {
        elem.value = "";
    }
    lst.push(elem.value);
};

// Hurray. For UI, all we need now is a function to apply the stored
// affixes back into nodes.
function citationGetAffixes () {
    var affixList = Zotero.Prefs.get('csl.citationAffixes');
    if (affixList) {
        affixList = affixList.split('|');
    } else {
        affixList = '|||||||||||||||||||||||||||||||||||||||'.split('|');
    }
    var types = ['persons', 'institutions', 'titles', 'publishers', 'places'];
	var forms = ['orig', 'translit', 'translat'];
    var count = 0;
    for (var i = 0, ilen = types.length; i < ilen; i += 1) {
        count =  citationGetAffixesAction(types[i], "radio", "translit", affixList, count);

        for (var j = 0, jlen = forms.length; j < jlen; j += 1) {
            count = citationGetAffixesAction(types[i], "checkbox", forms[j], affixList, count);
        }
    }
}

function citationGetAffixesAction(type, boxtype, form, affixList, count) {
    var affixPos = ['prefix', 'suffix']
    for (var k = 0, klen = affixPos.length; k < klen; k += 1) {
        var id = type + '-' + boxtype + '-' + form + '-' + affixPos[k];
        var node = document.getElementById(id);
        if (affixList[count]) {
            node.value = affixList[count];
        }
        count += 1;
    }
    return count;
}
