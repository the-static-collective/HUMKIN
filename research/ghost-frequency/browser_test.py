from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':360,'height':800},accept_downloads=True)
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    page.set_content(Path(__file__).with_name('ghost-frequency.html').read_text())
    assert page.locator('#status').inner_text()=='INVESTIGATING'
    for _ in range(3):
        page.locator('#observe').click()
    page.locator('#repeat').click()
    assert page.locator('#status').inner_text()=='REPEAT CONFLICT'
    page.locator('#epoch').click()
    assert page.locator('#status').inner_text()=='INVESTIGATING'
    assert page.locator('#log .receipt').count()==4
    page.locator('#suggest').click();page.locator('#observe').click()
    with page.expect_download() as download:
        page.locator('#export').click()
    assert download.value.suggested_filename=='ghost-frequency-evidence.json'
    page.locator('#forgeMode').click();page.locator('#law').select_option('99');page.locator('#seal').click()
    for _ in range(16):
        if page.locator('#status').inner_text()=='UNMODELED':break
        page.locator('#suggest').click();page.locator('#observe').click()
    assert page.locator('#status').inner_text()=='UNMODELED'
    assert not errors,errors
    assert not requests,requests
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    b.close()
print('PASS: mobile width, repeat conflict, new window preserves history, JSON export, alien law, no page errors, zero network requests')
