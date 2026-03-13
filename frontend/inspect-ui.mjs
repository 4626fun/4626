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
      text: msg.text(),
      location: msg.location()
    });
  });

  // Collect errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack
    });
  });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Wait a bit for any async rendering
  await page.waitForTimeout(5000);

  console.log('\n=== PAGE INSPECTION ===\n');

  // 1. Check for top-right identity avatar
  console.log('1. CHECKING TOP-RIGHT IDENTITY AVATAR:');
  
  // Look for common header/identity button patterns
  const identityButton = await page.locator('header button, [data-testid*="identity"], [data-testid*="avatar"], button[aria-label*="account"], button[aria-label*="profile"]').first();
  const identityExists = await identityButton.count() > 0;
  
  if (identityExists) {
    const buttonText = await identityButton.textContent();
    const buttonHTML = await identityButton.innerHTML();
    const hasImage = await identityButton.locator('img').count() > 0;
    const imageCount = await identityButton.locator('img').count();
    
    console.log(`  ✓ Identity button found`);
    console.log(`  - Text content: "${buttonText?.trim() || '(empty)'}"`);
    console.log(`  - Has image element: ${hasImage}`);
    console.log(`  - Image count: ${imageCount}`);
    
    if (hasImage) {
      const img = identityButton.locator('img').first();
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');
      const isVisible = await img.isVisible();
      console.log(`  - Image src: ${src}`);
      console.log(`  - Image alt: ${alt}`);
      console.log(`  - Image visible: ${isVisible}`);
    }
    
    console.log(`  - Button HTML (first 200 chars): ${buttonHTML?.substring(0, 200)}...`);
  } else {
    console.log(`  ✗ No identity button found in header`);
  }

  // 2. Check for XMTP chat widget
  console.log('\n2. CHECKING XMTP CHAT WIDGET:');
  
  const chatWidget = await page.locator('[data-testid*="chat"], [data-testid*="xmtp"], [class*="chat-widget"], [id*="chat"], button[aria-label*="chat"]').first();
  const chatExists = await chatWidget.count() > 0;
  
  if (chatExists) {
    const isVisible = await chatWidget.isVisible();
    const boundingBox = await chatWidget.boundingBox();
    console.log(`  ✓ Chat widget found`);
    console.log(`  - Visible: ${isVisible}`);
    console.log(`  - Position: ${JSON.stringify(boundingBox)}`);
  } else {
    console.log(`  ✗ No chat widget found`);
  }

  // 3. Check overall page state
  console.log('\n3. PAGE STATE:');
  const title = await page.title();
  const url = page.url();
  console.log(`  - Title: ${title}`);
  console.log(`  - URL: ${url}`);
  
  // Check for common auth/state indicators
  const bodyText = await page.locator('body').textContent();
  const hasSignIn = bodyText?.toLowerCase().includes('sign in') || bodyText?.toLowerCase().includes('connect');
  const hasWaitlist = bodyText?.toLowerCase().includes('waitlist');
  console.log(`  - Contains "sign in" or "connect": ${hasSignIn}`);
  console.log(`  - Contains "waitlist": ${hasWaitlist}`);

  // 4. Console errors/warnings
  console.log('\n4. CONSOLE MESSAGES (errors and warnings only):');
  const relevantMessages = consoleMessages.filter(m => 
    m.type === 'error' || m.type === 'warning'
  );
  
  if (relevantMessages.length === 0) {
    console.log('  (no errors or warnings)');
  } else {
    relevantMessages.forEach((msg, i) => {
      console.log(`  [${msg.type}] ${msg.text}`);
    });
  }

  // 5. Page errors
  console.log('\n5. PAGE ERRORS:');
  if (errors.length === 0) {
    console.log('  (no page errors)');
  } else {
    errors.forEach((err, i) => {
      console.log(`  Error ${i + 1}: ${err.message}`);
      if (err.stack) {
        console.log(`    Stack: ${err.stack.substring(0, 200)}...`);
      }
    });
  }

  // Take a screenshot for reference
  await page.screenshot({ path: '/tmp/ui-screenshot.png', fullPage: false });
  console.log('\n📸 Screenshot saved to /tmp/ui-screenshot.png');

  await browser.close();
})();
