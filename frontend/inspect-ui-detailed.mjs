import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(5000);

  console.log('\n=== DETAILED PAGE INSPECTION ===\n');

  // Check what's actually in the header
  console.log('HEADER CONTENT:');
  const header = page.locator('header').first();
  const headerExists = await header.count() > 0;
  
  if (headerExists) {
    const headerHTML = await header.innerHTML();
    console.log('Header HTML (first 500 chars):');
    console.log(headerHTML.substring(0, 500));
    console.log('...\n');
    
    // Look for all buttons in header
    const headerButtons = header.locator('button');
    const buttonCount = await headerButtons.count();
    console.log(`Found ${buttonCount} buttons in header`);
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const btn = headerButtons.nth(i);
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const className = await btn.getAttribute('class');
      console.log(`  Button ${i + 1}: text="${text?.trim()}", aria-label="${ariaLabel}", class="${className?.substring(0, 50)}"`);
    }
  } else {
    console.log('No header element found');
  }

  // Check for any images in the top-right area
  console.log('\nIMAGES IN PAGE:');
  const allImages = page.locator('img');
  const imageCount = await allImages.count();
  console.log(`Total images on page: ${imageCount}`);
  
  for (let i = 0; i < Math.min(imageCount, 10); i++) {
    const img = allImages.nth(i);
    const src = await img.getAttribute('src');
    const alt = await img.getAttribute('alt');
    const isVisible = await img.isVisible();
    console.log(`  Image ${i + 1}: src="${src}", alt="${alt}", visible=${isVisible}`);
  }

  // Check for any chat-related elements
  console.log('\nCHAT-RELATED ELEMENTS:');
  const chatElements = page.locator('[class*="chat"], [id*="chat"], [data-testid*="chat"]');
  const chatCount = await chatElements.count();
  console.log(`Found ${chatCount} elements with chat-related attributes`);

  // Check body text for clues
  console.log('\nBODY TEXT SAMPLE (first 500 chars):');
  const bodyText = await page.locator('body').textContent();
  console.log(bodyText?.substring(0, 500));

  // Check URL and routing
  console.log('\nROUTING INFO:');
  console.log(`Current URL: ${page.url()}`);
  console.log(`Title: ${await page.title()}`);

  // Look for Privy/auth elements
  console.log('\nAUTH/PRIVY ELEMENTS:');
  const privyElements = page.locator('[data-privy], [class*="privy"], [id*="privy"]');
  const privyCount = await privyElements.count();
  console.log(`Found ${privyCount} Privy-related elements`);

  // Check for any data-testid attributes
  console.log('\nDATA-TESTID ATTRIBUTES:');
  const testIdElements = page.locator('[data-testid]');
  const testIdCount = await testIdElements.count();
  console.log(`Found ${testIdCount} elements with data-testid`);
  
  for (let i = 0; i < Math.min(testIdCount, 10); i++) {
    const el = testIdElements.nth(i);
    const testId = await el.getAttribute('data-testid');
    const tagName = await el.evaluate(node => node.tagName);
    console.log(`  ${tagName}[data-testid="${testId}"]`);
  }

  // Console errors related to avatar or chat
  console.log('\nRELEVANT CONSOLE MESSAGES:');
  const relevantMessages = consoleMessages.filter(m => 
    m.text.toLowerCase().includes('avatar') ||
    m.text.toLowerCase().includes('chat') ||
    m.text.toLowerCase().includes('xmtp') ||
    m.text.toLowerCase().includes('image') ||
    m.text.toLowerCase().includes('identity') ||
    m.type === 'error'
  );
  
  if (relevantMessages.length === 0) {
    console.log('(no relevant messages)');
  } else {
    relevantMessages.forEach(msg => {
      console.log(`  [${msg.type}] ${msg.text}`);
    });
  }

  await page.screenshot({ path: '/tmp/ui-screenshot-detailed.png', fullPage: true });
  console.log('\n📸 Full page screenshot saved to /tmp/ui-screenshot-detailed.png');

  await browser.close();
})();
