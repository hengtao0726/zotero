/* Set up the environment before loading the rest of the files into Zotero */
Zotero.RDF.AJAW = {
  Util: {
    ArrayIndexOf: function (arr, item, i) {
      //supported in all browsers except IE<9
      return arr.indexOf(item, i);
    },
    RDFArrayRemove: function (a, x) { //removes all statements equal to x from a
      for(var i = 0; i < a.length; i++) {
        //TODO: This used to be the following, which didnt always work..why
        //if(a[i] == x)
        if(a[i].subject.sameTerm(x.subject)
          && a[i].predicate.sameTerm(x.predicate)
          && a[i].object.sameTerm(x.object)
          && a[i].why.sameTerm(x.why)) {
          a.splice(i, 1);
          return;
        }
      }
      throw "RDFArrayRemove: Array did not contain " + x;
    },
  },
  tabulator: {
  	log: {
    	debug: Zotero.debug,
    	warn: Zotero.debug
  	}
	},
	alert: Zotero.debug
};

Zotero.RDF.AJAW.$rdf = Zotero.RDF.AJAW;
