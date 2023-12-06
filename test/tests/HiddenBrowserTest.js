describe("HiddenBrowser", function() {
	const { HiddenBrowser } = ChromeUtils.import(
		"chrome://zotero/content/HiddenBrowser.jsm"
	);
	
	describe("#create()", function () {
		var httpd;
		var port = 16213;
		var baseURL = `http://127.0.0.1:${port}/`;
		
		var pngRequested = false;

		before(function () {
			Cu.import("resource://zotero-unit/httpd.js");
			httpd = new HttpServer();
			httpd.start(port);
		});
		
		beforeEach(async function () {
			pngRequested = false;
			httpd.registerPathHandler(
				'/remote.png',
				{
					handle: function (request, response) {
						Zotero.debug('Something loaded the image')
						response.setHeader('Content-Type', 'image/png', false);
						response.setStatusLine(null, 200, 'OK');
						response.write('');
						pngRequested = true;
					}
				}
			);
		});

		after(async function () {
			await new Promise(resolve => httpd.stop(resolve));
		});

		it("should fail on non-2xx response with requireSuccessfulStatus", async function () {
			let browser = new HiddenBrowser();
			let e = await getPromiseError(browser.load(baseURL + 'nonexistent', { requireSuccessfulStatus: true }));
			assert.instanceOf(e, Zotero.HTTP.UnexpectedStatusException);
		});
		
		it("should prevent a remote request with blockRemoteResources", async function () {
			let path = OS.Path.join(getTestDataDirectory().path, 'test-hidden.html');
			let browser = new HiddenBrowser({ blockRemoteResources: true });
			await browser.load(path);
			await browser.getPageData(['characterSet', 'bodyText']);
			browser.destroy();
			assert.isFalse(pngRequested);
		});

		it("should allow a remote request without blockRemoteResources", async function () {
			let path = OS.Path.join(getTestDataDirectory().path, 'test-hidden.html');
			let browser = new HiddenBrowser({ blockRemoteResources: false });
			await browser.load(path);
			await browser.getPageData(['characterSet', 'bodyText']);
			browser.destroy();
			assert.isTrue(pngRequested);
		});
	});
	
	describe("#getPageData()", function () {
		it("should handle local UTF-8 HTML file", async function () {
			var path = OS.Path.join(getTestDataDirectory().path, 'test-hidden.html');
			var browser = new HiddenBrowser();
			await browser.load(path);
			var { characterSet, bodyText } = await browser.getPageData(['characterSet', 'bodyText']);
			browser.destroy();
			assert.equal(characterSet, 'UTF-8');
			// Should ignore hidden text
			assert.equal(bodyText, 'This is a test.');
		});
		
		it("should handle local GBK HTML file", async function () {
			var path = OS.Path.join(getTestDataDirectory().path, 'charsets', 'gbk.html');
			var browser = new HiddenBrowser();
			await browser.load(path);
			var { characterSet, bodyText } = await browser.getPageData(['characterSet', 'bodyText']);
			browser.destroy();
			assert.equal(characterSet, 'GBK');
			assert.equal(bodyText, '主体');
		});
		
		it("should handle local GBK text file", async function () {
			var path = OS.Path.join(getTestDataDirectory().path, 'charsets', 'gbk.txt');
			var browser = new HiddenBrowser();
			await browser.load(path);
			var { characterSet, bodyText } = await browser.getPageData(['characterSet', 'bodyText']);
			browser.destroy();
			assert.equal(characterSet, 'GBK');
			assert.equal(bodyText, '这是一个测试文件。');
		});
	});

	describe("#getDocument()", function () {
		it("should provide a Document object", async function () {
			let path = OS.Path.join(getTestDataDirectory().path, 'test-hidden.html');
			var browser = new HiddenBrowser();
			await browser.load(path);
			let document = await browser.getDocument();
			assert.include(document.documentElement.innerHTML, 'test');
			assert.ok(document.location);
			assert.strictEqual(document.cookie, '');
		});
	});

	describe("#snapshot()", function () {
		it("should return a SingleFile snapshot", async function () {
			let path = OS.Path.join(getTestDataDirectory().path, 'test-hidden.html');
			var browser = new HiddenBrowser();
			await browser.load(path);
			let snapshot = await browser.snapshot();
			assert.include(snapshot, 'Page saved with SingleFile');
			assert.include(snapshot, 'This is hidden text.');
		});
	});
});
