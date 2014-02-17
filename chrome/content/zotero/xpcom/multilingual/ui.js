// Extended fields needed to support the MLZ styles

Zotero.EXTENDED_CREATORS = {
	"patent":{
		"recipient":"recipient"
	},
	"book":{
		"recipient":"recipient"
	},
	"chapter":{
		"recipient":"recipient"
	},
	"hearing":{
		"testimonyBy":"author"
	}
}

Zotero.EXTENDED_TYPES = {
	"gazette":"statute",
	"regulation":"statute",
	"classic":"manuscript",
	"treaty":"document",
	"standard":"document"
}

Zotero.EXTENDED_FIELDS = {
	"book": {
        "medium":"medium",
        "volumeTitle":"volume-title"
	},
	"bookSection": {
        "volumeTitle":"volume-title"
	},
	"standard": {
        "version":"version",
        "number":"number"
	},
	"conferencePaper": {
        "conferenceDate":"event-date",
        "issue":"issue",
        "institution":"authority"
	},
	"newspaperArticle": {
		"jurisdiction":"jurisdiction",
		"newsCaseDate":"original-date",
        "court":"authority"
	},
	"journalArticle": {
		"status":"status",
		"jurisdiction":"jurisdiction"
	},
	"bill": {
		"jurisdiction":"jurisdiction",
		"resolutionLabel":"event",
		"assemblyNumber":"collection-number",
		"sessionType":"genre",
		"archiveLocation":"archive_location",
		"reporter":"container-title"
	}, 
	"hearing":{
		"jurisdiction":"jurisdiction",
		"assemblyNumber":"collection-number",
		"resolutionLabel":"event",
		"sessionType":"genre",
		"archiveLocation":"archive_location",
		"reporter":"container-title",
		"meetingName":"chapter-number",
		"meetingNumber":"number"
	},
	"artwork": {
		"websiteTitle":"container-title"
	}, 
	"patent": {
		"jurisdiction":"jurisdiction",
		"priorityDate":"original-date",
		"publicationDate":"publication-date",
		"publicationNumber":"publication-number"
	}, 
	"case": {
		"jurisdiction":"jurisdiction",
		"place":"event-place",
		"yearAsVolume":"collection-number",
		"publisher": "publisher",
		"publicationDate":"publication-date",
		"reign":"genre",
		"callNumber":"call-number",
		"filingDate":"submitted",
		"supplementName":"genre",
		"issue":"issue",
		"archive":"archive",
		"archiveLocation":"archive_location"
	}, 
	"statute": {
		"jurisdiction":"jurisdiction",
		"publisher":"publisher",
		"publicationDate":"publication-date",
		"reign":"genre",
		"regnalYear":"collection-number"
	}, 
	"audioRecording": {
		"album":"container-title",
		"opus":"section",
		"originalDate":"original-date",
		"publisher":"publisher",
		"release":"edition"
	},
	"podcast": {
		"date":"issued",
		"publisher":"publisher"
	},
	"videoRecording": {
		"websiteTitle":"container-title"
	},
	"report": {
		"bookTitle":"container-title",
		"jurisdiction":"jurisdiction",
		"status":"status",
		"medium":"medium"
	},
	"gazette": {
		"jurisdiction":"jurisdiction",
		"publisher":"publisher",
		"publicationDate":"publication-date"
	},
	"regulation": {
		"jurisdiction":"jurisdiction",
		"publisher":"publisher",
		"publicationDate":"publication-date",
		"regulatoryBody":"authority",
		"regulationType":"genre"
	},
	"treaty": {
		"reporter":"container-title",
		"volume":"volume",
		"pages":"page",
		"section":"section",
		"openingDate":"available-date",
		"adoptionDate":"original-date",
		"signingDate":"event-date",
		"version":"version"
	},
	"classic":{
		"volume":"volume"
	},
	"document":{
		"version":"version"
	}
}

// Implement UI language switching
// Based on sample application at https://developer.mozilla.org/En/How_to_enable_locale_switching_in_a_XULRunner_application

Zotero.LANGUAGE_NAMES = {
	"af-ZA": "Afrikaans",
	"ar": "Arabic",
	"bg-BG": "Bulgarian",
	"ca-AD": "Catalan",
	"cs-CZ": "Czech",
	"da-DK": "Danish",
	"de-AT": "Austrian",
	"de-CH": "Swiss German",
	"de": "German",
	"el-GR": "Greek",
	"en-US": "English (US)",
	"es-ES": "Spanish",
	"et-EE": "Estonian",
	"eu-ES": "Basque",
	"fa": "Farsi",
	"fi-FI": "Finnish",
	"fr-FR": "French",
	"gl-ES": "Galician",
	"he-IL": "Hebrew",
	"hu-HU": "Magyar",
	"hr-HR": "Croatian",
	"is-IS": "Icelandic",
	"it-IT": "Italian",
	"ja-JP": "Japanese",
	"km": "Khmer",
	"ko-KR": "Korean",
	"lt": "Lithuanian",
	"lv": "Latvian",
	"mn-MN": "Mongolian",
	"nb-NO": "Norwegian Bokmål",
	"nl-NL": "Dutch",
	"nn-NO": "Norwegian Nynorsk",
	"pl-PL": "Polish",
	"pt-BR": "Brazilian Portuguese",
	"pt-PT": "Portuguese",
	"ro-RO": "Romanian",
	"ru-RU": "Russian",
	"sk-SK": "Slovak",
	"sl-SI": "Slovene",
	"sr-RS": "Serbian",
	"sv-SE": "Swedish",
	"th-TH": "Thai",
	"tr-TR": "Turkish",
	"uk-UA": "Ukranian",
	"vi-VN": "Vietnamese",
	"zh-CN": "Chinese (Mainland)",
	"zh-TW": "Chinese (Taiwan)"
}

Zotero.DOCUMENT_MULTI_PREFERENCES = [
	"citationTranslation",
	"citationTransliteration",
	"citationSort",
	"citationLangPrefsPersons",
	"citationLangPrefsInstitutions",
	"citationLangPrefsTitles",
	"citationLangPrefsJournals",
	"citationLangPrefsPublishers",
	"citationLangPrefsPlaces"
];

Zotero.LANGUAGE_INDEX = {}

Zotero.setupLocale = function(document) {

	try {
		// Query available and selected locales
	
		var chromeRegService = Components.classes["@mozilla.org/chrome/chrome-registry;1"].getService();
		var xulChromeReg = chromeRegService.QueryInterface(Components.interfaces.nsIXULChromeRegistry);
		var toolkitChromeReg = chromeRegService.QueryInterface(Components.interfaces.nsIToolkitChromeRegistry);
		
		var selectedLocale = xulChromeReg.getSelectedLocale("zotero");

		var availableLocales = toolkitChromeReg.getLocalesForPackage("zotero");
		
		// Render locale menulist
		const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

/////		

		var localeMenulist = document.getElementById("ui-menulist");
		// Wipe out any existing menupopup
		if (localeMenulist.firstChild) {
			localeMenulist.removeChild(firstChild);
		}
		// Set empty popup
		var menupopup = document.createElement('menupopup');
		localeMenulist.appendChild(menupopup);
		
		var selectedItem = null;

		// Get the list of locales and assign names to each item
		var locales = [];
		var locale;
 		while(availableLocales.hasMore()) {
			locale = availableLocales.getNext();
			locales.push({value: locale, label: Zotero.LANGUAGE_NAMES[locale]});
			if (locale == selectedLocale) {
				// Is this the current locale?
				localeMenulist.setAttribute('label', Zotero.LANGUAGE_NAMES[locale]);
				localeMenulist.setAttribute('value', locale);
			}
		}
		// Sort the list by name
		locales.sort( function(a,b){return a.label.localeCompare(b.label)} );
		for (var i = 0, ilen = locales.length; i < ilen; i += 1) {
			Zotero.LANGUAGE_INDEX[locales[i].value] = i;
		}
		// Render the list
		for (var i = 0, ilen = locales.length; i < ilen; i += 1) {
			var locale = locales[i];
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("value", locale.value);
			menuitem.setAttribute("label", locale.label);	
			menupopup.appendChild(menuitem);
		}

		var availableLocales = [];
        for (var key in Zotero.CiteProc.CSL.LANGS) {
            availableLocales.push(key);
        }
		var selectedLocale = Zotero.Prefs.get('export.bibliographyLocale');
		if (!selectedLocale || !availableLocales[selectedLocale]) {
			Zotero.Prefs.set('export.bibliographyLocale', 'en-US');
		}

		var localeMenulist = document.getElementById("locale-menulist");
		// Wipe out any existing menupopup
		if (localeMenulist.firstChild) {
			localeMenulist.removeChild(firstChild);
		}
		// Set empty popup
		var menupopup = document.createElement('menupopup');
		localeMenulist.appendChild(menupopup);
		
		var selectedItem = null;

		// Get the list of locales and assign names to each item
		var locale;
        var locales = [];
        for (var i=0, ilen=availableLocales.length; i<ilen; i += 1) {
            locale = availableLocales[i];
			locales.push({value: locale, label: Zotero.CiteProc.CSL.LANGS[locale]});
			if (locale == selectedLocale) {
				// Is this the current locale?
				localeMenulist.setAttribute('label', Zotero.CiteProc.CSL.LANGS[locale]);
				localeMenulist.setAttribute('value', locale);
			}
        }
		// Sort the list by name
		locales.sort( function(a,b){return a.label.localeCompare(b.label)} );
		// Render the list
		for (var i = 0, ilen = locales.length; i < ilen; i += 1) {
			var locale = locales[i];
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("value", locale.value);
			menuitem.setAttribute("label", locale.label);	
			menupopup.appendChild(menuitem);
		}
	} catch (err) {
		Zotero.debug ("PPP Failed to render locale menulist: " + err);	
	}	
}


Zotero.switchLocale = function(document) {

	try {
		// Which locale did the user select?
		var localeMenulist = document.getElementById("ui-menulist");
		var newLocale = localeMenulist.getAttribute('value');
		
		// Write preferred locale to local user config
		var prefs = Components.classes["@mozilla.org/preferences-service;1"].
					getService(Components.interfaces.nsIPrefBranch);
		prefs.setCharPref("general.useragent.locale", newLocale);
		
		// Ignore the locale suggested by the OS
		prefs.setBoolPref("intl.locale.matchOS", false);

		// Restart application
		var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
					 .getService(Components.interfaces.nsIAppStartup);

		appStartup.quit(Components.interfaces.nsIAppStartup.eRestart |
		 				Components.interfaces.nsIAppStartup.eAttemptQuit);
		
	} catch(err) {
	
		Zotero.debug("XXX Couldn't change locale: " + err);
	}
};


Zotero.setCitationLanguages = function (obj, citeproc) {
	var segments = ['Persons', 'Institutions', 'Titles', 'Journals', 'Publishers', 'Places'];
	for (var i = 0, ilen = segments.length; i < ilen; i += 1) {
		var settings = Zotero.Prefs.get("csl.citation" + segments[i]);
		if (settings) {
			settings = settings.split(",");
		} else {
			settings = ['orig']
		}
		obj['citationLangPrefs'+segments[i]] = settings;
	}
	obj.citationAffixes = null;
	var affixes = Zotero.Prefs.get("csl.citationAffixes");
	if (affixes) {
		affixes = affixes.split("|");
		if (affixes.length === 48) {
			obj.citationAffixes = affixes;
		}
	}
	if (!obj.citationAffixes) {
		obj.citationAffixes = [,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,];
	}
	obj.citationTransliteration = [];
	obj.citationTranslation = [];
	obj.citationSort = [];
	var sql = 'SELECT param, tag FROM zlsPreferences '
		+ 'WHERE profile=? AND '
		+ 'param IN (?,?,?)';
	var res = Zotero.DB.query(sql,['default','citationTransliteration','citationTranslation','citationSort']);
	
	if (res) {
		for (var i = 0, ilen = res.length; i < ilen; i += 1) {
			obj[res[i].param].push(res[i].tag);
		}
	}
	if (citeproc) {
		citeproc.setLangPrefsForCites(obj, function(key){return 'citationLangPrefs'+key});

		citeproc.setLangTagsForCslTransliteration(obj.citationTransliteration);
		citeproc.setLangTagsForCslTranslation(obj.citationTranslation);
		citeproc.setLangTagsForCslSort(obj.citationSort);

		citeproc.setLangPrefsForCiteAffixes(obj.citationAffixes);

		citeproc.setAutoVietnameseNamesOption(Zotero.Prefs.get('csl.autoVietnameseNames'));
	}
}

Zotero.isRTL = function(langs) {
	rtl = false;
	for (var i = langs.length - 1; i > -1; i += -1) {
		var langTag = langs[i];
		if (langTag && "string" === typeof langTag) {
			langTag = langTag.replace(/^([-a-zA-Z0-9]+).*/,"$1");
		}
		if (langTag && "string" === typeof langTag) {
			var taglst = langTag.split("-");
			if (["ar", "he", "fa", "ur", "yi", "ps", "syr"].indexOf(taglst[0]) > -1) {
				rtl = true;
				for (var i = 1, ilen = taglst.length; i < ilen; i += 1) {
					if (taglst[i].length > 3) {
						rtl = false;
					}
				}
			}
			// If there is something that looks like a language tag
			// set on the field, it had better be valid. Should always
			// be so, since string input is not allowed.
			break;
		}
	}
	return rtl;
}

Zotero.setRTL = function(node, langs) {
	if (Zotero.isRTL(langs)) {
		node.setAttribute("style", "direction:rtl !important;");
	} else {
		node.setAttribute("style", "direction:ltr !important;");
	}
};
